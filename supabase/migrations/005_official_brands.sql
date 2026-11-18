-- "Official only": scrape-ads keeps a clip only if its CHANNEL name matches a brand here
-- (all rows unioned into one allow-list) and doesn't look like a fan/re-upload/news channel.
-- Add a brand to its category's list to let its official channel in. emotion = null (uses the union).
-- Applied to project aekxigtnorhphvzqgyqv on 2026-11-18.
alter table public.categories add column if not exists brands text;

update public.categories set brands = v.b from (values
  ('food',    'nestl|osotspa|โอสถสภา|carabao|คาราบาว|singha|boonrawd|บุญรอด|thaibev|ไทยเบฟ|chang|coca|coke|pepsi|lay''?s|tasto|mama|มาม่า|thai ?president|wai ?wai|ไวไว|oishi|โออิชิ|ichitan|อิชิตัน|dutch ?mill|ดัชมิลล์|foremost|โฟร์โมสต์|meiji|เมจิ|yakult|ยาคูลท์|cp ?brand|\bcpf\b|betagro|เบทาโกร|kfc|mcdonald|แมคโดนัลด์|7-?eleven|เซเว่น|tao ?kae ?noi|เถ้าแก่น้อย|lactasoy|แลคตาซอย|vitamilk|ไวตามิ้ลค์|nescaf|birdy|est ?cola|knorr|คนอร์|ajinomoto|อายิโนะโมะโต๊ะ|unilever|mk ?restaurant|after ?you|ovaltine|โอวัลติน|milo'),
  ('tech',    'samsung|oppo|vivo|apple|xiaomi|realme|huawei|honor|nokia|\bais\b|true ?move|\btrue\b|dtac|banana ?it|jaymart|lenovo|asus|acer|\bdell\b|\bhp\b|sony|\blg\b'),
  ('car',     'toyota|honda|isuzu|mazda|nissan|mitsubishi|ford|\bmg\b|gwm|great ?wall|\bbyd\b|bmw|mercedes|benz|suzuki|yamaha|hyundai|\bkia\b|subaru|chevrolet|neta|changan|aion|volvo|lexus|\bptt\b|shell|caltex|bangchak|บางจาก'),
  ('beauty',  'nivea|citra|pond''?s|l''?or[eé]al|garnier|olay|sunsilk|dove|vaseline|mistine|มิสทีน|unilever|p&g|pantene|head ?& ?shoulders|rejoice|colgate|darlie|smooth ?e|snail ?white|cathy ?doll|srichand|ศรีจันทร์|maybelline|biore|shiseido|senka|watsons|boots|eveandboy|beauty ?buffet|cute ?press|คิวท์เพรส|giffarine|กิฟฟารีน|\btros\b|\blux\b|parrot|twelve ?plus|12 ?plus|benice'),
  ('finance', 'thailife|ไทยประกันชีวิต|kbank|kasikorn|กสิกร|\bscb\b|ไทยพาณิชย์|krungsri|กรุงศรี|krungthai|กรุงไทย|bangkok ?bank|ธนาคารกรุงเทพ|\bttb\b|\btmb\b|kiatnakin|เกียรตินาคิน|\bgsb\b|ออมสิน|\bbaac\b|\buob\b|cimb|lh ?bank|\baia\b|muang ?thai|เมืองไทยประกัน|allianz|\bfwd\b|\baxa\b|prudential|tokio ?marine|dhipaya|ทิพย|viriyah|วิริยะ|bangkok ?insurance|\bktc\b|aeon|first ?choice|truemoney|line ?bk'),
  ('game',    'garena|free ?fire|\brov\b|tencent|level ?infinite|moonton|mobile ?legends|pubg|krafton|hoyoverse|genshin|honkai|riot ?games|valorant|playstation|nintendo|xbox|supercell|ubisoft|line ?games|netmarble|gravity|ragnarok|cookie ?run|devsisters|roblox|mojang|com2us|nexon|gameloft')
) as v(id, b) where categories.id = v.id;
