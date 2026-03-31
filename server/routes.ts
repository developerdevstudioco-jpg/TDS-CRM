import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { api } from "../shared/routes";
import { z } from "zod";
import passport from "passport";
import multer from "multer";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

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

  app.post(api.users.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashed = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashed });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("route error:", err);
      return res.status(500).json({ message: (err as any)?.message || String(err) });
    }
  });

  app.patch(api.users.update.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.users.update.input.parse(req.body);
      const updates: any = {};
      if (input.role) updates.role = input.role;
      if (input.username) updates.username = input.username;
      if (input.password) updates.password = await hashPassword(input.password);
      const user = await storage.updateUser(id, updates);
      res.status(200).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(404).json({ message: "User not found" });
    }
  });

  app.delete(api.users.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.status(204).end();
  });

  // Leads API
  app.get(api.leads.list.path, requireAuth, async (req, res) => {
    const currentUser = req.user as any;
    // Users (non-admin, non-manager) only see their own assigned leads
    const options = currentUser.role === 'user'
      ? { assignedTo: currentUser.id }
      : undefined;
    const leads = await storage.getLeads(options);
    res.status(200).json(leads);
  });

  // Bulk update leads
  app.post(api.leads.bulkUpdate.path, requireAuth, async (req, res) => {
    try {
      const input = api.leads.bulkUpdate.input.parse(req.body);
      if (input.ids.length === 0) return res.status(400).json({ message: "No leads selected" });

      const currentUser = req.user as any;
      // For each lead, if status is changing, log activity
      if (input.updates.status) {
        for (const id of input.ids) {
          const existing = await storage.getLead(id);
          if (existing && existing.status !== input.updates.status) {
            await storage.createLeadActivity({
              leadId: id,
              userId: currentUser.id,
              type: 'status_change',
              content: `Status changed from "${existing.status}" to "${input.updates.status}" (bulk update)`,
            });
          }
        }
      }
      if (input.updates.assignedTo !== undefined) {
        for (const id of input.ids) {
          await storage.createLeadActivity({
            leadId: id,
            userId: currentUser.id,
            type: 'created',
            content: `Lead reassigned (bulk update)`,
          });
        }
      }

      await storage.bulkUpdateLeads(input.ids, input.updates);
      res.status(200).json({ count: input.ids.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("route error:", err);
      return res.status(500).json({ message: (err as any)?.message || String(err) });
    }
  });

  app.get(api.leads.get.path, requireAuth, async (req, res) => {
    const lead = await storage.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.status(200).json(lead);
  });

  app.post(api.leads.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.leads.create.input.parse(req.body);
      const lead = await storage.createLead(input);
      // Log creation activity
      await storage.createLeadActivity({
        leadId: lead.id,
        userId: (req.user as any).id,
        type: 'created',
        content: 'Lead created',
      });
      res.status(201).json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("route error:", err);
      return res.status(500).json({ message: (err as any)?.message || String(err) });
    }
  });

  app.patch(api.leads.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.leads.update.input.parse(req.body);
      const existing = await storage.getLead(id);
      if (!existing) return res.status(404).json({ message: "Lead not found" });

      const lead = await storage.updateLead(id, input);

      // Log status change activity automatically
      if (input.status && input.status !== existing.status) {
        await storage.createLeadActivity({
          leadId: id,
          userId: (req.user as any).id,
          type: 'status_change',
          content: `Status changed from "${existing.status}" to "${input.status}"`,
        });
      }

      res.status(200).json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(404).json({ message: "Lead not found" });
    }
  });

  app.delete(api.leads.delete.path, requireAuth, async (req, res) => {
    await storage.deleteLead(Number(req.params.id));
    res.status(204).end();
  });

  // Lead Activities API
  app.get(api.leads.activities.list.path, requireAuth, async (req, res) => {
    const activities = await storage.getLeadActivities(Number(req.params.id));
    res.status(200).json(activities);
  });

  app.post(api.leads.activities.create.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.leads.activities.create.input.parse(req.body);
      const activity = await storage.createLeadActivity({
        leadId: id,
        userId: (req.user as any).id,
        type: input.type,
        content: input.content,
      });
      res.status(201).json(activity);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("route error:", err);
      return res.status(500).json({ message: (err as any)?.message || String(err) });
    }
  });

  app.post(api.leads.uploadCsv.path, requireAuth, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const content = fs.readFileSync(req.file.path, "utf-8");
    const lines = content.split("\n");
    let count = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [name, mobile, email, company] = line.split(",").map((s: string) => s.trim());
      if (name && mobile) {
        const lead = await storage.createLead({ name, mobile, email, company, status: "Open" });
        await storage.createLeadActivity({
          leadId: lead.id,
          userId: (req.user as any).id,
          type: 'created',
          content: 'Lead imported from CSV',
        });
        count++;
      }
    }
    res.status(200).json({ count });
  });

  // Templates API
  app.get(api.templates.list.path, requireAuth, async (req, res) => {
    const templates = await storage.getTemplates();
    res.status(200).json(templates);
  });

  app.post(api.templates.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.templates.create.input.parse(req.body);
      const template = await storage.createTemplate(input);
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

  return httpServer;
}