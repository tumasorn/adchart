-- Games category. Applied to project aekxigtnorhphvzqgyqv on 2026-11-18.
-- 7 categories × 3 searches × 30 days ≈ 630 Brave requests/month (free credit ≈ 1,000).
insert into public.categories (id, name_th, name_en, emoji, query, match, sort_order) values (
  'game', 'เกม', 'Games', '🎮',
  'ROV โฆษณา TVC; Free Fire โฆษณา TVC; Garena โฆษณา เกม',
  'เกม|game|gaming|rov|arena of valor|free ?fire|pubg|genshin|honkai|mobile legends|\bmlbb\b|clash|valorant|playstation|\bps5\b|nintendo|xbox|garena|roblox|minecraft|cookie run|ragnarok|\bfifa\b|\bfc mobile\b|e-?sport',
  7)
on conflict (id) do update set query = excluded.query, match = excluded.match;
