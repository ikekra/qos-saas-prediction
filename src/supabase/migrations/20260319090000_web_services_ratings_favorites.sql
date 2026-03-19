-- Web services ratings + favorites and aggregate stats

ALTER TABLE public.web_services
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.web_service_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.web_services(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.web_service_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.web_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_id)
);

ALTER TABLE public.web_service_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_service_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_service_ratings_owner_select" ON public.web_service_ratings;
DROP POLICY IF EXISTS "web_service_ratings_owner_insert" ON public.web_service_ratings;
DROP POLICY IF EXISTS "web_service_ratings_owner_update" ON public.web_service_ratings;
DROP POLICY IF EXISTS "web_service_ratings_owner_delete" ON public.web_service_ratings;

CREATE POLICY "web_service_ratings_owner_select"
  ON public.web_service_ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "web_service_ratings_owner_insert"
  ON public.web_service_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "web_service_ratings_owner_update"
  ON public.web_service_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "web_service_ratings_owner_delete"
  ON public.web_service_ratings FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_service_favorites_owner_select" ON public.web_service_favorites;
DROP POLICY IF EXISTS "web_service_favorites_owner_insert" ON public.web_service_favorites;
DROP POLICY IF EXISTS "web_service_favorites_owner_delete" ON public.web_service_favorites;

CREATE POLICY "web_service_favorites_owner_select"
  ON public.web_service_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "web_service_favorites_owner_insert"
  ON public.web_service_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "web_service_favorites_owner_delete"
  ON public.web_service_favorites FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_service_ratings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.web_service_favorites TO authenticated;

CREATE OR REPLACE FUNCTION public.update_web_service_rating_stats()
RETURNS TRIGGER AS $$
DECLARE
  sid UUID := COALESCE(NEW.service_id, OLD.service_id);
BEGIN
  UPDATE public.web_services
  SET
    avg_rating = COALESCE((SELECT AVG(rating) FROM public.web_service_ratings WHERE service_id = sid), 0),
    total_ratings = COALESCE((SELECT COUNT(*) FROM public.web_service_ratings WHERE service_id = sid), 0)
  WHERE id = sid;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_web_service_rating_stats ON public.web_service_ratings;
CREATE TRIGGER update_web_service_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON public.web_service_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_web_service_rating_stats();
