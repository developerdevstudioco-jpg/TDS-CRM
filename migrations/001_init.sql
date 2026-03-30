-- 001_init.sql
-- Initial migration to create a test table

CREATE TABLE IF NOT EXISTS test_table (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);
