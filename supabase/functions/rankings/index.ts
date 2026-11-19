// Public read API used by the website.
//   GET  /rankings                      -> categories + site-wide top 3
//   GET  /rankings?category=food        -> + that category (top 3 only, rest locked)
//   POST /rankings {category, email}    -> + full top 10 if email donated in the last UNLOCK_DAYS
// Ranks 4-10 never leave the server unless the email has a donation.
import { admin, cors, isEmail, json, normEmail } from "../_shared/util.ts";

const UNLOCK_DAYS = Number(Deno.env.get("UNLOCK_DAYS") ?? "30");
const FREE = 3;
const COLS = "rank, video_id, title, channel, thumbnail_url, url, view_count, daily_gain, scraped_at, category_id";

type Ad = { rank: number; video_id: string; view_count: number; scraped_at: string; category_id: string };

// keep only rows from each category's latest scrape (drops leftover ranks from older days)
function latestOnly<T extends Ad>(rows: T[]): T[] {
  const latest = new Map<string, string>();
  for (const r of rows) if ((latest.get(r.category_id) ?? "") < r.scraped_at) latest.set(r.category_id, r.scraped_at);
  // rows written in the same scrape share a transaction timestamp; allow 1 minute of slack
  return rows.filter((r) => Date.parse(latest.get(r.category_id)!) - Date.parse(r.scraped_at) < 60_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  let category = url.searchParams.get("category") ?? "";
  let email = "";
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    category = typeof b.category === "string" ? b.category : category;
    email = normEmail(b.email);
  }

  const db = admin();
  const [catsQ, adsQ] = await Promise.all([
    db.from("categories").select("id, name_th, name_en, emoji").order("sort_order"),
    db.from("ads").select(COLS).limit(1000),
  ]);
  if (catsQ.error || adsQ.error) return json({ error: "db" }, 500);
  const ads = latestOnly((adsQ.data ?? []) as (Ad & Record<string, unknown>)[]);

  // site-wide top 3, de-duplicated by video (same ad can rank in two categories)
  const seen = new Set<string>();
  const top3 = [...ads].sort((a, b) => b.view_count - a.view_count)
    .filter((a) => !seen.has(a.video_id) && seen.add(a.video_id)).slice(0, 3);

  const out: Record<string, unknown> = {
    categories: catsQ.data,
    top3,
    updatedAt: ads.reduce((m, a) => (a.scraped_at > m ? a.scraped_at : m), "") || null,
  };

  if (category) {
    let unlocked = false;
    if (email && isEmail(email)) {
      const since = new Date(Date.now() - UNLOCK_DAYS * 864e5).toISOString();
      const { count } = await db.from("donations").select("id", { count: "exact", head: true })
        .eq("email", email).gte("created_at", since);
      unlocked = (count ?? 0) > 0;
    }
    const rows = ads.filter((a) => a.category_id === category).sort((a, b) => a.rank - b.rank);
    out.category = { id: category, items: rows.slice(0, unlocked ? 10 : FREE), total: rows.length, unlocked, emailChecked: !!email };
  }

  return json(out, 200, { "Cache-Control": email ? "no-store" : "public, max-age=300" });
});
