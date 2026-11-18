-- Applied to project aekxigtnorhphvzqgyqv on 2026-11-18 (tuned with scrape-ads dry runs).
-- 1) Short brand names must match whole words in channel names (e.g. "lay's" was matching "Anand P-lays").
--    \b is a JavaScript word boundary: the scraper evaluates these patterns in JS, not Postgres.
--    (Run twice: adjacent names share a "|" so one pass skips every other one.)
update public.categories set brands = regexp_replace(brands, '(^|\|)(lay''\?s|chang|mama|milo|tasto|birdy)(\||$)', '\1\b\2\b\3', 'g') where id = 'food';
update public.categories set brands = regexp_replace(brands, '(^|\|)(apple|honor|sony|vivo|oppo|nokia|acer|asus)(\||$)', '\1\b\2\b\3', 'g') where id = 'tech';
update public.categories set brands = regexp_replace(brands, '(^|\|)(ford|shell|neta|aion|honda|isuzu|mazda|volvo|lexus)(\||$)', '\1\b\2\b\3', 'g') where id = 'car';
update public.categories set brands = regexp_replace(brands, '(^|\|)(dove|boots|olay|citra|parrot|biore|senka)(\||$)', '\1\b\2\b\3', 'g') where id = 'beauty';
update public.categories set brands = regexp_replace(brands, '(^|\|)(gravity|nexon|xbox)(\||$)', '\1\b\2\b\3', 'g') where id = 'game';
update public.categories set brands = regexp_replace(brands, '(^|\|)aeon(\||$)', '\1\baeon\b\2') where id = 'finance';

-- 2) Searches that dry runs showed return official ads (Pepsi Thailand alone: 9 official ads;
--    Osotspa / Oishi / Mama / Genshin / Mobile Legends returned none usable).
update public.categories set query = 'Pepsi Thailand โฆษณา; Coca-Cola Thailand โฆษณา; Nestle Thailand โฆษณา; KFC Thailand โฆษณา' where id = 'food';
update public.categories set query = 'Garena Free Fire TH โฆษณา; Garena RoV โฆษณา; Garena RoV Thailand TVC; PUBG MOBILE Thailand โฆษณา' where id = 'game';
