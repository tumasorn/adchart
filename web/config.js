// ===== ตั้งค่าเว็บ (แก้ไฟล์นี้ไฟล์เดียว) =====
window.APP_CONFIG = {
  // URL ของ Edge Function "rankings" — ปล่อยว่างไว้ = โหมดตัวอย่าง (ข้อมูลจำลอง)
  // เช่น "https://abcdefgh.supabase.co/functions/v1/rankings"
  API_URL: "https://aekxigtnorhphvzqgyqv.supabase.co/functions/v1/rankings",

  // หน้า Ko-fi (ใช้ร่วมกับเกม Wood Gate — webhook ของเกมส่งต่อการบริจาคมาที่ AdChart)
  KOFI_URL: "https://ko-fi.com/woodgatesupport",

  // Stripe Payment Link เช่น "https://buy.stripe.com/xxxx"
  STRIPE_LINK: "https://buy.stripe.com/5kQ9AT0mR0Vgbc58s924000", // LIVE (test link: .../test_5kQ9AT0mR0Vgbc58s924000)

  // ปลดล็อกได้กี่วันหลังบริจาค (ต้องตรงกับ UNLOCK_DAYS ฝั่งเซิร์ฟเวอร์)
  UNLOCK_DAYS: 30,
};
