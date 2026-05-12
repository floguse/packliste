-- ============================================================
-- Packliste – Vorlagen-Feature
-- Run this in the Supabase SQL editor after the main schema.sql
-- ============================================================

CREATE TABLE trip_templates (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE template_items (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES trip_templates(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

ALTER TABLE trip_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member all trip_templates" ON trip_templates
  FOR ALL USING (is_household_member(household_id));

CREATE POLICY "member all template_items" ON template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trip_templates t
      WHERE t.id = template_id AND is_household_member(t.household_id)
    )
  );
