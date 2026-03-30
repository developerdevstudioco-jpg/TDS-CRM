// migrations/001_create_users_table.ts
import { sql } from "drizzle-orm";

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE users`);
}