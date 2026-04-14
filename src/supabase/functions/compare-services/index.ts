import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',')[0].trim(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { serviceIds } = await req.json();

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length < 2 || serviceIds.length > 3) {
      return new Response(
        JSON.stringify({ error: 'Please provide 2-3 service IDs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch services data
    const { data: services, error: servicesError } = await supabaseClient
      .from('web_services')
      .select('*')
      .in('id', serviceIds);

    if (servicesError) throw servicesError;

    if (!services || services.length !== serviceIds.length) {
      return new Response(
        JSON.stringify({ error: 'One or more services not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent test results for each service (match by base_url)
    const testResultsPromises = services.map(async (service: any) => {
      const serviceUrl = service.base_url || service.docs_url;
      if (!serviceUrl) return { serviceId: service.id, tests: [] };
      const { data, error } = await supabaseClient
        .from('tests')
        .select('latency, throughput, uptime, success_rate, created_at, service_url')
        .eq('service_url', serviceUrl)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return { serviceId: service.id, tests: data || [] };
    });

    const testResults = await Promise.all(testResultsPromises);

    // Build comparison data
    const comparison = services.map((service: any) => {
      const tests = testResults.find((t) => t.serviceId === service.id)?.tests || [];
      
      const avgLatency = tests.length > 0
        ? tests.reduce((sum: number, t: any) => sum + (t.latency || 0), 0) / tests.length
        : service.avg_latency || service.base_latency_estimate || 0;

      const avgThroughput = tests.length > 0
        ? tests.reduce((sum: number, t: any) => sum + (t.throughput || 0), 0) / tests.length
        : 0;

      const avgSuccessRate = tests.length > 0
        ? tests.reduce((sum: number, t: any) => sum + (t.success_rate || 0), 0) / tests.length
        : 100;

      const avgUptime = tests.length > 0
        ? tests.reduce((sum: number, t: any) => sum + (t.uptime || 0), 0) / tests.length
        : service.availability_score || 0;

      const avgErrorRate = 100 - avgSuccessRate;

      return {
        id: service.id,
        name: service.service_name || service.name,
        category: service.category,
        description: service.description,
        avg_rating: service.avg_rating || 0,
        total_ratings: service.total_ratings || 0,
        metrics: {
          latency: Math.round(avgLatency),
          throughput: Math.round(avgThroughput * 100) / 100,
          errorRate: Math.round(avgErrorRate * 100) / 100,
          successRate: Math.round(avgSuccessRate * 100) / 100,
          uptime: Math.round(avgUptime * 100) / 100,
        },
        recentTests: tests.length,
      };
    });

    // Calculate best performers
    const bestLatency = comparison.reduce((min: any, s: any) => 
      s.metrics.latency < min.metrics.latency ? s : min
    );
    const bestRating = comparison.reduce((max: any, s: any) => 
      s.avg_rating > max.avg_rating ? s : max
    );
    const bestThroughput = comparison.reduce((max: any, s: any) => 
      s.metrics.throughput > max.metrics.throughput ? s : max
    );

    return new Response(
      JSON.stringify({
        success: true,
        comparison,
        insights: {
          bestLatency: bestLatency.name,
          bestRating: bestRating.name,
          bestThroughput: bestThroughput.name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Comparison error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

