-- Add optional service reference to qos_predictions
ALTER TABLE public.qos_predictions
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.web_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qos_predictions_service_id
  ON public.qos_predictions (service_id);
