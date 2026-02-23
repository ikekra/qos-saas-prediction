import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keywords, type } = await req.json();

    // Keyword-based recommendations
    if (type === 'keywords' && keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const lowerKeywords = keywordArray.map((k: string) => k.toLowerCase());

      const { data: services, error } = await supabaseClient
        .from('services')
        .select('*');

      if (error) throw error;

      // Filter and score services based on keyword matches
      const scoredServices = services
        .map((service: any) => {
          let score = 0;
          let matchedKeywords: string[] = [];

          lowerKeywords.forEach((keyword) => {
            const nameLower = service.name.toLowerCase();
            const descLower = (service.description || '').toLowerCase();
            const categoryLower = (service.category || '').toLowerCase();
            const tags = service.tags || [];

            if (nameLower.includes(keyword)) {
              score += 5;
              matchedKeywords.push(keyword);
            }
            if (categoryLower.includes(keyword)) {
              score += 4;
              matchedKeywords.push(keyword);
            }
            if (descLower.includes(keyword)) {
              score += 3;
              matchedKeywords.push(keyword);
            }
            if (tags.some((tag: string) => tag.toLowerCase().includes(keyword))) {
              score += 4;
              matchedKeywords.push(keyword);
            }
          });

          return {
            ...service,
            score,
            reason: score > 0 
              ? `Keyword match: ${[...new Set(matchedKeywords)].join(', ')}`
              : null,
          };
        })
        .filter((s: any) => s.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      return new Response(
        JSON.stringify({ success: true, recommendations: scoredServices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User-based recommendations (collaborative + content-based)
    if (type === 'user') {
      // Get user's ratings
      const { data: userRatings, error: ratingsError } = await supabaseClient
        .from('ratings')
        .select('service_id, rating')
        .eq('user_id', user.id);

      if (ratingsError) throw ratingsError;

      // Get user's favorites
      const { data: userFavorites, error: favError } = await supabaseClient
        .from('user_favorites')
        .select('service_id')
        .eq('user_id', user.id);

      if (favError) throw favError;

      // Get user's test history
      const { data: userTests, error: testsError } = await supabaseClient
        .from('test_results')
        .select('service_id')
        .eq('user_id', user.id);

      if (testsError) throw testsError;

      const ratedServiceIds = new Set(userRatings?.map((r: any) => r.service_id) || []);
      const favoriteServiceIds = new Set(userFavorites?.map((f: any) => f.service_id) || []);
      const testedServiceIds = new Set(userTests?.map((t: any) => t.service_id) || []);

      // Get all services
      const { data: allServices, error: servicesError } = await supabaseClient
        .from('services')
        .select('*');

      if (servicesError) throw servicesError;

      // Score services based on user behavior
      const scoredServices = allServices
        .map((service: any) => {
          let score = 0;
          let reasons: string[] = [];

          // Don't recommend already rated highly
          const userRating = userRatings?.find((r: any) => r.service_id === service.id);
          if (userRating && userRating.rating >= 4) {
            return null; // Already satisfied with this service
          }

          // Boost services in same category as favorites
          const favoriteServices = allServices.filter((s: any) => 
            favoriteServiceIds.has(s.id)
          );
          favoriteServices.forEach((fav: any) => {
            if (fav.category === service.category && service.id !== fav.id) {
              score += 3;
              reasons.push('Similar to your favorites');
            }
          });

          // Boost high-rated services
          if (service.avg_rating >= 4) {
            score += 2;
            reasons.push('Highly rated by community');
          }

          // Boost low-latency services if user has tested services
          if (testedServiceIds.size > 0 && service.avg_latency < 200) {
            score += 2;
            reasons.push('High performance');
          }

          // Boost services not yet tested
          if (!testedServiceIds.has(service.id) && !ratedServiceIds.has(service.id)) {
            score += 1;
            reasons.push('New to explore');
          }

          return score > 0 ? {
            ...service,
            score,
            reason: reasons.join(', '),
          } : null;
        })
        .filter((s: any) => s !== null)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      return new Response(
        JSON.stringify({ success: true, recommendations: scoredServices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recommendation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
