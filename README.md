# AdRank — เว็บจัดอันดับโฆษณาตามยอดวิว

- หน้าแรก: **3 โฆษณายอดวิวสูงสุดของทั้งเว็บ** เป็นการ์ด (รูป + ยอดวิวด้านล่าง) → กดการ์ดเปิดลิงก์โฆษณาทันที
- เลือกหมวดหมู่ → เห็นอันดับ 1–3 ฟรี, อันดับ 4–10 ล็อกไว้ ต้องบริจาคผ่าน **Ko-fi** หรือ **Stripe**
- ระบบไปกวาดข้อมูลจาก **search engine (Brave Search)** **ทุกวันตี 3 (เวลาไทย)** — ได้วิดีโอโฆษณาจากทุกเว็บ (YouTube, TikTok, Facebook ฯลฯ) พร้อมยอดวิว แล้ว **ลบข้อมูลเก่าทิ้ง** เก็บแค่ 10 อันดับล่าสุดต่อหมวด
- รองรับมือถือและคอมพิวเตอร์

## ฐานข้อมูลที่แนะนำ: Supabase (PostgreSQL)

| เหตุผล | รายละเอียด |
|---|---|
| ฟรีพอสำหรับเว็บนี้ | ข้อมูลมีแค่ ~60 แถว (6 หมวด × 10) + รายการบริจาค ใช้ฟรีได้สบาย |
| มีตั้งเวลาในตัว | `pg_cron` สั่งเก็บข้อมูลทุกวันได้เลย ไม่ต้องมีเซิร์ฟเวอร์แยก |
| มี Edge Functions | ใช้รับ webhook จาก Ko-fi / Stripe และซ่อนอันดับ 4–10 ไว้ฝั่งเซิร์ฟเวอร์ |
| ลบข้อมูลเก่าแบบปลอดภัย | ฟังก์ชัน `replace_category_ads` ลบ+ใส่ใหม่ในครั้งเดียว ถ้าดึงข้อมูลพลาด ข้อมูลเมื่อวานยังอยู่ |
| คุณใช้อยู่แล้ว | ใช้บัญชีเดียวกับโปรเจกต์อื่นได้ |

ทางเลือกอื่น: **Cloudflare D1 + Workers Cron** (ฟรีเหมือนกัน เร็วมาก แต่ต้องเขียนเองมากกว่า) — ไม่แนะนำ Firebase เพราะตั้งเวลาต้องใช้แพ็กเกจเสียเงิน

## โครงสร้าง

```
web/                      หน้าเว็บ (HTML/CSS/JS ล้วน — วางบน GitHub Pages ได้เลย)
  config.js               ← แก้ไฟล์นี้: API_URL, KOFI_URL, STRIPE_LINK
supabase/
  migrations/001_init.sql ตาราง categories, ads, donations + ฟังก์ชันลบ/ใส่ข้อมูล
  migrations/002_cron.sql ตั้งเวลาเก็บข้อมูลทุกวัน
  functions/scrape-ads    ค้นผ่าน Brave Search → เก็บ 10 อันดับยอดวิวสูงสุด, เขียนทับของเก่า
  functions/rankings      API ให้หน้าเว็บ (ส่งอันดับ 4–10 เฉพาะคนที่บริจาคแล้ว)
  functions/kofi-webhook  รับแจ้งบริจาคจาก Ko-fi
  functions/stripe-webhook รับแจ้งชำระเงินจาก Stripe
```

## ทดลองดูก่อน (โหมดตัวอย่าง)

`API_URL` ว่างไว้ = ใช้ข้อมูลจำลอง เปิดเซิร์ฟเวอร์:

```powershell
python -m http.server 5173 --directory web
```

เปิด http://localhost:5173 — ในโหมดตัวอย่าง อีเมลที่ลงท้าย `@demo.com` จะถือว่าบริจาคแล้ว

## สถานะปัจจุบัน (18 พ.ย. 2026)

ติดตั้งบน Supabase โปรเจกต์ **adrank** (ref `aekxigtnorhphvzqgyqv`, สิงคโปร์) แล้ว:
ตาราง + RLS, ฟังก์ชันทั้ง 4 ตัว, ตั้งเวลาดึงข้อมูลตี 3 ทุกวัน (รหัส cron สร้างสุ่มอยู่ในตาราง `app_secrets` ไม่ต้องตั้งเอง)
และ `web/config.js` ชี้ไป API จริงแล้ว

**ที่เหลือต้องทำเอง** — Supabase Dashboard → Edge Functions → Secrets ใส่ (`BRAVE_API_KEY` ใส่แล้ว ✓):
`KOFI_VERIFICATION_TOKEN`, `STRIPE_WEBHOOK_SECRET` (ไม่ต้องใช้ Stripe secret key `sk_...`) (และ `UNLOCK_DAYS` ถ้าไม่ใช้ 30)
แล้วทำข้อ 5–7 ด้านล่าง (Ko-fi, Stripe, ใส่ลิงก์ใน config.js)

ดึงข้อมูลรอบแรกทันทีโดยไม่ต้องรอตี 3 — รันใน SQL Editor:
```sql
select net.http_post(
  url := 'https://aekxigtnorhphvzqgyqv.supabase.co/functions/v1/scrape-ads',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-cron-secret',(select value from public.app_secrets where name='cron')),
  body := '{}'::jsonb, timeout_milliseconds := 120000);
```

> หมายเหตุ: การแทนที่ข้อมูลรายวันใช้วิธีเขียนทับอันดับ 1–10 (upsert) แทนการลบ — ตารางมีไม่เกิน 10 แถวต่อหมวดเสมอ ข้อมูลเก่าหายไปเหมือนกัน

## ติดตั้งจริง (ขั้นตอนเต็ม — ข้อ 2–4 ทำไปแล้ว)

1. **Brave Search API key** — https://api-dashboard.search.brave.com → สมัคร (ต้องใส่บัตร แต่ได้เครดิตฟรี $5/เดือน ≈ 1,000 ครั้ง)
   เว็บนี้ใช้ 1 ครั้ง/หมวด/วัน = ~180 ครั้ง/เดือน สำหรับ 6 หมวด → อยู่ในเครดิตฟรี
   ทำไมไม่ใช่ Google: Google ปิด Custom Search API ให้ผู้ใช้ใหม่แล้ว (ปิดถาวร 1 ม.ค. 2027) และการกวาดหน้าผลค้นหา Google ตรงๆ ผิดข้อตกลงและโดนบล็อก/CAPTCHA
2. **Supabase** — สร้างโปรเจกต์ → SQL Editor → รัน `001_init.sql`
3. **Deploy functions และตั้ง secret**
   ```powershell
   supabase link --project-ref <PROJECT_REF>
   ```
   ```powershell
   supabase secrets set BRAVE_API_KEY=... CRON_SECRET=<สุ่มยาวๆ> KOFI_VERIFICATION_TOKEN=... STRIPE_WEBHOOK_SECRET=whsec_... UNLOCK_DAYS=30
   ```
   ```powershell
   supabase functions deploy rankings scrape-ads kofi-webhook stripe-webhook
   ```
4. **ตั้งเวลา** — แก้ `<PROJECT_REF>` และ `<CRON_SECRET>` ใน `002_cron.sql` แล้วรันใน SQL Editor
   ดึงข้อมูลรอบแรกทันที (ไม่ต้องรอพรุ่งนี้):
   ```powershell
   curl.exe -X POST https://<PROJECT_REF>.supabase.co/functions/v1/scrape-ads -H "x-cron-secret: <CRON_SECRET>"
   ```
5. **Ko-fi** — ใช้หน้า Ko-fi ร่วมกับเกม Wood Gate (`ko-fi.com/woodgatesupport`). Ko-fi ตั้ง webhook ได้ที่เดียว
   จึง **ไม่ต้องเปลี่ยน** webhook ใน Ko-fi: ฟังก์ชัน `kofi-webhook` ของเกม (โปรเจกต์ hnkqzebtrozfhsjbsqie)
   ตรวจ token แล้วส่งต่อมาที่ AdRank ให้อัตโนมัติ (ถ้า AdRank ล่ม เกมยังเติมหัวใจได้ปกติ)
   แค่ใส่ secret `KOFI_VERIFICATION_TOKEN` ใน AdRank ด้วย **ค่าเดียวกับของเกม**
   หมายเหตุ: ใครบริจาคให้เกมก็ปลดล็อก AdRank ได้ด้วย (หน้า Ko-fi เดียวกัน แยกไม่ได้)
   (ถ้าในอนาคตแยกบัญชี Ko-fi: ตั้ง Webhook URL ใหม่เป็น:
   `https://<PROJECT_REF>.supabase.co/functions/v1/kofi-webhook` แล้วคัดลอก *Verification Token* ไปใส่ secret)
6. **Stripe** — สร้าง *Payment Link* (เลือก "ลูกค้ากำหนดจำนวนเงินเอง") →
   Developers → Webhooks → เพิ่ม endpoint `.../functions/v1/stripe-webhook` เลือกอีเวนต์ `checkout.session.completed`
   แล้วคัดลอก Signing secret (`whsec_...`) ไปใส่ secret — ทดสอบด้วยโหมด Test ก่อน
7. **หน้าเว็บ** — แก้ `web/config.js` ใส่ `API_URL`, `KOFI_URL`, `STRIPE_LINK` แล้วอัปโหลดโฟลเดอร์ `web/` ขึ้น GitHub Pages

## เพิ่ม/แก้หมวดหมู่

```sql
insert into categories (id, name_th, name_en, emoji, query, match, sort_order)
values ('game', 'เกม', 'Games', '🎮',
        'โฆษณา เกม; โฆษณา เกมมือถือ; TVC เกม',      -- ค้นได้สูงสุด 3 คำค้น คั่นด้วย ;
        'เกม|game|rov|free fire|pubg|genshin',       -- ชื่อ/ช่องต้องมีคำใดคำหนึ่ง (null = ไม่กรอง)
        7);
```
- `query` — คำค้นสั้นๆ หลายคำค้นได้ผลดีกว่าคำค้นยาวคำเดียว (3 คำค้น × 6 หมวด × 30 วัน ≈ 540 ครั้ง/เดือน อยู่ในเครดิตฟรีของ Brave)
- `match` — กันโฆษณาหมวดอื่นหลุดเข้ามา (search engine ชอบเติมผลที่ไม่ตรงหมวด)
- ถ้าผลยังมีคลิปที่ไม่ใช่โฆษณา (สอนวิธี, รีแอคชัน) เพิ่มคำใน `NOT_AD` ใน scrape-ads

รอบเก็บข้อมูลถัดไปจะดึงหมวดใหม่ให้อัตโนมัติ — แก้ใน Supabase Table Editor ได้เลยไม่ต้อง deploy ใหม่

## ข้อควรรู้

- ปลดล็อกด้วย **อีเมลที่ใช้บริจาค** (ไม่ต้องสมัครสมาชิก) ใช้ได้ `UNLOCK_DAYS` วัน — ข้อเสียคือถ้ามีคนรู้อีเมลผู้บริจาคก็ใช้ปลดล็อกได้ เหมาะกับระบบ "บริจาค" ไม่ใช่ระบบสมาชิกเข้มงวด
- อันดับ 4–10 ไม่ถูกส่งไปที่เบราว์เซอร์เลยถ้ายังไม่บริจาค (ไม่ใช่แค่เบลอ)
- ตาราง `ads`/`donations` เปิด RLS ไม่มี policy สาธารณะ — anon key อ่านตรงไม่ได้
- ข้อมูลมาจาก Brave Search API (search engine อิสระ ถูกกฎ) — ผลค้นหาอาจมีคลิปที่ไม่ใช่โฆษณาปนบ้าง ปรับคำค้นใน `categories.query` ได้
- จะเปลี่ยน search engine (เช่น Serper ที่ให้ผล Google) แก้แค่ฟังก์ชัน `topTen` ใน scrape-ads — แต่ต้องได้ยอดวิวมาด้วย ซึ่ง Brave ให้มาในผลค้นหาเลย
