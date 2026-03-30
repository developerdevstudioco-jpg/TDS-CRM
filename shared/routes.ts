import { z } from 'zod';
import { insertUserSchema, insertLeadSchema, insertTemplateSchema, leads, users, templates, leadActivities } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

const leadWithUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  mobile: z.string(),
  email: z.string().nullable(),
  company: z.string().nullable(),
  status: z.string(),
  assignedTo: z.number().nullable(),
  followUpDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  assignedUsername: z.string().nullable().optional(),
});

export type LeadWithUser = z.infer<typeof leadWithUserSchema>;

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/users' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/users/:id' as const,
      input: z.object({
        role: z.string().optional(),
        password: z.string().optional(),
        username: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  },
  leads: {
    list: {
      method: 'GET' as const,
      path: '/api/leads' as const,
      responses: {
        200: z.array(leadWithUserSchema),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/leads/:id' as const,
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/leads' as const,
      input: insertLeadSchema,
      responses: {
        201: z.custom<typeof leads.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/leads/:id' as const,
      input: insertLeadSchema.partial(),
      responses: {
        200: z.custom<typeof leads.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    },
    bulkUpdate: {
      method: 'POST' as const,
      path: '/api/leads/bulk' as const,
      input: z.object({
        ids: z.array(z.number()),
        updates: z.object({
          status: z.string().optional(),
          assignedTo: z.number().nullable().optional(),
        }),
      }),
      responses: {
        200: z.object({ count: z.number() }),
        400: errorSchemas.validation,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/leads/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    },
    uploadCsv: {
      method: 'POST' as const,
      path: '/api/leads/upload' as const,
      responses: {
        200: z.object({ count: z.number() }),
        400: errorSchemas.validation,
      }
    },
    activities: {
      list: {
        method: 'GET' as const,
        path: '/api/leads/:id/activities' as const,
        responses: {
          200: z.array(z.custom<typeof leadActivities.$inferSelect & { username?: string }>()),
        }
      },
      create: {
        method: 'POST' as const,
        path: '/api/leads/:id/activities' as const,
        input: z.object({
          type: z.enum(['note', 'status_change']),
          content: z.string().optional(),
        }),
        responses: {
          201: z.custom<typeof leadActivities.$inferSelect>(),
          400: errorSchemas.validation,
        }
      }
    }
  },
  templates: {
    list: {
      method: 'GET' as const,
      path: '/api/templates' as const,
      responses: {
        200: z.array(z.custom<typeof templates.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/templates' as const,
      input: insertTemplateSchema,
      responses: {
        201: z.custom<typeof templates.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/templates/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
