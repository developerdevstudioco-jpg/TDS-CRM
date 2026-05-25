import { db } from "./db";
import {
  users, leads, templates, leadActivities, leaveRequests,
  type User, type InsertUser,
  type Lead, type InsertLead, type UpdateLeadRequest,
  type Template, type InsertTemplate,
  type LeadActivity, type InsertLeadActivity,
  type LeaveRequest, type InsertLeaveRequest
} from "@shared/schema";
import { eq, desc, inArray, and, gte, lt, lte, sql } from "drizzle-orm";
import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";

// ── missed_followup_days table (inline definition) ────────────────────────────
export const missedFollowupDays = pgTable("missed_followup_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  missedDate: date("missed_date").notNull(),
  leadCount: integer("lead_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MissedFollowupDay = typeof missedFollowupDays.$inferSelect;

export type LeadActivityWithUser = LeadActivity & { username?: string };
export type LeadWithUser = Lead & { assignedUsername?: string | null };

export interface ActivitySummary {
  calls: number;
  whatsapp: number;
  sms: number;
  leadsCreated: number;
  statusChanges: number;
  notesAdded: number;
  followUpsSet: number;
  total: number;
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUsersByManager(managerId: number): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Leads
  getLeads(options?: { assignedTo?: number }): Promise<LeadWithUser[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead>;
  bulkUpdateLeads(ids: number[], updates: UpdateLeadRequest): Promise<void>;
  deleteLead(id: number): Promise<void>;

  // Lead Activities
  getLeadActivities(leadId: number): Promise<LeadActivityWithUser[]>;
  createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity>;
  getActivitiesByUserInRange(userId: number, from: Date, to: Date): Promise<LeadActivity[]>;
  nullifyUserActivities(userId: number): Promise<void>;

  // Reports
  getActivitySummary(userId: number, from: Date, to: Date): Promise<ActivitySummary>;

  // Templates
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;

  // Leave Requests
  getLeaveRequests(options?: { userId?: number; managerId?: number }): Promise<LeaveRequest[]>;
  getLeaveRequest(id: number): Promise<LeaveRequest | undefined>;
  createLeaveRequest(leave: Omit<InsertLeaveRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<LeaveRequest>;
  updateLeaveRequest(id: number, updates: Partial<InsertLeaveRequest>): Promise<LeaveRequest>;
  getMonthlyLeaveCount(userId: number, year: number, month: number): Promise<number>;

  // Missed Follow-up Days (KPI)
  stampMissedFollowupDay(userId: number, missedDate: string, leadCount: number): Promise<void>;
  getMissedFollowupDays(userId: number): Promise<MissedFollowupDay[]>;
  getOverdueFollowupLeads(): Promise<{ userId: number; count: number }[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByManager(managerId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.managerId, managerId));
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!updated) throw new Error("User not found");
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Leads
  async getLeads(options?: { assignedTo?: number }): Promise<LeadWithUser[]> {
    let query = db
      .select({
        id: leads.id,
        name: leads.name,
        mobile: leads.mobile,
        email: leads.email,
        company: leads.company,
        status: leads.status,
        assignedTo: leads.assignedTo,
        followUpDate: leads.followUpDate,
        createdAt: leads.createdAt,
        assignedUsername: users.username,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id));

    if (options?.assignedTo !== undefined) {
      return await query.where(eq(leads.assignedTo, options.assignedTo));
    }

    return await query;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead> {
    const [updated] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
    if (!updated) throw new Error("Lead not found");
    return updated;
  }

  async bulkUpdateLeads(ids: number[], updates: UpdateLeadRequest): Promise<void> {
    if (ids.length === 0) return;
    await db.update(leads).set(updates).where(inArray(leads.id, ids));
  }

  async deleteLead(id: number): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // Lead Activities
  async getLeadActivities(leadId: number): Promise<LeadActivityWithUser[]> {
    const activities = await db
      .select({
        id: leadActivities.id,
        leadId: leadActivities.leadId,
        userId: leadActivities.userId,
        type: leadActivities.type,
        content: leadActivities.content,
        createdAt: leadActivities.createdAt,
        username: users.username,
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(eq(leadActivities.leadId, leadId))
      .orderBy(desc(leadActivities.createdAt));
    return activities;
  }

  async createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity> {
    const [created] = await db.insert(leadActivities).values(activity).returning();
    return created;
  }

  async getActivitiesByUserInRange(userId: number, from: Date, to: Date): Promise<LeadActivity[]> {
    return await db
      .select()
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.userId, userId),
          gte(leadActivities.createdAt, from),
          lt(leadActivities.createdAt, to)
        )
      )
      .orderBy(desc(leadActivities.createdAt));
  }

  async nullifyUserActivities(userId: number): Promise<void> {
    await db.update(leadActivities)
      .set({ userId: null })
      .where(eq(leadActivities.userId, userId));
  }

  // Reports
  async getActivitySummary(userId: number, from: Date, to: Date): Promise<ActivitySummary> {
    const activities = await db
      .select({ type: leadActivities.type })
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.userId, userId),
          gte(leadActivities.createdAt, from),
          lt(leadActivities.createdAt, to)
        )
      );

    const summary: ActivitySummary = {
      calls: 0, whatsapp: 0, sms: 0, leadsCreated: 0,
      statusChanges: 0, notesAdded: 0, followUpsSet: 0, total: 0,
    };

    for (const a of activities) {
      summary.total++;
      if (a.type === 'call') summary.calls++;
      else if (a.type === 'whatsapp') summary.whatsapp++;
      else if (a.type === 'sms') summary.sms++;
      else if (a.type === 'created') summary.leadsCreated++;
      else if (a.type === 'status_change') summary.statusChanges++;
      else if (a.type === 'note') summary.notesAdded++;
      else if (a.type === 'follow_up_set') summary.followUpsSet++;
    }

    return summary;
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    return await db.select().from(templates);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(insertTemplate).returning();
    return template;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  // ── Leave Requests ──────────────────────────────────────────────────────────
  async getLeaveRequests(options?: { userId?: number; managerId?: number }): Promise<LeaveRequest[]> {
    if (options?.userId !== undefined) {
      return await db.select().from(leaveRequests)
        .where(eq(leaveRequests.userId, options.userId))
        .orderBy(desc(leaveRequests.createdAt));
    }
    if (options?.managerId !== undefined) {
      return await db.select().from(leaveRequests)
        .where(eq(leaveRequests.managerId, options.managerId))
        .orderBy(desc(leaveRequests.createdAt));
    }
    return await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
    const [leave] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return leave;
  }

  async createLeaveRequest(leave: Omit<InsertLeaveRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<LeaveRequest> {
    const [created] = await db.insert(leaveRequests).values(leave).returning();
    return created;
  }

  async updateLeaveRequest(id: number, updates: Partial<InsertLeaveRequest>): Promise<LeaveRequest> {
    const [updated] = await db.update(leaveRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning();
    if (!updated) throw new Error("Leave request not found");
    return updated;
  }

  async getMonthlyLeaveCount(userId: number, year: number, month: number): Promise<number> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const rows = await db.select({ days: leaveRequests.days })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, userId),
          gte(leaveRequests.startDate, from.toISOString().split("T")[0]),
          lt(leaveRequests.startDate, to.toISOString().split("T")[0]),
          sql`${leaveRequests.status} != 'rejected'`
        )
      );

    return rows.reduce((sum, r) => sum + (r.days ?? 0), 0);
  }

  // ── Missed Follow-up Days (KPI) ─────────────────────────────────────────────

  // Upserts a missed day record for a user — called by nightly cron
  async stampMissedFollowupDay(userId: number, missedDate: string, leadCount: number): Promise<void> {
    await db.execute(sql`
      INSERT INTO missed_followup_days (user_id, missed_date, lead_count)
      VALUES (${userId}, ${missedDate}::date, ${leadCount})
      ON CONFLICT (user_id, missed_date)
      DO UPDATE SET lead_count = EXCLUDED.lead_count
    `);
  }

  // Returns all stamped missed days for a user
  async getMissedFollowupDays(userId: number): Promise<MissedFollowupDay[]> {
    return await db.select()
      .from(missedFollowupDays)
      .where(eq(missedFollowupDays.userId, userId))
      .orderBy(desc(missedFollowupDays.missedDate));
  }

// ── Add this method to IStorage interface ────────────────────────────────────
// getActivityDays(userId: number, from: Date, to: Date): Promise<string[]>;
// Returns array of "YYYY-MM-DD" strings where the user had at least 1 activity

// ── Add this implementation to DatabaseStorage ────────────────────────────────
async getActivityDays(userId: number, from: Date, to: Date): Promise<string[]> {
  const rows = await db
    .select({ createdAt: leadActivities.createdAt })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.userId, userId),
        gte(leadActivities.createdAt, from),
        lt(leadActivities.createdAt, to)
      )
    );

  // Deduplicate to unique date strings
  const days = new Set<string>();
  for (const row of rows) {
    if (row.createdAt) {
      const d = new Date(row.createdAt);
      days.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  }
  return Array.from(days);
}

  // Returns overdue follow-up counts per user — used by cron at end of day
  async getOverdueFollowupLeads(): Promise<{ userId: number; count: number }[]> {
    const now = new Date();
    // Use end of today so we capture today's uncleared follow-ups too
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const rows = await db.select({
      userId: leads.assignedTo,
      count: sql<number>`cast(count(*) as int)`,
    })
      .from(leads)
      .where(
        and(
          lte(leads.followUpDate, endOfToday),
          sql`${leads.followUpDate} IS NOT NULL`,
          sql`${leads.assignedTo} IS NOT NULL`
        )
      )
      .groupBy(leads.assignedTo);

    return rows
      .filter(r => r.userId !== null)
      .map(r => ({ userId: r.userId as number, count: r.count }));
  }
}

export const storage = new DatabaseStorage();