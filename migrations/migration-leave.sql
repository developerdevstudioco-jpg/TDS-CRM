-- migrations/0010_leave_requests.sql
-- Add this as a new migration file in your migrations/ folder

CREATE TABLE IF NOT EXISTS leave_requests (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  manager_id  INTEGER REFERENCES users(id),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        INTEGER NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  is_lop      BOOLEAN NOT NULL DEFAULT false,
  manager_note TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
