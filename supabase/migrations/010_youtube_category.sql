-- "โฆษณาบน YouTube" category (user request 2026-11-21): ads found AND counted by the YouTube Data API
-- only (no Brave). scrape-ads reads categories.source: 'youtube' -> YouTube search.list ordered by
-- view count (region TH), official brand channels only (same brands allow-list as other categories).
alter table public.categories add column if not exists source text not null default 'brave';

insert into public.categories (id, name_th, name_en, emoji, query, sort_order, match, brands, source)
values ('youtube', 'โฆษณาบน YouTube', 'YouTube Ads', '▶️',
        'โฆษณา; หนังโฆษณา; TVC Thailand; โฆษณาไทย', 8,
        -- Thai ads only: title or channel has Thai script / "thai" / "th" (drops e.g. US Super Bowl ads on a brand's global channel)
        '[ก-๙]|thai|\bth\b', null, 'youtube')
on conflict (id) do update set name_th = excluded.name_th, name_en = excluded.name_en, emoji = excluded.emoji,
  query = excluded.query, match = excluded.match, sort_order = excluded.sort_order, source = excluded.source;
