-- Footer visit counter. Applied to aekxigtnorhphvzqgyqv on 2026-11-19.
-- Privacy-friendly: only daily totals (Bangkok date), no IPs, no cookies, no per-person rows.
-- "visitors" = first view of the day in a browser (decided client-side via localStorage).
create table if not exists public.site_stats (
  day      date primary key,
  views    bigint not null default 0,
  visitors bigint not null default 0
);
alter table public.site_stats enable row level security;

create or replace function public.track_view(p_new_visitor boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  r jsonb;
begin
  insert into public.site_stats (day, views, visitors)
  values (d, 1, case when p_new_visitor then 1 else 0 end)
  on conflict (day) do update set
    views = site_stats.views + 1,
    visitors = site_stats.visitors + case when p_new_visitor then 1 else 0 end;

  select jsonb_build_object(
    'today_views',    coalesce(sum(views)    filter (where day = d), 0),
    'today_visitors', coalesce(sum(visitors) filter (where day = d), 0),
    'total_views',    coalesce(sum(views), 0),
    'total_visitors', coalesce(sum(visitors), 0),
    'since',          min(day)
  ) into r from public.site_stats;
  return r;
end;
$$;
revoke all on function public.track_view(boolean) from public, anon, authenticated;
