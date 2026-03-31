export const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",")[0].trim(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

