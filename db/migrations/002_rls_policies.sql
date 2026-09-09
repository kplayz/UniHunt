-- 002_rls_policies.sql
-- Row-Level Security (RLS) policies for per-user shortlists

-- Enable RLS on `shortlists` and `shortlist_items`
ALTER TABLE IF EXISTS shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shortlist_items ENABLE ROW LEVEL SECURITY;

-- Ensure only authenticated users can access rows (role: authenticated)
-- Policy: users can SELECT/INSERT/UPDATE/DELETE only on their own shortlists

CREATE POLICY IF NOT EXISTS "Users can manage their own shortlists" ON shortlists
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- For shortlist_items, ensure the parent shortlist belongs to the user
CREATE POLICY IF NOT EXISTS "Users can manage items in their shortlists" ON shortlist_items
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM shortlists s WHERE s.id = shortlist_items.shortlist_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shortlists s WHERE s.id = shortlist_items.shortlist_id AND s.user_id = auth.uid()));

-- Important: when using these policies, ensure you set up Supabase Auth and map `auth.uid()` correctly.
-- Also create appropriate indexes on `shortlists(user_id)` for performance.

CREATE INDEX IF NOT EXISTS idx_shortlists_user_id ON shortlists(user_id);
