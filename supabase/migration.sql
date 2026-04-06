-- DevScout Multi-Tenant Schema
-- Run this in Supabase SQL Editor

-- 1. User profiles (extends Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  linkedin_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Set admin by email
CREATE OR REPLACE FUNCTION set_admin_on_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'ccwhaley@gmail.com' THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_admin
  BEFORE INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_admin_on_create();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON user_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Shared prospect pool
CREATE TABLE prospects (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  company_lower TEXT GENERATED ALWAYS AS (lower(trim(company))) STORED,
  industry TEXT,
  size INTEGER,
  size_source TEXT,
  location TEXT,
  roles TEXT[] DEFAULT '{}',
  source TEXT,
  posted TEXT,
  match_score INTEGER DEFAULT 0,
  raw_match_score INTEGER,
  raw_nearshore_score INTEGER,
  nearshore_score INTEGER,
  nearshore_signals TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  linkedin_url TEXT,
  indeed_url TEXT,
  ziprecruiter_url TEXT,
  builtin_url TEXT,
  dice_url TEXT,
  recruiter_name TEXT,
  recruiter_title TEXT,
  recruiter_email TEXT,
  recruiter_linkedin_url TEXT,
  recruiter_photo_url TEXT,
  connection_status JSONB DEFAULT '{}',
  company_relationship TEXT,
  recruiter_relationship TEXT,
  scanned_by UUID REFERENCES auth.users(id),
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_lower)
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users read prospects" ON prospects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users insert prospects" ON prospects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users update prospects" ON prospects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users delete unclaimed" ON prospects FOR DELETE USING (
  auth.role() = 'authenticated' AND (claimed_by IS NULL OR claimed_by = auth.uid())
);

CREATE INDEX idx_prospects_company_lower ON prospects(company_lower);
CREATE INDEX idx_prospects_claimed_by ON prospects(claimed_by);

-- Atomic claim function
CREATE OR REPLACE FUNCTION claim_prospect(p_prospect_id INTEGER, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE prospects
  SET claimed_by = p_user_id, claimed_at = now(), updated_at = now()
  WHERE id = p_prospect_id AND claimed_by IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unclaim function
CREATE OR REPLACE FUNCTION unclaim_prospect(p_prospect_id INTEGER, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE prospects
  SET claimed_by = NULL, claimed_at = NULL, updated_at = now()
  WHERE id = p_prospect_id AND claimed_by = p_user_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  -- Also delete the sequence
  DELETE FROM sequences WHERE prospect_id = p_prospect_id AND user_id = p_user_id;
  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Sequences (one per prospect)
CREATE TABLE sequences (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  step TEXT NOT NULL DEFAULT 'researching',
  research TEXT,
  emails JSONB DEFAULT '[]',
  active_email INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  refresh_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prospect_id)
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users read sequences" ON sequences FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users manage own sequences" ON sequences FOR ALL USING (auth.uid() = user_id);

-- 4. API usage tracking
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  search_queries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "All users read team usage" ON api_usage FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, created_at);

-- 5. Outreach events (for dashboard)
CREATE TABLE outreach_events (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE SET NULL,
  sequence_id INTEGER REFERENCES sequences(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'sent', 'replied', 'opened', 'bounced'
  email_type TEXT,          -- 'intro', 'follow-up-1', 'follow-up-2'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE outreach_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users read events" ON outreach_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users insert own events" ON outreach_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_outreach_user ON outreach_events(user_id, created_at);
CREATE INDEX idx_outreach_type ON outreach_events(event_type);

-- Enable realtime for live cross-user updates
ALTER PUBLICATION supabase_realtime ADD TABLE prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE sequences;
ALTER PUBLICATION supabase_realtime ADD TABLE outreach_events;
