const resolveAllowedOrigin = (req?: Request) => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080";
  const allowed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowed.includes("*")) return "*";
  if (!req) return allowed[0] ?? "*";

  const requestOrigin = req?.headers.get("origin")?.trim();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;

  // In development, if no match, allow the request origin anyway
  if (requestOrigin && (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1"))) {
    return requestOrigin;
  }

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
