// Visit counter for the footer.
//   POST /stats {"new_visitor": true|false} -> count one page view, return totals
//   POST /stats {"peek": true}               -> return totals without counting (local testing)
// Only daily totals are stored (no IP, no cookie, no per-person data). "new_visitor" comes
// from the browser's own localStorage (first view of the day in that browser).
import { admin, cors, json } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = await req.json().catch(() => ({}));
  const db = admin();

  if (body?.peek === true) {
    const { data, error } = await db.from("site_stats").select("day, views, visitors");
    if (error) return json({ error: "db" }, 500);
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const sum = (k: "views" | "visitors", f = (_: any) => true) =>
      (data ?? []).filter(f).reduce((n, r) => n + Number(r[k]), 0);
    return json({
      today_views: sum("views", (r) => r.day === today), today_visitors: sum("visitors", (r) => r.day === today),
      total_views: sum("views"), total_visitors: sum("visitors"),
      since: (data ?? []).map((r) => r.day).sort()[0] ?? null,
    }, 200, { "Cache-Control": "no-store" });
  }

  const { data, error } = await db.rpc("track_view", { p_new_visitor: body?.new_visitor === true });
  if (error) return json({ error: "db" }, 500);
  return json(data, 200, { "Cache-Control": "no-store" });
});
