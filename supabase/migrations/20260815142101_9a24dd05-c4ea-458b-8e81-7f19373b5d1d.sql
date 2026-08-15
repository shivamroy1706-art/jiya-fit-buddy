CREATE TABLE IF NOT EXISTS public.step_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS step_logs_user_date_uniq ON public.step_logs(user_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.step_logs TO authenticated;
GRANT ALL ON public.step_logs TO service_role;

ALTER TABLE public.step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own step logs" ON public.step_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);