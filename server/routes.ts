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
const uploadPdf = multer({ storage: storage_disk, fileFilter: (req, file, cb) => {
  if (file.mimetype === "application/pdf") cb(null, true);
  else cb(new Error("Only PDF files are allowed"));
}});

// ── Nightly KPI cron job ──────────────────────────────────────────────────────
// Runs at 11:59 PM every day. Stamps any user who still has overdue/today
// follow-ups as a "missed day" — this record is permanent for KPI tracking.
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

  // Schedule first run at 23:59
  setTimeout(function tick() {
    runStamp();
    // Then repeat every 24 hours
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, msUntil(23, 59));

  console.log(`[cron] Missed follow-up stamp scheduled — next run in ${Math.round(msUntil(23, 59) / 60000)} min`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  // Start the nightly cron job
  scheduleMissedFollowupStamp();

  // Auth Routes
  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) {
        return res.status(401).json({ message: "Authentication failed" });
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login error" });
        }
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

  // Middleware for checking auth
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") return res.status(403).json({ message: "Not authorized" });
    next();
  };

  const requireAdminOrManager = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== "admin" && req.user.role !== "manager") return res.status(403).json({ message: "Not authorized" });
    next();
  };

  // Users API — admin & manager can list users (for assignment dropdowns)
  app.get(api.users.list.path, requireAdminOrManager, async (req, res) => {
    const users = await storage.getUsers();
    res.status(200).json(users);
  });

  // ── Leave Requests ──────────────────────────────────────────────────────────

  // GET /api/leaves — user sees own, manager sees their team's, admin sees all
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

  // POST /api/leaves — user applies for leave
  app.post('/api/leaves', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start and end date are required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      let days = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() !== 0) days++;
        cur.setDate(cur.getDate() + 1);
      }

      if (days === 0) {
        return res.status(400).json({ message: "No working days in selected range (Sundays excluded)" });
      }

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

  // PATCH /api/leaves/:id — manager/admin approves or rejects
  app.patch('/api/leaves/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.role === 'user') {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = Number(req.params.id);
      const { status, managerNote } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be approved or rejected" });
      }
      const leave = await storage.updateLeaveRequest(id, { status, managerNote: managerNote || null });
      res.json(leave);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update leave" });
    }
  });

  // DELETE /api/leaves/:id — user can cancel their own pending leave
  app.delete('/api/leaves/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const id = Number(req.params.id);
      const leave = await storage.getLeaveRequest(id);
      if (!leave) return res.status(404).json({ message: "Leave not found" });
      if (leave.userId !== currentUser.id && currentUser.role === 'user') {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (leave.status !== 'pending') {
        return res.status(400).json({ message: "Only pending leaves can be cancelled" });
      }
      await storage.updateLeaveRequest(id, { status: 'rejected', managerNote: 'Cancelled by user' });
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to cancel leave" });
    }
  });

  // ── Missed Follow-up Days (KPI) ─────────────────────────────────────────────

  // GET /api/missed-followup-days — returns stamped missed days for the current user
  // Admin/manager can pass ?userId=X to view another user's history
  app.get('/api/missed-followup-days', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      let targetUserId = currentUser.id;

      if (req.query.userId) {
        const requestedId = Number(req.query.userId);
        if (currentUser.role === 'user' && requestedId !== currentUser.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
        targetUserId = requestedId;
      }

      const days = await storage.getMissedFollowupDays(targetUserId);
      res.json(days);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch missed follow-up days" });
    }
  });

  // POST /api/missed-followup-days/stamp — manually trigger stamp (admin only, for testing)
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

  // Serve uploaded PDFs
  app.use('/uploads/pdfs', (req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.post(api.templates.create.path, requireAuth, async (req, res) => {
    try {
      const { name, content, pdfUrl, pdfName } = req.body;
      if (!name || !content) return res.status(400).json({ message: "Name and content are required" });
      const template = await storage.createTemplate({ name, content, pdfUrl: pdfUrl || null, pdfName: pdfName || null });
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("route error:", err);
      return res.status(500).json({ message: (err as any)?.message || String(err) });
    }
  });

  app.delete(api.templates.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteTemplate(Number(req.params.id));
    res.status(204).end();
  });

  // Reports API
  app.get('/api/reports/me', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { period } = req.query;
      const { from, to } = getDateRange(period as string);
      const summary = await storage.getActivitySummary(currentUser.id, from, to);
      res.status(200).json(summary);
    } catch (err: any) {
      console.error("report error:", err);
      return res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/user/:id', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const targetId = Number(req.params.id);
      if (currentUser.role === 'manager') {
        const myUsers = await storage.getUsersByManager(currentUser.id);
        const allowed = myUsers.some(u => u.id === targetId);
        if (!allowed) return res.status(403).json({ message: "Not authorized" });
      } else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { period } = req.query;
      const { from, to } = getDateRange(period as string);
      const summary = await storage.getActivitySummary(targetId, from, to);
      res.status(200).json(summary);
    } catch (err: any) {
      console.error("report user error:", err);
      return res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/user/:id/leads', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const targetId = Number(req.params.id);

      if (currentUser.role === 'manager') {
        const myUsers = await storage.getUsersByManager(currentUser.id);
        const allowed = myUsers.some((u: any) => u.id === targetId);
        if (!allowed) return res.status(403).json({ message: "Not authorized" });
      } else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { period } = req.query;
      const { from, to } = getDateRange(period as string);
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
        const aTime = a.recentActivities[0]?.createdAt ? new Date(a.recentActivities[0].createdAt).getTime() : 0;
        const bTime = b.recentActivities[0]?.createdAt ? new Date(b.recentActivities[0].createdAt).getTime() : 0;
        return bTime - aTime;
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("user leads error:", err);
      return res.status(500).json({ message: err?.message || String(err) });
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
          const allowed = myUsers.some((u: any) => u.id === targetId);
          if (!allowed) return res.status(403).json({ message: "Not authorized" });
        } else if (currentUser.role !== 'admin' && targetId !== currentUser.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
      }

      const { from, to } = getDateRange(period as string);
      const activities = await storage.getActivitiesByUserInRange(targetId, from, to);

      const filtered = type
        ? activities.filter((a: any) => a.type === type)
        : activities;

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
      return res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.get('/api/reports/my-users', requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.role === 'manager') {
        const myUsers = await storage.getUsersByManager(currentUser.id);
        return res.status(200).json(myUsers);
      } else if (currentUser.role === 'admin') {
        const allUsers = await storage.getUsers();
        return res.status(200).json(allUsers);
      }
      return res.status(403).json({ message: "Not authorized" });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || String(err) });
    }
  });

  return httpServer;
}

function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + 1);
  to.setHours(0, 0, 0, 0);

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  if (period === 'week') {
    from.setDate(from.getDate() - from.getDay());
  } else if (period === 'month') {
    from.setDate(1);
  }

  return { from, to };
}