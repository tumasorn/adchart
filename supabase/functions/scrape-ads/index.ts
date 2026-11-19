// Daily job: for every category, ask a search engine (Brave Search video API)
// for ads, keep the 10 with the most views, and replace that category's rows
// (old data overwritten). Results come from any site the engine indexes
// (YouTube, TikTok, Facebook, Vimeo, news sites...), not one platform.
// Triggered by pg_cron (see migrations/002_cron.sql) with header x-cron-secret.
import { admin, json } from "../_shared/util.ts";

const BRAVE = "https://api.search.brave.com/res/v1/videos/search";
const KEY = Deno.env.get("BRAVE_API_KEY") ?? "";

type Row = {
  rank: number; video_id: string; title: string; channel: string;
  thumbnail_url: string; url: string; view_count: number;
};

// clips ABOUT ads rather than ads themselves (how-to remove pop-ups, ad-vs-reality, reactions)
const NOT_AD = /วิธี|ลบโฆษณา|บล็อก|ปิดโฆษณา|เด้ง|ป๊อปอัพ|ไวรัส|vs\.?\s*ความเป็นจริง|เทคนิค|ทริค|reaction|รีแอค|ดูโฆษณา|ต่างชาติ|ฝรั่ง|บทความ|แนะนำ|รีวิว|review|meme|illegal|สเปค|สอน|บอกต่อ|highlight|championship|qualifier|grand ?final|tournament|esports?|🔴|livestream|ไลฟ์สด|ถ่ายทอดสด|unboxing|แกะกล่อง|gameplay|^\s*\d+\s*(อันดับ|เกม|game)/i;

// "Official only": the channel name must contain a known brand (categories.brands, all rows
// unioned) and must not look like a fan / re-upload / news channel.
const NOT_OFFICIAL = /buzz|club|\bfans?\b|แฟน|tvc|โฆษณา|รวม|archive|retro|ย้อน|re-?upload|news|ข่าว|\btnn\b/i;
let OFFICIAL: RegExp | null = null;
const isOfficial = (channel: string) => !!OFFICIAL && OFFICIAL.test(channel) && !NOT_OFFICIAL.test(channel);

async function search(params: Record<string, string>) {
  const u = new URL(BRAVE);
  u.search = new URLSearchParams(params).toString();
  return fetch(u, { headers: { Accept: "application/json", "X-Subscription-Token": KEY } });
}

async function page(query: string, offset: number, freshness = ""): Promise<any[]> {
  const base: Record<string, string> = { q: query, count: "50", offset: String(offset) };
  if (freshness) base.freshness = freshness; // pd / pw / pm / py
  let r = await search({ ...base, safesearch: "strict", search_lang: "th", country: "ALL" });
  if (r.status === 422) r = await search(base); // unsupported lang/country → plain query
  if (!r.ok) throw new Error(`brave ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).results ?? [];
}

// `query` may hold several searches separated by ";" (max 4). Short brand searches
// find official channels best; results are merged, filtered, ranked.
// Current setup: 25 searches/day ≈ 750 requests/month (Brave free credit ≈ 1,000). Trending has no
// searches of its own (query ''); it ranks the snapshot pool built by the other categories.
async function topTen(query: string, match: string | null, freshness = "") {
  // category keyword check: the search engine pads weak matches with unrelated ads
  const fits = match ? new RegExp(match, "i") : null;
  const all: any[] = [];
  for (const q of query.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 4)) {
    all.push(...(await page(q, 0, freshness)));
    await new Promise((ok) => setTimeout(ok, 1100)); // stay under 1 request/second
  }
  const pool = pick(all, fits).map(({ raw: _raw, ...x }) => x); // every official ad found (for trending)
  const top: Row[] = pool.slice(0, 10).map(({ published_at: _p, ...x }, i) => ({ ...x, rank: i + 1 }));
  return { top, pool };
}

// ---------- trending ("มาแรง"): views gained per day ----------
const TRENDING = "trending";
const bangkokDay = (offsetDays = 0) =>
  new Date(Date.now() + 7 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);

async function allRows(q: () => any) { // PostgREST returns at most 1000 rows per call
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function rankTrending(db: ReturnType<typeof admin>) {
  const today = bangkokDay(), since = bangkokDay(-8);
  const snaps = await allRows(() => db.from("view_snapshots")
    .select("video_id, day, view_count, title, channel, thumbnail_url, url, published_at, taken_at")
    .gte("day", since).order("day", { ascending: false }));
  const todayRows = snaps.filter((s) => s.day === today);
  const prevById = new Map<string, any>(); // latest earlier snapshot per video (rows are newest first)
  for (const s of snaps) if (s.day < today && !prevById.has(s.video_id)) prevById.set(s.video_id, s);

  const scored = todayRows.map((s) => {
    const prev = prevById.get(s.video_id);
    if (prev) {
      // real elapsed time between the two snapshots (at least 6 hours, so tiny gaps don't blow up)
      const days = Math.max(0.25, (Date.parse(s.taken_at) - Date.parse(prev.taken_at)) / 864e5);
      return { s, gain: Math.round((s.view_count - prev.view_count) / days) };
    }
    // no history yet: average views/day since publish, only for recent ads (first days only)
    const ageDays = s.published_at ? (Date.now() - Date.parse(s.published_at)) / 864e5 : Infinity;
    return { s, gain: ageDays <= 60 ? Math.round(s.view_count / Math.max(1, ageDays)) : 0 };
  }).filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 10);

  const rows = scored.map(({ s, gain }, i) => ({
    rank: i + 1, video_id: s.video_id, title: s.title, channel: s.channel,
    thumbnail_url: s.thumbnail_url, url: s.url, view_count: s.view_count, daily_gain: gain,
  }));
  const { error } = await db.rpc("replace_category_ads", { p_category: "trending", p_rows: rows });
  if (error) throw error;
  await db.from("view_snapshots").delete().lt("day", bangkokDay(-14)); // keep 2 weeks of history
  return rows.length;
}

function pick(results: any[], fits: RegExp | null) {
  const seen = new Set<string>();
  return results
    .map((x) => ({
      video_id: x.url,
      // drop the " - YouTube" / " | TikTok" style suffix search engines append
      title: String(x.title ?? "").replace(/\s*[-|–]\s*(YouTube|TikTok|Facebook|Vimeo|Dailymotion)\s*$/i, "").trim(),
      channel: x.video?.creator ?? x.video?.publisher ?? x.meta_url?.hostname ?? "",
      thumbnail_url: x.thumbnail?.src ?? x.thumbnail?.original ?? "",
      url: x.url,
      view_count: Number(x.video?.views ?? 0),
      published_at: typeof x.page_age === "string" && !isNaN(Date.parse(x.page_age)) ? x.page_age : null,
      raw: x,
    }))
    .filter((x) => /^https:\/\//.test(x.url) && x.view_count > 0 && x.thumbnail_url && !NOT_AD.test(x.title) &&
      (!fits || fits.test(`${x.title} ${x.channel}`)) && isOfficial(x.channel) && !seen.has(x.url) && seen.add(x.url))
    .sort((a, b) => b.view_count - a.view_count);
}

// Tuning helper: per search, how many results came back and why each was dropped. Writes nothing.
async function dryRun(db: ReturnType<typeof admin>, id: string, queryOverride: string | null) {
  const { data: all } = await db.from("categories").select("id, query, match, brands");
  const cat = (all ?? []).find((c) => c.id === id);
  if (!cat) return json({ error: "no such category" }, 404);
  OFFICIAL = new RegExp((all ?? []).map((c) => c.brands).filter(Boolean).join("|"), "i");
  const fits = cat.match ? new RegExp(cat.match, "i") : null;
  const out: unknown[] = [];
  for (const q of (queryOverride ?? cat.query).split(";").map((s: string) => s.trim()).filter(Boolean).slice(0, 4)) {
    const res = await page(q, 0, id === TRENDING ? "pm" : "");
    const kept: string[] = [], dropped: Record<string, string[]> = {};
    for (const x of res) {
      const title = String(x.title ?? "").replace(/\s*[-|–]\s*(YouTube|TikTok|Facebook|Vimeo|Dailymotion)\s*$/i, "").trim();
      const channel = x.video?.creator ?? x.video?.publisher ?? x.meta_url?.hostname ?? "";
      const views = Number(x.video?.views ?? 0);
      const why = !views ? "no_views" : NOT_AD.test(title) ? "not_ad" : fits && !fits.test(`${title} ${channel}`) ? "off_category"
        : !isOfficial(channel) ? "not_official" : "";
      const line = `${channel} | ${views} | ${String(x.page_age ?? "").slice(0, 10)} | ${title.slice(0, 50)}`;
      if (why) (dropped[why] ??= []).push(line); else kept.push(line);
    }
    out.push({ q, results: res.length, kept, dropped: Object.fromEntries(Object.entries(dropped).map(([k, v]) => [k, v.slice(0, 12)])) });
    await new Promise((ok) => setTimeout(ok, 1100));
  }
  return json({ dry: true, id, out });
}

Deno.serve(async (req) => {
  const db = admin();
  // shared secret lives in public.app_secrets (RLS on, no policies -> only service role can read)
  const { data: sec } = await db.from("app_secrets").select("value").eq("name", "cron").single();
  const got = req.headers.get("x-cron-secret");
  if (!sec?.value || !got || got !== sec.value) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!KEY) return json({ error: "BRAVE_API_KEY secret is not set" }, 500);

  // optional body:
  //   {"only":"game"}                         re-scrape one category
  //   {"only":"food","dry":true,"query":"…"}  try searches for one category: report kept/dropped, save nothing
  const body = await req.json().catch(() => ({}));
  const only = typeof body?.only === "string" ? body.only : "";
  if (only && body?.dry) return dryRun(db, only, typeof body.query === "string" ? body.query : null);
  const { data: all, error } = await db.from("categories").select("id, query, match, brands");
  if (error) return json({ error: error.message }, 500);
  const brandList = (all ?? []).map((c) => c.brands).filter(Boolean).join("|");
  if (!brandList) return json({ error: "no brands configured in categories.brands" }, 500);
  OFFICIAL = new RegExp(brandList, "i");
  const cats = only ? (all ?? []).filter((c) => c.id === only) : all;

  const report: Record<string, string | number> = {};
  const today = bangkokDay();
  for (const c of cats ?? []) {
    if (!c.query?.trim()) continue;
    try {
      // trending's own searches (if any) look at the past month only; they just feed the snapshot pool
      const isTrend = c.id === TRENDING;
      const { top, pool } = await topTen(c.query, c.match, isTrend ? "pm" : "");
      if (!isTrend) {
        const { error: e } = await db.rpc("replace_category_ads", { p_category: c.id, p_rows: top });
        if (e) throw e;
      }
      // today's view count for every official ad found -> history for "มาแรง"
      const { error: se } = await db.from("view_snapshots").upsert(
        pool.map((x) => ({ video_id: x.video_id, day: today, view_count: x.view_count, title: x.title,
          channel: x.channel, thumbnail_url: x.thumbnail_url, url: x.url, published_at: x.published_at,
          taken_at: new Date().toISOString() })),
        { onConflict: "video_id,day" },
      );
      const n = isTrend ? `${pool.length} new ads found` : top.length;
      report[c.id] = se ? `${n} (snapshot error: ${se.message})` : n;
    } catch (e) {
      report[c.id] = `error: ${(e as Error).message}`; // other categories keep going; old data kept
    }
  }
  if (!only || only === TRENDING) {
    try { report.trending_ranked = await rankTrending(db); }
    catch (e) { report.trending_ranked = `error: ${(e as Error).message}`; }
  }
  return json({ ok: true, report, at: new Date().toISOString() });
});
