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

function googleBooksUrl(isbn: string): string {
  let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  if (GOOGLE_BOOKS_API_KEY) url += `&key=${GOOGLE_BOOKS_API_KEY}`;
  return url;
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
    description: typeof vi.description === "string" ? vi.description.trim() || null : null,
  };
}

async function fetchOpenLibraryPageCount(isbn: string): Promise<number | null> {
  try {
    const resp = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.number_of_pages || null;
  } catch {
    return null;
  }
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Extract ISBN from URL path: /isbn-lookup/9780123456789
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // Path is like /isbn-lookup/<isbn>
  const rawIsbn = segments[segments.length - 1];

  if (!rawIsbn || rawIsbn === "isbn-lookup") {
    return jsonResponse({ error: "ISBN parameter required" }, 400);
  }

  const isbn = rawIsbn.replace(/[\s-]/g, "");
  if (!isbn || !/^\d+$/.test(isbn)) {
    return jsonResponse(
      { error: "Invalid ISBN: must contain only digits" },
      400,
    );
  }

  // Fetch from Google Books
  const gbResp = await fetch(googleBooksUrl(isbn));
  if (!gbResp.ok) {
    const text = await gbResp.text();
    return jsonResponse(
      { error: `Google Books API error (${gbResp.status}): ${text}` },
      502,
    );
  }

  const gbData = await gbResp.json();
  const items = gbData.items ?? [];
  if (items.length === 0) {
    return jsonResponse({ error: "Book not found for this ISBN" }, 404);
  }

  const result = extractBook(items[0], isbn);

  // Patch missing page count from Open Library
  if (!result.number_of_pages) {
    const olPages = await fetchOpenLibraryPageCount(isbn);
    if (olPages) result.number_of_pages = olPages;
  }

  return jsonResponse(result);
});
