CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE(id uuid, username text, name text, avatar_url text, xp integer, streak_days integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.name, p.avatar_url, p.xp, p.streak_days
  FROM public.profiles p
  WHERE length(trim(_q)) >= 2
    AND p.id <> auth.uid()
    AND (
      p.username ILIKE '%' || replace(replace(trim(_q), '%', '\%'), '_', '\_') || '%'
      OR p.name ILIKE '%' || replace(replace(trim(_q), '%', '\%'), '_', '\_') || '%'
    )
  ORDER BY p.username
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.trim_nutrition_scans()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.nutrition_scans s
  WHERE s.user_id = NEW.user_id
    AND s.id NOT IN (
      SELECT id FROM public.nutrition_scans
      WHERE user_id = NEW.user_id
      ORDER BY scanned_at DESC
      LIMIT 5
    );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trim_nutrition_scans_trg ON public.nutrition_scans;
CREATE TRIGGER trim_nutrition_scans_trg
AFTER INSERT ON public.nutrition_scans
FOR EACH ROW EXECUTE FUNCTION public.trim_nutrition_scans();