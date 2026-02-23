import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sampleServices = [
  {
    name: 'Postman Echo API',
    category: 'API',
    base_url: 'https://postman-echo.com/get',
    description: 'A simple API testing service that echoes the data sent to it',
    tags: ['testing', 'echo', 'api', 'development'],
  },
  {
    name: 'JSONPlaceholder',
    category: 'API',
    base_url: 'https://jsonplaceholder.typicode.com/posts/1',
    description: 'Free fake API for testing and prototyping',
    tags: ['testing', 'fake-data', 'rest', 'json'],
  },
  {
    name: 'Cloudflare CDN',
    category: 'CDN',
    base_url: 'https://cloudflare.com',
    description: 'Global content delivery network and DDoS protection',
    tags: ['cdn', 'performance', 'security', 'ddos'],
  },
  {
    name: 'GitHub API',
    category: 'API',
    base_url: 'https://api.github.com',
    description: 'Access GitHub data through their REST API',
    tags: ['github', 'version-control', 'api', 'development'],
  },
  {
    name: 'Supabase Storage',
    category: 'Storage',
    base_url: 'https://supabase.com',
    description: 'Open source Firebase alternative with PostgreSQL',
    tags: ['storage', 'database', 'backend', 'postgres'],
  },
  {
    name: 'Auth0 Authentication',
    category: 'Auth',
    base_url: 'https://auth0.com',
    description: 'Flexible authentication and authorization platform',
    tags: ['auth', 'oauth', 'security', 'identity'],
  },
  {
    name: 'Vercel Edge Network',
    category: 'CDN',
    base_url: 'https://vercel.com',
    description: 'Global edge network for fast deployments',
    tags: ['cdn', 'edge', 'deployment', 'serverless'],
  },
  {
    name: 'Stripe API',
    category: 'API',
    base_url: 'https://api.stripe.com',
    description: 'Payment processing API for online businesses',
    tags: ['payments', 'api', 'fintech', 'checkout'],
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if services already exist
    const { data: existingServices, error: checkError } = await supabaseClient
      .from('services')
      .select('name')
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    // Only seed if no services exist
    if (existingServices && existingServices.length === 0) {
      console.log('Seeding sample services...');

      const { data, error } = await supabaseClient
        .from('services')
        .insert(sampleServices)
        .select();

      if (error) {
        throw error;
      }

      console.log(`Seeded ${data.length} services successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Seeded ${data.length} sample services`,
          services: data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Services already exist, skipping seed',
          count: existingServices?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Seeding failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
