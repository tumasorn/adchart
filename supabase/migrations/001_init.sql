-- =====================================================================
-- Ad Ranking — schema
-- Run once in Supabase SQL Editor (or `supabase db push`).
-- All reads/writes go through Edge Functions (service role), so the
-- tables have RLS ON with NO public policies: the anon key cannot read
-- ranks 4-10 or donor emails directly.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- categories ----------
create table if not exists public.categories (
  id          text primary key,              -- slug, e.g. 'food'
  name_th     text not null,
  name_en     text not null,
  emoji       text not null default '📺',
  query       text not null,                 -- search-engine query
  sort_order  int  not null default 0
);

insert into public.categories (id, name_th, name_en, emoji, query, sort_order) values
  ('food',    'อาหารและเครื่องดื่ม', 'Food & Drink',   '🍜', 'TVC โฆษณา อาหาร เครื่องดื่ม ขนม', 1),
  ('tech',    'มือถือและเทคโนโลยี', 'Tech & Mobile',  '📱', 'TVC โฆษณา สมาร์ทโฟน Samsung OPPO vivo iPhone',  2),
  ('car',     'รถยนต์',             'Cars',           '🚗', 'TVC โฆษณา รถยนต์',            3),
  ('beauty',  'ความงาม',            'Beauty',         '💄', 'TVC โฆษณา ครีม เครื่องสำอาง แชมพู', 4),
  ('finance', 'ธนาคารและประกัน',     'Finance',        '🏦', 'TVC โฆษณา ธนาคาร ประกันชีวิต',      5),
  ('emotion', 'โฆษณาไทย ซึ้ง TVC',          'Heartfelt',      '🥹', 'โฆษณาไทย ซึ้ง TVC',               6)
on conflict (id) do nothing;

-- ---------- ads (only the CURRENT top 10 per category is kept) ----------
create table if not exists public.ads (
  id            bigint generated always as identity primary key,
  category_id   text   not null references public.categories(id) on delete cascade,
  rank          smallint not null check (rank between 1 and 10),
  video_id      text   not null,
  title         text   not null,
  channel       text,
  thumbnail_url text   not null,
  url           text   not null,
  view_count    bigint not null,
  scraped_at    timestamptz not null default now(),
  unique (category_id, rank)
);
create index if not exists ads_view_count_idx on public.ads (view_count desc);

-- ---------- donations (written by Ko-fi / Stripe webhooks) ----------
create table if not exists public.donations (
  id          bigint generated always as identity primary key,
  email       text not null,                 -- stored lower-case
  source      text not null check (source in ('kofi','stripe')),
  amount      numeric(12,2),
  currency    text,
  external_id text unique,                   -- Ko-fi transaction id / Stripe session id (idempotency)
  created_at  timestamptz not null default now()
);
create index if not exists donations_email_idx on public.donations (email, created_at desc);

alter table public.categories enable row level security;
alter table public.ads        enable row level security;
alter table public.donations  enable row level security;
-- categories are harmless to expose
create policy "categories public read" on public.categories for select using (true);

-- ---------- replace one category's ranking: overwrite ranks 1-10 in place ----------
-- Old data is overwritten (never more than 10 rows per category). If a scrape
-- returns fewer than 10, leftover higher ranks keep an older scraped_at and the
-- rankings API ignores them.
create or replace function public.replace_category_ads(p_category text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_array_length(p_rows) = 0 then
    return;                                   -- keep yesterday's data if the scrape came back empty
  end if;
  insert into public.ads (category_id, rank, video_id, title, channel, thumbnail_url, url, view_count, scraped_at)
  select p_category,
         (r->>'rank')::smallint,
         r->>'video_id',
         r->>'title',
         r->>'channel',
         r->>'thumbnail_url',
         r->>'url',
         (r->>'view_count')::bigint,
         now()
  from jsonb_array_elements(p_rows) r
  on conflict (category_id, rank) do update set
    video_id = excluded.video_id,
    title = excluded.title,
    channel = excluded.channel,
    thumbnail_url = excluded.thumbnail_url,
    url = excluded.url,
    view_count = excluded.view_count,
    scraped_at = excluded.scraped_at;
end;
$$;
revoke all on function public.replace_category_ads(text, jsonb) from public, anon, authenticated;
