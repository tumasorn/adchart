-- User request 2026-11-21: put the 🔥 มาแรง chip last (the site opens on the first category).
update public.categories set sort_order = 99 where id = 'trending';
