import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = "https://publicapis.io";
const DIRECTORY_PATH = "/api-directory";
const MAX_IMPORT = 1500;
const BATCH_SIZE = 200;
const DETAIL_CONCURRENCY = 6;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

const cleanText = (value) => {
  if (!value || typeof value !== "string") return null;
  const text = value.replace(/[^\x00-\x7F]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length ? text : null;
};

const toTitleCase = (value) =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const decodeHtml = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const extractFromAnchors = (html) => {
  const anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const byHref = new Map();
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    if (!/^\/[a-z0-9-]+-api\/?$/i.test(href)) continue;

    const raw = match[2].replace(/<[^>]+>/g, " ");
    const text = cleanText(decodeHtml(raw));
    if (!text) continue;

    const list = byHref.get(href) || [];
    list.push(text);
    byHref.set(href, list);
  }

  return [...byHref.entries()].map(([href, texts]) => ({ href, texts }));
};

const normalizeEntries = (entries) => {
  const seen = new Set();
  const normalized = [];

  for (const entry of entries) {
    const name = cleanText(entry.name);
    const category = cleanText(entry.category);
    const description = cleanText(entry.description);
    const provider = cleanText(entry.provider) || name;
    const logoUrl = cleanText(entry.logo_url);

    if (!name || !category || !description || !provider) continue;

    const key = `${name.toLowerCase()}::${provider.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      name,
      provider,
      category,
      description,
      logo_url: logoUrl,
      is_active: true,
      tags: [],
      detail_path: entry.detail_path || null,
    });

    if (normalized.length >= MAX_IMPORT) break;
  }

  return normalized;
};

const fetchPage = async (path) => {
  const url = `${SOURCE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "QoSCollab Sync Bot (contact: admin@example.com)",
    },
  });
  if (!response.ok) {
    return null;
  }
  return response.text();
};

const extractCategoryLinks = (html) => {
  const regex = /href="(\/category\/[^"]+)"/gi;
  const links = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.add(match[1]);
  }
  return [...links];
};

const slugToCategory = (slug) => {
  const raw = slug
    .replace("/category/", "")
    .replace(/\/$/, "")
    .replace(/-/g, " ");
  return toTitleCase(raw.replace(/\band\b/gi, "&"));
};

const stripCategorySuffix = (nameText, category) => {
  const normalizedCategory = category.trim();
  const altCategory = normalizedCategory.replace("&", "and");
  if (nameText.endsWith(` ${normalizedCategory}`)) {
    return nameText.slice(0, -normalizedCategory.length).trim();
  }
  if (nameText.endsWith(` ${altCategory}`)) {
    return nameText.slice(0, -altCategory.length).trim();
  }
  return nameText.trim();
};

const htmlToText = (html) => {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = decodeHtml(withoutScripts.replace(/<[^>]+>/g, " "));
  return cleanText(text) || "";
};

const extractExternalLinks = (html) => {
  const anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    if (!/^https?:\/\//i.test(href)) continue;
    if (href.includes("publicapis.io")) continue;
    const labelRaw = match[2].replace(/<[^>]+>/g, " ");
    const label = cleanText(decodeHtml(labelRaw)) || "";
    links.push({ href, label });
  }
  return links;
};

const extractJsonUrls = (html) => {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    const urls = [];
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "string") {
        if (/^https?:\/\//i.test(node) && !node.includes("publicapis.io")) {
          urls.push(node);
        }
        return;
      }
      if (typeof node === "object") {
        Object.values(node).forEach(walk);
      }
    };
    walk(data);
    return urls;
  } catch {
    return [];
  }
};

const pickUrls = (html) => {
  const links = extractExternalLinks(html);
  const jsonUrls = extractJsonUrls(html).map((href) => ({ href, label: "" }));
  const merged = [...links, ...jsonUrls];
  const docLink = merged.find((l) => /doc|documentation|reference|swagger|openapi/i.test(l.label || l.href));
  const visitLink = merged.find((l) => /website|home|visit|api/i.test(l.label || l.href));
  const baseUrl = (visitLink || merged[0])?.href || null;
  const docsUrl = (docLink || merged[1])?.href || null;
  return { base_url: baseUrl, docs_url: docsUrl };
};

const extractRichDescription = (html, fallback) => {
  const text = htmlToText(html);
  const marker = "Documentation & Examples";
  const startIdx = text.indexOf(marker);
  const slice = startIdx >= 0 ? text.slice(startIdx + marker.length) : text;
  const cleaned = slice.replace(/Everything you need to integrate with[^.]*\./i, "").trim();
  const stops = ["Security Assessment", "30-Day Uptime History", "Enterprise Sponsors", "Featured Partners", "Related APIs"];
  let endIdx = cleaned.length;
  for (const stop of stops) {
    const idx = cleaned.indexOf(stop);
    if (idx > 0 && idx < endIdx) endIdx = idx;
  }
  const candidate = cleaned.slice(0, endIdx).trim();
  if (candidate && candidate.length > 60) {
    return candidate.slice(0, 800).trim();
  }
  return fallback;
};

const fetchAllEntries = async () => {
  const directoryHtml = await fetchPage(DIRECTORY_PATH);
  if (!directoryHtml) return [];
  const categoryLinks = extractCategoryLinks(directoryHtml);
  const merged = [];

  for (const link of categoryLinks) {
    if (merged.length >= MAX_IMPORT) break;
    const category = slugToCategory(link);
    const categoryHtml = await fetchPage(link);
    if (!categoryHtml) {
      console.log(`Skipping category (404): ${link}`);
      continue;
    }
    const anchorEntries = extractFromAnchors(categoryHtml);
    for (const entry of anchorEntries) {
      if (merged.length >= MAX_IMPORT) break;
      const texts = entry.texts;
      if (!texts || texts.length < 2) continue;
      const nameCandidate = texts[0];
      const descriptionCandidate = texts[1];
      if (!nameCandidate || !descriptionCandidate) continue;

      const name = stripCategorySuffix(nameCandidate, category);
      merged.push({
        name,
        category,
        description: descriptionCandidate,
        provider: name,
        logo_url: null,
        detail_path: entry.href,
      });
    }
  }

  const normalized = normalizeEntries(merged).slice(0, MAX_IMPORT);
  return normalized;
};

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
};

const upsertBatch = async (rows) => {
  const { error } = await supabase
    .from("web_services")
    .upsert(rows, { onConflict: "name,provider" });
  if (error) throw error;
};

const main = async () => {
  let entries = await fetchAllEntries();
  if (entries.length === 0) {
    console.log("No entries found.");
    return;
  }

  entries = await mapWithConcurrency(entries, DETAIL_CONCURRENCY, async (entry, idx) => {
    if (!entry.detail_path) return entry;
    try {
      const detailHtml = await fetchPage(entry.detail_path);
      if (!detailHtml) return entry;
      const rich = extractRichDescription(detailHtml, entry.description);
      const urls = pickUrls(detailHtml);
      return { ...entry, description: rich, ...urls };
    } catch (error) {
      console.log(`Detail fetch failed (${idx + 1}/${entries.length}):`, error?.message || error);
      return entry;
    }
  });

  entries = entries.map(({ detail_path, ...rest }) => rest);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }

  console.log(`Sync complete. Imported ${entries.length} entries.`);
};

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
