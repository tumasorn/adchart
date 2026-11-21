-- Tuning after the first scrape of the new categories (2026-11-21).
-- 1) A Vietnamese Lazada ad slipped into shopping: YouTube-sourced categories now reject titles /
--    channels naming another country.
update public.categories
set match = replace(match, '^(?=', '^(?!.*(việt|vietnam|indonesia|malaysia|philippines|singapore|pakistan|\bindia))(?=')
where id in ('shopping', 'apps', 'travel', 'home', 'health') and match not like '^(?!%';

update public.categories
set match = '^(?!.*(việt|vietnam|indonesia|malaysia|philippines|singapore|pakistan|\bindia))(?=.*([ก-๙]|thai|\bth\b))'
where id = 'youtube';

-- 2) Health was mostly tiny Bangkok Hospital clips. Dry runs found the real official channels:
--    BRANDS World Thailand, Gaviscon Thailand, SIANGPURE, MedPark Hospital, ไทยนครพัฒนา (Tiffy), ...
update public.categories
set query = 'แบรนด์ซุปไก่ โฆษณา; ทิฟฟี่ โฆษณา; ยา โฆษณา; โรงพยาบาล โฆษณา',
    brands = 'brands? ?(world|junior)|brand''?s ?(thailand|suntory|essence)|แบรนด์ซุปไก่|gaviscon|กาวิสคอน|siangpure|เซียงเพียว|boss ?pharmacare|ไทยนครพัฒนา|thai ?nakorn ?patana|tiffy|ทิฟฟี่|medpark|bangkok ?hospital|โรงพยาบาลกรุงเทพ|bumrungrad|บำรุงราษฎร์|samitivej|สมิติเวช|principal ?healthcare|\bbdms\b|\bblackmores\b|mega ?we ?care|เมก้า ?วี ?แคร์|vistra|วิสทร้า|counterpain|เคาน์เตอร์เพน'
where id = 'health';

update public.categories
set match = '^(?!.*(việt|vietnam|indonesia|malaysia|philippines|singapore|pakistan|\bindia))(?=.*([ก-๙]|thai|\bth\b))(?=.*(' || brands || '))'
where id = 'health';
