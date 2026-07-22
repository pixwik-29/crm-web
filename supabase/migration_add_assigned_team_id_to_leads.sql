-- Migration: Complete Teams & Lead Assignment Setup
-- Run this in your Supabase SQL Editor

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create team_members junction table
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (team_id, profile_id)
);

-- 3. Add assigned_team_id to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 4. Add routing columns to campaign_configurations
ALTER TABLE public.campaign_configurations 
ADD COLUMN IF NOT EXISTS assignment_target_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS assignment_targets JSONB DEFAULT '[]';

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
DROP POLICY IF EXISTS "Allow tenant members to manage teams" ON public.teams;
CREATE POLICY "Allow tenant members to manage teams" 
ON public.teams FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow tenant members to manage team_members" ON public.team_members;
CREATE POLICY "Allow tenant members to manage team_members" 
ON public.team_members FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
