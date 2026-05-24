import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { api } from "../shared/routes";
import { z } from "zod";
import passport from "passport";
import multer from "multer";
import fs from "fs";
import path from "path";

const storage_disk = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/pdfs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ dest: "uploads/" });
const uploadPdf = multer({
  storage: storage_disk,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

// ── Nightly KPI cron job ──────────────────────────────────────────────────────
function scheduleMissedFollowupStamp() {
  function msUntil(hour: number, minute: number): number {
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  function runStamp() {
    const todayKey = new Date().toISOString().split("T")[0];
    console.log(`[cron] Stamping missed follow-up days for ${todayKey}`);
    storage.getOverdueFollowupLeads().then(async (rows) => {
      for (const { userId, count } of rows) {
        try {
          await storage.stampMissedFollowupDay(userId, todayKey, count);
          console.log(`[cron] Stamped user ${userId} — ${count} overdue lead(s) on ${todayKey}`);
        } catch (err) {
          console.error(`[cron] Failed to stamp user ${userId}:`, err);
        }
      }
    }).catch(err => console.error("[cron] getOverdueFollowupLeads error:", err));
  }

  setTimeout(function tick() {
    runStamp();
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, msUntil(23, 59));

  console.log(`[cron] Missed follow-up stamp scheduled — next run in ${Math.round(msUntil(23, 59) / 60000)} min`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  scheduleMissedFollowupStamp();

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return res.status(401).json({ message: "Authentication failed" });
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.logIn(user, (err) => {
        if (err) return res.status(500).json({ message: "Login error" });
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.status(200).json(req.user);
  });

  // ── Middleware ──────────────────────────────────────────────────────────────
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });
    next();
  };

  const requireAdminOrManager = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== "admin" && req.user.role !== "manager")
      return res.status(403).json({ message: "Not authorized" });
    next();
  };

  // ── Users ───────────────────────────────────────────────────────────────────

  // All users — admin/manager only
  app.get(api.users.list.path, requireAdminOrManager, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.status(200).json(users);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch users" });
    }
  });

  // Assignable users — all roles, returns colleagues under same manager for regular users
  // IMPORTANT: registered before /api/users/:id to avoid route conflict
  app.get('/api/users/assignable', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        return res.status(200).json(await storage.getUsers());
      }
      if (currentUser.managerId) {
        const colleagues = await storage.getUsersByManager(currentUser.managerId);
        return res.status(200).json(colleagues);
      }
      const self = await storage.getUser(currentUser.id);
      return res.status(200).json(self ? [self] : []);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch assignable users" });
    }
  });

  app.post(api.users.create.path, requireAdmin, async (req, res) => {
    try {
      const { username, password, role, managerId } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ message: "Username already exists" });
      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username, password: hashed, role: role || "user", managerId: managerId || null,
      });
      res.status(201).json(user);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to create user" });
    }
  });

  app.patch(api.users.update.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { username, password, role, managerId } = req.body;
      const updates: any = { username, role, managerId: managerId || null };
      if (password) updates.password = await hashPassword(password);
      const user = await storage.updateUser(id, updates);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update user" });
    }
  });

  app.delete(api.users.delete.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.nullifyUserActivities(id);
      await storage.deleteUser(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete user" });
    }
  });

  // ── Leads ───────────────────────────────────────────────────────────────────
  // ORDERING MATTERS: specific sub-paths must come before /:id wildcards

  // 1. Bulk update
  app.post(api.leads.bulkUpdate.path, requireAdminOrManager, async (req, res) => {
    try {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ message: "No lead IDs provided" });
      await storage.bulkUpdateLeads(ids, updates);
      res.status(200).json({ count: ids.length });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to bulk update leads" });
    }
  });

  // 2. CSV upload
  app.post(api.leads.uploadCsv.path, requireAdminOrManager, upload.single("csv"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      res.status(200).json({ count: 0 });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to upload CSV" });
    }
  });

  // 3. Leads by user — for dashboard team activity view
  //    MUST be before GET /api/leads/:id to prevent "user" matching as an id
  app.get('/api/leads/user/:id', requireAdminOrManager, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const leads = await storage.getLeads({ assignedTo: userId });
      res.status(200).json(leads);
    } catch (err: any) {
      console.error("user leads error:", err);
      res.status(500).json({ message: err?.message || "Failed to fetch leads" });
    }
  });

  // 4. List all leads
  app.get(api.leads.list.path, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const leads = (currentUser.role === "admin" || currentUser.role === "manager")
        ? await storage.getLeads()
        : await storage.getLeads({ assignedTo: currentUser.id });
      res.status(200).json(leads);
    } catch (err: any) {
      console.error("leads list error:", err);
      res.status(500).json({ message: err?.message || "Failed to fetch leads" });
    }
  });

  // 5. Create lead
  app.post(api.leads.create.path, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const data = { ...req.body };
      if (currentUser.role === "user") data.assignedTo = currentUser.id;
      const lead = await storage.createLead(data);
      await storage.createLeadActivity({
        leadId: lead.id,
        userId: currentUser.id,
        type: "created",
        content: `Lead created`,
      });
      res.status(201).json(lead);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("lead create error:", err);
      res.status(500).json({ message: err?.message || "Failed to create lead" });
    }
  });

  // 6. Get single lead
  app.get(api.leads.get.path, requireAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(Number(req.params.id));
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.status(200).json(lead);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch lead" });
    }
  });

  // 7. Update lead
  app.patch(api.leads.update.path, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const id = Number(req.params.id);
      const updates = req.body;

      const existing = await storage.getLead(id);
      if (!existing) return res.status(404).json({ message: "Lead not found" });

      // Normalise followUpDate — Drizzle timestamp column needs a Date object or null
      let followUpDateObj: Date | null | undefined = undefined;
      if ('followUpDate' in updates) {
        if (!updates.followUpDate) {
          followUpDateObj = null;
        } else {
          const raw = updates.followUpDate;
          const asDate = raw instanceof Date ? raw : new Date(String(raw));
          followUpDateObj = isNaN(asDate.getTime()) ? null : asDate;
        }
        updates.followUpDate = followUpDateObj;
      }

      const lead = await storage.updateLead(id, updates);

      if (updates.status && updates.status !== existing.status) {
        await storage.createLeadActivity({
          leadId: id,
          userId: currentUser.id,
          type: "status_change",
          content: `Status changed from ${existing.status} to ${updates.status}`,
        });
      }

      if (followUpDateObj !== undefined && followUpDateObj !== null) {
        await storage.createLeadActivity({
          leadId: id,
          userId: currentUser.id,
          type: "follow_up_set",
          content: `Follow-up set for ${followUpDateObj.toLocaleDateString()}`,
        });
      }

      res.status(200).json(lead);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("lead update error:", err);
      res.status(500).json({ message: err?.message || "Failed to update lead" });
    }
  });

  // 8. Delete lead
  app.delete(api.leads.delete.path, requireAdminOrManager, async (req, res) => {
    try {
      await storage.deleteLead(Number(req.params.id));
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete lead" });
    }
  });

  // ── Lead Activities ─────────────────────────────────────────────────────────
  app.get(api.leads.activities.list.path, requireAuth, async (req, res) => {
    try {
      const activities = await storage.getLeadActivities(Number(req.params.id));
      res.status(200).json(activities);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch activities" });
    }
  });

  app.post(api.leads.activities.create.path, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { type, content } = req.body;
      const activity = await storage.createLeadActivity({
        leadId: Number(req.params.id),
        userId: currentUser.id,
        type,
        content: content || null,
      });
      res.status(201).json(activity);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: err?.message || "Failed to create activity" });
    }
  });

  // ── Templates ───────────────────────────────────────────────────────────────
  app.get(api.templates.list.path, requireAuth, async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.status(200).json(templates);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch templates" });
    }
  });

  app.post(api.templates.create.path, requireAuth, async (req, res) => {
    try {
      const { name, content, pdfUrl, pdfName } = req.body;
      if (!name || !content) return res.status(400).json({ message: "Name and content are required" });
      const template = await storage.createTemplate({
        name, content, pdfUrl: pdfUrl || null, pdfName: pdfName || null,
      });
      res.status(201).json(template);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("template create error:", err);
      res.status(500).json({ message: err?.message || "Failed to create template" });
    }
  });

  app.delete(api.templates.delete.path, requireAdmin, async (req, res) => {
    try {
      await storage.deleteTemplate(Number(req.params.id));
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete template" });
    }
  });

  // ── PDF Upload ──────────────────────────────────────────────────────────────
  app.post('/api/upload/pdf', requireAuth, uploadPdf.single('pdf'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      res.status(200).json({ pdfUrl: `/uploads/pdfs/${req.file.filename}`, pdfName: req.file.originalname });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to upload PDF" });
    }
  });

  app.use('/uploads/pdfs', (req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  // ── Reports ─────────────────────────────────────────────────────────────────
  app.get('/api/reports/me', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { from, to } = getDateRange(
        req.query.period as string,
        req.query.from as string,
        req.query.to as string,
      );
      const summary = await storage.getActivitySummary(currentUser.id, from, to);
      res.status(200).json(summary);
    } catch (err: any) {
      console.error("report error:", err);
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/user/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const targetId = Number(req.params.id);
      if (currentUser.role === 'manager') {
        const myUsers = await storage.getUsersByManager(currentUser.id);
        if (!myUsers.some(u => u.id === targetId))
          return res.status(403).json({ message: "Not authorized" });
      } else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { from, to } = getDateRange(
        req.query.period as string,
        req.query.from as string,
        req.query.to as string,
      );
      const summary = await storage.getActivitySummary(targetId, from, to);
      res.status(200).json(summary);
    } catch (err: any) {
      console.error("report user error:", err);
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/user/:id/leads', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const targetId = Number(req.params.id);
      if (currentUser.role === 'manager') {
        const myUsers = await storage.getUsersByManager(currentUser.id);
        if (!myUsers.some((u: any) => u.id === targetId))
          return res.status(403).json({ message: "Not authorized" });
      } else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { from, to } = getDateRange(
        req.query.period as string,
        req.query.from as string,
        req.query.to as string,
      );
      const activities = await storage.getActivitiesByUserInRange(targetId, from, to);
      const leadMap = new Map<number, any[]>();
      for (const act of activities) {
        if (!leadMap.has(act.leadId)) leadMap.set(act.leadId, []);
        leadMap.get(act.leadId)!.push(act);
      }
      const result = [];
      for (const [leadId, acts] of leadMap) {
        const lead = await storage.getLead(leadId);
        if (!lead) continue;
        result.push({
          ...lead,
          activityCount: acts.length,
          recentActivities: acts
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3),
        });
      }
      result.sort((a, b) => {
        const aT = a.recentActivities[0]?.createdAt ? new Date(a.recentActivities[0].createdAt).getTime() : 0;
        const bT = b.recentActivities[0]?.createdAt ? new Date(b.recentActivities[0].createdAt).getTime() : 0;
        return bT - aT;
      });
      res.status(200).json(result);
    } catch (err: any) {
      console.error("user leads error:", err);
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/activities', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { period, type, userId: queryUserId } = req.query;
      let targetId = currentUser.id;
      if (queryUserId) {
        targetId = Number(queryUserId);
        if (currentUser.role === 'manager') {
          const myUsers = await storage.getUsersByManager(currentUser.id);
          if (!myUsers.some((u: any) => u.id === targetId))
            return res.status(403).json({ message: "Not authorized" });
        } else if (currentUser.role !== 'admin' && targetId !== currentUser.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
      }
      const { from, to } = getDateRange(
        period as string,
        req.query.from as string,
        req.query.to as string,
      );
      const activities = await storage.getActivitiesByUserInRange(targetId, from, to);
      const filtered = type ? activities.filter((a: any) => a.type === type) : activities;
      const enriched = await Promise.all(
        filtered.map(async (act: any) => {
          const lead = await storage.getLead(act.leadId);
          return {
            ...act,
            leadName: lead?.name ?? 'Unknown',
            leadCompany: lead?.company ?? null,
            leadMobile: lead?.mobile ?? null,
            leadStatus: lead?.status ?? null,
          };
        })
      );
      enriched.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.status(200).json(enriched);
    } catch (err: any) {
      console.error("activities error:", err);
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/my-users', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.role === 'manager') {
        return res.status(200).json(await storage.getUsersByManager(currentUser.id));
      } else if (currentUser.role === 'admin') {
        const all = await storage.getUsers();
        return res.status(200).json(all.filter((u: any) => u.role !== 'admin'));
      }
      return res.status(403).json({ message: "Not authorized" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  // ── Leave Requests ──────────────────────────────────────────────────────────
  app.get('/api/leaves', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      let leaves;
      if (currentUser.role === 'admin') {
        leaves = await storage.getLeaveRequests();
      } else if (currentUser.role === 'manager') {
        leaves = await storage.getLeaveRequests({ managerId: currentUser.id });
      } else {
        leaves = await storage.getLeaveRequests({ userId: currentUser.id });
      }
      const allUsers = await storage.getUsers();
      const userMap = Object.fromEntries(allUsers.map((u: any) => [u.id, u.username]));
      const enriched = leaves.map((l: any) => ({
        ...l,
        username: userMap[l.userId] || null,
        managerName: l.managerId ? userMap[l.managerId] || null : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch leaves" });
    }
  });

  app.post('/api/leaves', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { startDate, endDate, reason } = req.body;
      if (!startDate || !endDate) return res.status(400).json({ message: "Start and end date are required" });
      const start = new Date(startDate);
      const end = new Date(endDate);
      let days = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() !== 0) days++;
        cur.setDate(cur.getDate() + 1);
      }
      if (days === 0) return res.status(400).json({ message: "No working days in selected range (Sundays excluded)" });
      const month = start.getMonth() + 1;
      const year = start.getFullYear();
      const usedDays = await storage.getMonthlyLeaveCount(currentUser.id, year, month);
      const remaining = Math.max(0, 2 - usedDays);
      const lopDays = Math.max(0, days - remaining);
      const isLop = lopDays > 0;
      let managerId = currentUser.managerId || null;
      if (!managerId) {
        const allUsers = await storage.getUsers();
        const mgr = allUsers.find((u: any) => u.role === 'manager' || u.role === 'admin');
        managerId = mgr?.id || null;
      }
      const leave = await storage.createLeaveRequest({
        userId: currentUser.id,
        managerId,
        startDate,
        endDate,
        days,
        reason: reason || null,
        status: 'pending',
        isLop,
      });
      res.status(201).json({ ...leave, lopDays, remaining });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to apply leave" });
    }
  });

  app.patch('/api/leaves/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.role === 'user') return res.status(403).json({ message: "Not authorized" });
      const id = Number(req.params.id);
      const { status, managerNote } = req.body;
      if (!['approved', 'rejected'].includes(status))
        return res.status(400).json({ message: "Status must be approved or rejected" });
      const leave = await storage.updateLeaveRequest(id, { status, managerNote: managerNote || null });
      res.json(leave);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update leave" });
    }
  });

  app.delete('/api/leaves/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const id = Number(req.params.id);
      const leave = await storage.getLeaveRequest(id);
      if (!leave) return res.status(404).json({ message: "Leave not found" });
      if (leave.userId !== currentUser.id && currentUser.role === 'user')
        return res.status(403).json({ message: "Not authorized" });
      if (leave.status !== 'pending')
        return res.status(400).json({ message: "Only pending leaves can be cancelled" });
      await storage.updateLeaveRequest(id, { status: 'rejected', managerNote: 'Cancelled by user' });
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to cancel leave" });
    }
  });

  // ── Missed Follow-up Days (KPI) ─────────────────────────────────────────────
  app.get('/api/missed-followup-days', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      let targetUserId = currentUser.id;
      if (req.query.userId) {
        const requestedId = Number(req.query.userId);
        if (currentUser.role === 'user' && requestedId !== currentUser.id)
          return res.status(403).json({ message: "Not authorized" });
        targetUserId = requestedId;
      }
      const days = await storage.getMissedFollowupDays(targetUserId);
      res.json(days);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch missed follow-up days" });
    }
  });

  app.post('/api/missed-followup-days/stamp', requireAdmin, async (req, res) => {
    try {
      const todayKey = new Date().toISOString().split("T")[0];
      const rows = await storage.getOverdueFollowupLeads();
      for (const { userId, count } of rows) {
        await storage.stampMissedFollowupDay(userId, todayKey, count);
      }
      res.json({ stamped: rows.length, date: todayKey });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to stamp" });
    }
  });

  return httpServer;
}

// ── Date range helper ─────────────────────────────────────────────────────────
function getDateRange(period: string, fromParam?: string, toParam?: string): { from: Date; to: Date } {
  // Custom range — explicit from/to take priority over period
  if (fromParam && toParam) {
    return {
      from: new Date(fromParam + "T00:00:00"),
      to:   new Date(toParam   + "T23:59:59"),
    };
  }

  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + 1);
  to.setHours(0, 0, 0, 0);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === 'week') from.setDate(from.getDate() - from.getDay());
  else if (period === 'month') from.setDate(1);
  return { from, to };
}