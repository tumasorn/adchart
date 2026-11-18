-- Keyword filter per category: a search result's title/channel must match this
-- (JavaScript regex, case-insensitive; null = accept anything). Stops the search
-- engine's generic padding (e.g. an IKEA ad) leaking into car/phone/beauty.
-- Applied to project aekxigtnorhphvzqgyqv on 2026-11-18. Edit freely in the Table Editor.
alter table public.categories add column if not exists match text;

update public.categories set match = v.m from (values
  ('food',    'อาหาร|เครื่องดื่ม|ขนม|กาแฟ|ชาเขียว|นม|บะหมี่|มาม่า|ไวไว|ยำยำ|ซอส|รสดี|คนอร์|เบียร์|สิงห์|ช้าง|ลีโอ|โค้ก|coke|pepsi|เป๊ปซี่|โออิชิ|อิชิตัน|เนสกาแฟ|nescafe|kfc|mcdonald|แม็คโดนัลด์|\blay''?s?\b|เลย์|ฉลาม|กระทิงแดง|m-150|คาราบาว|ไมโล|โอวัลติน|ดัชมิลล์|โฟร์โมสต์|ยาคูลท์|food|drink|snack'),
  ('tech',    'มือถือ|สมาร์ทโฟน|โทรศัพท์|samsung|galaxy|oppo|vivo|iphone|apple|xiaomi|realme|huawei|\bhonor\b|nokia|\bais\b|truemove|dtac|โน้ตบุ๊ก|แท็บเล็ต|phone|smartphone'),
  ('car',     'รถ|toyota|โตโยต้า|honda|ฮอนด้า|isuzu|อีซูซุ|mazda|มาสด้า|nissan|นิสสัน|mitsubishi|มิตซู|ford|ฟอร์ด|\bmg\b|gwm|ora good|good cat|byd|bmw|benz|เบนซ์|suzuki|ซูซูกิ|yamaha|ยามาฮ่า|chevrolet|เชฟโรเลต|car\b'),
  ('beauty',  'ครีม|เครื่องสำอาง|แชมพู|ผิว|สกินแคร์|ลิป|แป้ง|โลชั่น|สบู่|ยาสีฟัน|มิสทีน|mistine|nivea|นีเวีย|pond|พอนด์|loreal|ลอรีอัล|garnier|การ์นิเย่|olay|โอเลย์|sunsilk|ซันซิล|dove|โดฟ|citra|ซิตร้า|vaseline|วาสลีน|shower|cream|beauty|skin'),
  ('finance', 'ธนาคาร|ประกัน|บัตรเครดิต|สินเชื่อ|กสิกร|ไทยพาณิชย์|scb|kbank|กรุงเทพ|กรุงศรี|krungsri|กรุงไทย|ออมสิน|เกียรตินาคิน|ttb|ทีเอ็มบี|aia|เอไอเอ|เมืองไทย|อลิอันซ์|allianz|bank|insurance')
) as v(id, m) where categories.id = v.id;

-- Several short searches per category, separated by ";" (scraper runs up to 3 and merges them)
update public.categories set query = v.q from (values
  ('food',    'โฆษณา เครื่องดื่ม; โฆษณา ขนม; โฆษณา อาหาร TVC'),
  ('tech',    'โฆษณา มือถือ TVC; โฆษณา Samsung Galaxy; โฆษณา OPPO vivo'),
  ('car',     'โฆษณา รถยนต์; โฆษณา Toyota Honda Isuzu; โฆษณา รถกระบะ'),
  ('beauty',  'โฆษณา ครีม; โฆษณา แชมพู; โฆษณา เครื่องสำอาง'),
  ('finance', 'โฆษณา ประกันชีวิต; โฆษณา ธนาคาร; โฆษณา บัตรเครดิต'),
  ('emotion', 'โฆษณาซึ้ง; โฆษณาไทย เรียกน้ำตา; หนังโฆษณา ซึ้ง')
) as v(id, q) where categories.id = v.id;
