-- Fix: create_household_with_member
-- Legt Haushalt, Admin-Mitglied und Seed-Daten in einer einzigen
-- SECURITY DEFINER-Funktion an (kein RLS-Problem beim Zurücklesen).
-- Im Supabase SQL-Editor ausführen.

CREATE OR REPLACE FUNCTION create_household_with_member(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id UUID;
BEGIN
  INSERT INTO households (name, created_by)
  VALUES (p_name, auth.uid())
  RETURNING id INTO v_household_id;

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (v_household_id, auth.uid(), 'admin');

  PERFORM seed_household_data(v_household_id);

  RETURN v_household_id;
END;
$$;
