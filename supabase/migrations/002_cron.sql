-- =====================================================================
-- Daily scrape at 03:00 Thailand time (= 20:00 UTC)
-- The cron password is generated inside the database and never leaves it:
-- pg_cron sends it as x-cron-secret, scrape-ads compares it with the same row.
-- Applied to project aekxigtnorhphvzqgyqv on 2026-11-18.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (name, value)
values ('cron', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

select cron.schedule(
  'daily-ad-scrape',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://aekxigtnorhphvzqgyqv.supabase.co/functions/v1/scrape-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where name = 'cron')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
