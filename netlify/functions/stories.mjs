// StoryWeave API (Netlify Functions v2 + Netlify Blobs)
//   GET    /api/stories          -> { stories: [...] }   public
//   POST   /api/stories          -> { story }            needs x-dev-password
//   DELETE /api/stories?id=<id>  -> { ok: true }         needs x-dev-password
//   POST   /api/auth             -> { ok: true }         checks x-dev-password
// The password lives in the DEV_PASSWORD environment variable on Netlify,
// never in the page source.
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";

export const config = { path: ["/api/stories", "/api/auth"] };

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const sha = (s) => createHash("sha256").update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function guard(req) {
  const expected = Netlify.env.get("DEV_PASSWORD");
  if (!expected) return json({ error: "DEV_PASSWORD is not set on the server." }, 500);
  const given = req.headers.get("x-dev-password") || "";
  if (timingSafeEqual(sha(given), sha(expected))) return null;
  await sleep(700); // slows down password guessing
  return json({ error: "Wrong password." }, 401);
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function validate(b) {
  if (!b || typeof b !== "object") return { error: "Invalid request body." };
  const title = str(b.title, 90), author = str(b.author, 70), genre = str(b.genre, 30);
  const summary = str(b.summary, 400), cover = str(b.cover, 500);
  if (!title || !author || !genre || !summary) return { error: "Title, author, genre and summary are required." };
  if (cover && !/^https?:\/\//i.test(cover)) return { error: "Cover image must be an http(s) link." };
  if (!Array.isArray(b.chapters) || b.chapters.length < 1 || b.chapters.length > 200) {
    return { error: "Provide between 1 and 200 chapters." };
  }
  const chapters = [];
  let total = 0;
  for (const c of b.chapters) {
    const text = typeof c?.text === "string" ? c.text.trim() : "";
    if (!text) continue;
    total += text.length;
    chapters.push({ title: str(c.title, 120) || `Chapter ${chapters.length + 1}`, text });
  }
  if (!chapters.length) return { error: "The story text is empty." };
  if (total > 500000) return { error: "The story is too long (500,000 characters max)." };
  return { value: { title, author, genre, summary, cover, chapters } };
}

export default async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/auth") {
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
    return (await guard(req)) || json({ ok: true });
  }

  const store = getStore({ name: "stories", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "story-" });
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)));
    const stories = items.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    return json({ stories });
  }

  if (req.method === "POST") {
    const denied = await guard(req);
    if (denied) return denied;
    if (Number(req.headers.get("content-length") || 0) > 1_500_000) return json({ error: "Request too large." }, 413);
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    const result = validate(body);
    if (result.error) return json({ error: result.error }, 400);
    const id = "u-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
    const story = { id, ...result.value, createdAt: Date.now() };
    await store.setJSON("story-" + id, story);
    return json({ story }, 201);
  }

  if (req.method === "DELETE") {
    const denied = await guard(req);
    if (denied) return denied;
    const id = url.searchParams.get("id") || "";
    if (!/^u-[a-z0-9-]+$/.test(id)) return json({ error: "Invalid story id." }, 400);
    await store.delete("story-" + id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
};
