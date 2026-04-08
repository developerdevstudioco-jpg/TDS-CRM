import { db } from "./db";
import {
  users, leads, templates, leadActivities,
  type User, type InsertUser,
  type Lead, type InsertLead, type UpdateLeadRequest,
  type Template, type InsertTemplate,
  type LeadActivity, type InsertLeadActivity
} from "@shared/schema";
import { eq, desc, inArray, and, gte, lt, sql } from "drizzle-orm";

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

  // Reports
  getActivitySummary(userId: number, from: Date, to: Date): Promise<ActivitySummary>;

  // Templates
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;
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

  // ✅ NEW METHOD ADDED
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
      calls: 0,
      whatsapp: 0,
      sms: 0,
      leadsCreated: 0,
      statusChanges: 0,
      notesAdded: 0,
      followUpsSet: 0,
      total: 0,
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
}

export const storage = new DatabaseStorage();