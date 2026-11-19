-- "มาแรง" (trending): ranked by views gained per day. Applied to aekxigtnorhphvzqgyqv on 2026-11-19.
-- scrape-ads saves one view_snapshots row per official ad per day (Bangkok date), then ranks
-- trending by (views today - views on the last earlier snapshot) / days between.
-- Snapshots older than 14 days are removed by scrape-ads itself.
create table if not exists public.view_snapshots (
  video_id      text not null,
  day           date not null,
  view_count    bigint not null,
  title         text,
  channel       text,
  thumbnail_url text,
  url           text,
  published_at  timestamptz,
  primary key (video_id, day)
);
create index if not exists view_snapshots_day_idx on public.view_snapshots (day);
alter table public.view_snapshots enable row level security;

alter table public.ads add column if not exists daily_gain bigint;

create or replace function public.replace_category_ads(p_category text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  insert into public.ads (category_id, rank, video_id, title, channel, thumbnail_url, url, view_count, daily_gain, scraped_at)
  select p_category, (r->>'rank')::smallint, r->>'video_id', r->>'title', r->>'channel',
         r->>'thumbnail_url', r->>'url', (r->>'view_count')::bigint, (r->>'daily_gain')::bigint, now()
  from jsonb_array_elements(p_rows) r
  on conflict (category_id, rank) do update set
    video_id = excluded.video_id, title = excluded.title, channel = excluded.channel,
    thumbnail_url = excluded.thumbnail_url, url = excluded.url, view_count = excluded.view_count,
    daily_gain = excluded.daily_gain, scraped_at = excluded.scraped_at;
end;
$$;
revoke all on function public.replace_category_ads(text, jsonb) from public, anon, authenticated;

insert into public.categories (id, name_th, name_en, emoji, query, match, brands, sort_order)
values ('trending', 'มาแรง', 'Trending', '🔥', '', null, null, 0)
on conflict (id) do nothing;

-- exact snapshot time, so the daily gain uses real elapsed hours (today's first snapshot is
-- ~8 h before the 03:00 run, not a full day)
alter table public.view_snapshots add column if not exists taken_at timestamptz not null default now();
-- trending has no searches of its own: Brave's past-month filter returned almost nothing
update public.categories set query = '' where id = 'trending';
