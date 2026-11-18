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
const NOT_AD = /วิธี|ลบโฆษณา|บล็อก|ปิดโฆษณา|เด้ง|ป๊อปอัพ|ไวรัส|vs\.?\s*ความเป็นจริง|เทคนิค|ทริค|reaction|รีแอค|ดูโฆษณา|ต่างชาติ|ฝรั่ง|บทความ/i;

async function search(params: Record<string, string>) {
  const u = new URL(BRAVE);
  u.search = new URLSearchParams(params).toString();
  return fetch(u, { headers: { Accept: "application/json", "X-Subscription-Token": KEY } });
}

async function page(query: string, offset: number): Promise<any[]> {
  const base = { q: query, count: "50", offset: String(offset) };
  let r = await search({ ...base, safesearch: "strict", search_lang: "th", country: "ALL" });
  if (r.status === 422) r = await search(base); // unsupported lang/country → plain query
  if (!r.ok) throw new Error(`brave ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).results ?? [];
}

// `query` may hold several searches separated by ";" (max 3). Short searches
// match more videos than one long one; results are merged, filtered, ranked.
// 6 categories × 3 searches × 30 days ≈ 540 requests/month (free credit ≈ 1,000).
async function topTen(query: string, match: string | null): Promise<Row[]> {
  // category keyword check: the search engine pads weak matches with unrelated ads
  const fits = match ? new RegExp(match, "i") : null;
  const all: any[] = [];
  for (const q of query.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 3)) {
    all.push(...(await page(q, 0)));
    await new Promise((ok) => setTimeout(ok, 1100)); // stay under 1 request/second
  }
  return pick(all, fits).slice(0, 10).map(({ raw: _raw, ...x }, i) => ({ ...x, rank: i + 1 }));
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
      raw: x,
    }))
    .filter((x) => /^https:\/\//.test(x.url) && x.view_count > 0 && x.thumbnail_url && !NOT_AD.test(x.title) &&
      (!fits || fits.test(`${x.title} ${x.channel}`)) && !seen.has(x.url) && seen.add(x.url))
    .sort((a, b) => b.view_count - a.view_count);
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

  const { data: cats, error } = await db.from("categories").select("id, query, match");
  if (error) return json({ error: error.message }, 500);

  const report: Record<string, string | number> = {};
  for (const c of cats ?? []) {
    try {
      const rows = await topTen(c.query, c.match);
      const { error: e } = await db.rpc("replace_category_ads", { p_category: c.id, p_rows: rows });
      if (e) throw e;
      report[c.id] = rows.length;
    } catch (e) {
      report[c.id] = `error: ${(e as Error).message}`; // other categories keep going; old data kept
    }
  }
  return json({ ok: true, report, at: new Date().toISOString() });
});
