-- ============================================================
-- ZERO HUNGER — RLS FIX (Run in Supabase SQL Editor)
-- This allows the anon key to read/write all tables
-- ============================================================

ALTER TABLE donations        DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests         DISABLE ROW LEVEL SECURITY;
ALTER TABLE users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE ratings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE trusts           DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_requests    DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages         DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_stats   DISABLE ROW LEVEL SECURITY;
