CREATE TABLE IF NOT EXISTS missed_followup_days (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  missed_date DATE NOT NULL,
  lead_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, missed_date)
);
