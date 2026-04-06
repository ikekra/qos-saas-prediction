const resolveAllowedOrigin = (req?: Request) => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173";
  const allowed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowed.includes("*")) return "*";
  if (!req) return "*";

  const requestOrigin = req?.headers.get("origin")?.trim();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;

  return requestOrigin ?? allowed[0] ?? "*";
};

export const getCorsHeaders = (req?: Request) => ({
  "Access-Control-Allow-Origin": resolveAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

export const corsHeaders = getCorsHeaders();

export const jsonResponse = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
