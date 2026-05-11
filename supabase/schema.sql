-- ============================================================
-- Packliste – Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE households (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE household_members (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

CREATE TABLE invitations (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email        TEXT,
  token        UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_types (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL
);

CREATE TABLE categories (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER DEFAULT 0
);

CREATE TABLE items (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER DEFAULT 0
);

CREATE TABLE trips (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  trip_type_id UUID REFERENCES trip_types(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'packing', 'done')),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_items (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_id   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id   UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity  INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  packed    BOOLEAN NOT NULL DEFAULT FALSE,
  packed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  packed_at TIMESTAMPTZ
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items        ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER avoids RLS recursion)

CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM household_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_household_member(p_household_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_household_admin(p_household_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- households
CREATE POLICY "view own household"   ON households FOR SELECT USING (is_household_member(id));
CREATE POLICY "create household"     ON households FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin update"         ON households FOR UPDATE USING (is_household_admin(id));

-- household_members
CREATE POLICY "view members"         ON household_members FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "insert self"          ON household_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin or self delete" ON household_members FOR DELETE
  USING (user_id = auth.uid() OR is_household_admin(household_id));

-- invitations (admins manage; SECURITY DEFINER RPCs handle token acceptance)
CREATE POLICY "admin manage invites" ON invitations FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "member view invites"  ON invitations FOR SELECT USING (is_household_member(household_id));

-- trip_types
CREATE POLICY "member all trip_types" ON trip_types FOR ALL USING (is_household_member(household_id));

-- categories
CREATE POLICY "member all categories" ON categories FOR ALL USING (is_household_member(household_id));

-- items
CREATE POLICY "member all items" ON items FOR ALL USING (is_household_member(household_id));

-- trips
CREATE POLICY "member all trips" ON trips FOR ALL USING (is_household_member(household_id));

-- trip_items  (join through trips for household check)
CREATE POLICY "member all trip_items" ON trip_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = trip_id AND is_household_member(t.household_id)
  ));

-- ============================================================
-- RPC: get invitation info (no auth required – needed for invite page)
-- ============================================================
CREATE OR REPLACE FUNCTION get_invitation_info(p_token UUID)
RETURNS TABLE(household_id UUID, household_name TEXT, valid BOOLEAN)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT h.id, h.name, (i.status = 'pending')
  FROM invitations i
  JOIN households h ON h.id = i.household_id
  WHERE i.token = p_token
  LIMIT 1;
$$;

-- ============================================================
-- RPC: accept invitation (must be authenticated)
-- ============================================================
CREATE OR REPLACE FUNCTION accept_invitation(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id UUID;
  v_invitation_id UUID;
BEGIN
  -- Validate token
  SELECT id, household_id INTO v_invitation_id, v_household_id
  FROM invitations
  WHERE token = p_token AND status = 'pending'
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already used invitation token';
  END IF;

  -- Idempotent: already a member → just return household id
  IF EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = v_household_id AND user_id = auth.uid()
  ) THEN
    RETURN v_household_id;
  END IF;

  -- Add member
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (v_household_id, auth.uid(), 'member');

  -- Mark invitation as accepted
  UPDATE invitations SET status = 'accepted' WHERE id = v_invitation_id;

  RETURN v_household_id;
END;
$$;

-- ============================================================
-- RPC: seed default data for a new household
-- ============================================================
CREATE OR REPLACE FUNCTION seed_household_data(p_household_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_kleidung       UUID;
  v_sport          UUID;
  v_wandern        UUID;
  v_strand         UUID;
  v_arbeit         UUID;
  v_arbeitskleidung UUID;
  v_medizin        UUID;
  v_hygiene        UUID;
  v_dokumente      UUID;
  v_elektronik     UUID;
BEGIN
  -- Guard: only seed if no categories exist yet
  IF EXISTS (SELECT 1 FROM categories WHERE household_id = p_household_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Trip types
  INSERT INTO trip_types (household_id, name) VALUES
    (p_household_id, 'Urlaub'),
    (p_household_id, 'Dienstreise'),
    (p_household_id, 'Langes Wochenende'),
    (p_household_id, 'Tagesausflug'),
    (p_household_id, 'Städtetrip');

  -- Categories
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Kleidung', 1)       RETURNING id INTO v_kleidung;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Sport', 2)          RETURNING id INTO v_sport;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Wandern', 3)        RETURNING id INTO v_wandern;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Strand', 4)         RETURNING id INTO v_strand;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Arbeit', 5)         RETURNING id INTO v_arbeit;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Arbeitskleidung', 6) RETURNING id INTO v_arbeitskleidung;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Medizin', 7)        RETURNING id INTO v_medizin;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Hygiene', 8)        RETURNING id INTO v_hygiene;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Dokumente', 9)      RETURNING id INTO v_dokumente;
  INSERT INTO categories (household_id, name, sort_order) VALUES (p_household_id, 'Elektronik', 10)    RETURNING id INTO v_elektronik;

  -- Items: Kleidung
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_kleidung, p_household_id, 'T-Shirt', 1),
    (v_kleidung, p_household_id, 'Hemd', 2),
    (v_kleidung, p_household_id, 'Hose', 3),
    (v_kleidung, p_household_id, 'Unterwäsche', 4),
    (v_kleidung, p_household_id, 'Socken', 5),
    (v_kleidung, p_household_id, 'Pullover', 6),
    (v_kleidung, p_household_id, 'Jacke', 7),
    (v_kleidung, p_household_id, 'Pyjama', 8);

  -- Items: Sport
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_sport, p_household_id, 'Sportschuhe', 1),
    (v_sport, p_household_id, 'Sporttrikot', 2),
    (v_sport, p_household_id, 'Sporthose', 3),
    (v_sport, p_household_id, 'Handtuch', 4),
    (v_sport, p_household_id, 'Trinkflasche', 5);

  -- Items: Wandern
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_wandern, p_household_id, 'Wanderschuhe', 1),
    (v_wandern, p_household_id, 'Wanderstöcke', 2),
    (v_wandern, p_household_id, 'Regenjacke', 3),
    (v_wandern, p_household_id, 'Rucksack', 4),
    (v_wandern, p_household_id, 'Stirnlampe', 5);

  -- Items: Strand
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_strand, p_household_id, 'Badehose/Bikini', 1),
    (v_strand, p_household_id, 'Sonnencreme', 2),
    (v_strand, p_household_id, 'Sonnenbrille', 3),
    (v_strand, p_household_id, 'Strandhandtuch', 4),
    (v_strand, p_household_id, 'Flip-Flops', 5);

  -- Items: Arbeit
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_arbeit, p_household_id, 'Laptop', 1),
    (v_arbeit, p_household_id, 'Ladekabel', 2),
    (v_arbeit, p_household_id, 'Maus', 3),
    (v_arbeit, p_household_id, 'Notizbuch', 4),
    (v_arbeit, p_household_id, 'Kugelschreiber', 5);

  -- Items: Arbeitskleidung
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_arbeitskleidung, p_household_id, 'Anzug/Blazer', 1),
    (v_arbeitskleidung, p_household_id, 'Krawatte', 2),
    (v_arbeitskleidung, p_household_id, 'Businesshemd', 3),
    (v_arbeitskleidung, p_household_id, 'Businessschuhe', 4);

  -- Items: Medizin
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_medizin, p_household_id, 'Schmerzmittel', 1),
    (v_medizin, p_household_id, 'Pflaster', 2),
    (v_medizin, p_household_id, 'Reiseapotheke', 3),
    (v_medizin, p_household_id, 'Persönliche Medikamente', 4);

  -- Items: Hygiene
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_hygiene, p_household_id, 'Zahnbürste', 1),
    (v_hygiene, p_household_id, 'Zahnpasta', 2),
    (v_hygiene, p_household_id, 'Deo', 3),
    (v_hygiene, p_household_id, 'Shampoo', 4),
    (v_hygiene, p_household_id, 'Rasierer', 5);

  -- Items: Dokumente
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_dokumente, p_household_id, 'Reisepass', 1),
    (v_dokumente, p_household_id, 'Personalausweis', 2),
    (v_dokumente, p_household_id, 'Kreditkarte', 3),
    (v_dokumente, p_household_id, 'Versicherungskarte', 4),
    (v_dokumente, p_household_id, 'Buchungsunterlagen', 5);

  -- Items: Elektronik
  INSERT INTO items (category_id, household_id, name, sort_order) VALUES
    (v_elektronik, p_household_id, 'Handy-Ladekabel', 1),
    (v_elektronik, p_household_id, 'Powerbank', 2),
    (v_elektronik, p_household_id, 'Kopfhörer', 3),
    (v_elektronik, p_household_id, 'Reiseadapter', 4);

END;
$$;

-- ============================================================
-- Realtime: enable for live packing sync
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trip_items;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
