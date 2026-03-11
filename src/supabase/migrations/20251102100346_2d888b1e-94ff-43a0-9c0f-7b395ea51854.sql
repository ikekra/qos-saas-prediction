-- Create tests table for storing QoS test results
CREATE TABLE public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_url TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('latency', 'load', 'uptime', 'throughput')),
  latency NUMERIC,
  uptime NUMERIC,
  throughput NUMERIC,
  success_rate NUMERIC,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tests"
ON public.tests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tests"
ON public.tests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tests"
ON public.tests
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_tests_user_id ON public.tests(user_id);
CREATE INDEX idx_tests_created_at ON public.tests(created_at DESC);