import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractBook(item: Record<string, unknown>, isbn: string) {
  const vi = (item.volumeInfo ?? {}) as Record<string, unknown>;
  const authors = (vi.authors as string[]) ?? [];
  const publisher = vi.publisher as string | undefined;
  const imageLinks = (vi.imageLinks ?? {}) as Record<string, string>;
  let thumbnail = imageLinks.thumbnail ?? imageLinks.smallThumbnail ?? null;
  if (thumbnail?.startsWith("http:")) {
    thumbnail = "https:" + thumbnail.slice(5);
  }
  const categories = (vi.categories as string[]) ?? [];
  let pageCount = vi.pageCount as number | null;
  if (pageCount !== null && typeof pageCount !== "number") pageCount = null;

  return {
    isbn,
    title: (vi.title as string) ?? "Unknown",
    authors: authors.length ? authors : ["Unknown"],
    publishers: publisher ? [publisher] : [],
    publish_date: (vi.publishedDate as string) ?? null,
    number_of_pages: pageCount ?? null,
    cover_url: thumbnail,
    subjects: categories,
    description:
      typeof vi.description === "string"
        ? vi.description.trim() || null
        : null,
  };
}

function isbnFromGoogleItem(vi: Record<string, unknown>): string {
  const identifiers = (vi.industryIdentifiers ?? []) as Array<{
    type: string;
    identifier: string;
  }>;
  const isbn13 = identifiers.find((i) => i.type === "ISBN_13");
  if (isbn13) return isbn13.identifier;
  const isbn10 = identifiers.find((i) => i.type === "ISBN_10");
  return isbn10?.identifier ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify the user is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim() ?? "";
  const author = url.searchParams.get("author")?.trim() ?? "";

  if (!title && !author) {
    return jsonResponse(
      { error: "title or author query parameter is required" },
      400,
    );
  }

  const parts: string[] = [];
  if (title) parts.push(`intitle:${title}`);
  if (author) parts.push(`inauthor:${author}`);
  const q = parts.join("+");

  let searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`;
  if (GOOGLE_BOOKS_API_KEY) searchUrl += `&key=${GOOGLE_BOOKS_API_KEY}`;

  const resp = await fetch(searchUrl);
  if (!resp.ok) {
    const text = await resp.text();
    return jsonResponse(
      { error: `Google Books API error (${resp.status}): ${text}` },
      502,
    );
  }

  const data = await resp.json();
  const items = data.items ?? [];
  const results = items.map((item: Record<string, unknown>) => {
    const vi = (item.volumeInfo ?? {}) as Record<string, unknown>;
    const isbn = isbnFromGoogleItem(vi);
    return extractBook(item, isbn);
  });

  return jsonResponse(results);
});
