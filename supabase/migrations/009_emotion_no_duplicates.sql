-- โฆษณาซึ้ง duplicates fix. Applied to aekxigtnorhphvzqgyqv on 2026-11-21.
-- scrape-ads now: dedupes by YouTube video id (one standard link per video), drops behind-the-scenes
-- clips, and runs theme categories (brands = null, i.e. emotion) last, skipping ads that another
-- category already shows. Emotion also gets a topic check so plain product ads can't slip in.
update public.categories set
  match = 'ซึ้ง|น้ำตา|แม่|พ่อ|ลูก(?!ค้า)|ครอบครัว|ความรัก|ชีวิต|เรื่องราว|คิดถึง|ความหวัง|always there|opportunity|mother|father|family|love|life|story|sad|peace of mind',
  query = 'ไทยประกันชีวิต โฆษณา ซึ้ง; โฆษณาซึ้ง; หนังโฆษณา เรียกน้ำตา; AIS โฆษณาซึ้ง'
where id = 'emotion';

-- bare "true" matched any channel containing the word (e.g. "... True Relaxation"); keep TrueMove
-- and other True brands but require the specific form. (\b is a JavaScript word boundary.)
update public.categories set brands = replace(brands, '\btrue\b', 'true ?(id|corp|5g|thailand|online|visions)\b')
where id = 'tech';
