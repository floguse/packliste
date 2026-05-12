-- ============================================================
-- Packliste – Anzeigenamen (Display Names)
-- Im Supabase SQL-Editor ausführen.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Eigenes Profil: vollständig verwalten
DROP POLICY IF EXISTS "manage own profile" ON profiles;
CREATE POLICY "manage own profile" ON profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Profile von Mitgliedern des eigenen Haushalts lesen
DROP POLICY IF EXISTS "view household profiles" ON profiles;
CREATE POLICY "view household profiles" ON profiles FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1
      FROM household_members hm_self
      JOIN household_members hm_other ON hm_self.household_id = hm_other.household_id
      WHERE hm_self.user_id = auth.uid()
        AND hm_other.user_id = profiles.user_id
    )
  );
