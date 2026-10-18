-- Ensure qos_predictions.user_id auto-attaches from auth.uid()
CREATE OR REPLACE FUNCTION public.set_qos_predictions_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_qos_predictions_user_id ON public.qos_predictions;
CREATE TRIGGER set_qos_predictions_user_id
  BEFORE INSERT ON public.qos_predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_qos_predictions_user_id();
