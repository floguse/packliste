-- ============================================================
-- Packliste – Teilweises Abhaken + Admin-Rollenverwaltung
-- Im Supabase SQL-Editor ausführen.
-- ============================================================

-- Neue Spalte: wie viele Stück bereits eingepackt sind
ALTER TABLE trip_items
  ADD COLUMN IF NOT EXISTS packed_count INTEGER NOT NULL DEFAULT 0 CHECK (packed_count >= 0);

-- Backfill: bereits gepackte Artikel auf volle Menge setzen
UPDATE trip_items SET packed_count = quantity WHERE packed = true AND packed_count = 0;

-- Admins dürfen Rollen anderer Mitglieder ändern
DROP POLICY IF EXISTS "admin update members" ON household_members;
CREATE POLICY "admin update members" ON household_members FOR UPDATE
  USING (is_household_admin(household_id));
