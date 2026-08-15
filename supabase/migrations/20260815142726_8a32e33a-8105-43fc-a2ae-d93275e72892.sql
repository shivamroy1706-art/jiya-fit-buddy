CREATE TABLE IF NOT EXISTS public.walk_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  path JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_m INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walk_routes_user_date_idx ON public.walk_routes(user_id, date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.walk_routes TO authenticated;
GRANT ALL ON public.walk_routes TO service_role;

ALTER TABLE public.walk_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own walk routes" ON public.walk_routes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);