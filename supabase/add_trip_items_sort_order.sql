-- Fügt sort_order zu trip_items hinzu für reisespezifische Reihenfolge
-- Im Supabase SQL-Editor ausführen

ALTER TABLE trip_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
