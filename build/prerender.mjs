// Build step for GitHub Pages (SEO): copy web/ to _site/, then write the current rankings into
// real HTML so search engines and link previews see the ads without running JavaScript.
//   _site/index.html   home: site-wide top 3 + first category
//   _site/<id>.html    one page per category (own title, description, canonical, JSON-LD)
//   _site/sitemap.xml
// Only the free ranks (1-3) are pre-rendered; ranks 4-10 stay behind the donation unlock.
// If the API is unreachable the plain site is still published (markers are HTML comments).
import { readFile, writeFile, cp } from "node:fs/promises";

const SRC = "web", OUT = "_site", SITE = "https://tumasorn.github.io/adchart/";
await cp(SRC, OUT, { recursive: true });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const one = (x) => (Math.round(x * 10) / 10).toLocaleString("th-TH");
const fmt = (n) => n >= 1e6 ? `${one(n / 1e6)} ล้าน` : n >= 1e4 ? `${one(n / 1e4)} หมื่น` : Number(n).toLocaleString("th-TH");
const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : "#");
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let home, perCat = {};
try {
  const cfg = await readFile(`${SRC}/config.js`, "utf8");
  const API = cfg.match(/API_URL:\s*"([^"]+)"/)[1];
  const get = async (q = "") => {
    const r = await fetch(API + q);
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json();
  };
  home = await get();
  for (const c of home.categories) perCat[c.id] = (await get(`?category=${encodeURIComponent(c.id)}`)).category;
} catch (e) {
  console.warn("prerender skipped:", e.message);
  process.exit(0);
}

const cats = home.categories;
const label = (c) => c.id === "trending" ? "โฆษณามาแรง" : c.name_th.startsWith("โฆษณา") ? c.name_th : `โฆษณา${c.name_th}`;
const views = (a) => a.daily_gain != null
  ? `<span class="gain">▲ +${fmt(a.daily_gain)}</span><small>วิว/วัน</small><small class="total">· รวม ${fmt(a.view_count)}</small>`
  : `${fmt(a.view_count)}<small>วิว</small>`;

const card = (a, i) => `
      <a class="card r${i + 1}" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">
        <div class="thumb"><img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" loading="${i ? "lazy" : "eager"}" /><span class="badge">#${i + 1}</span></div>
        <div class="card-body"><div class="views">${views(a)}</div><div class="title">${esc(a.title)}</div></div>
      </a>`;
const row = (a) => `
      <a class="row r${a.rank}" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">
        <span class="n">${a.rank}</span>
        <span class="t"><img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" loading="lazy" /></span>
        <span class="meta"><div class="v">${views(a)}</div><div class="tt">${esc(a.title)}</div></span>
      </a>`;
const chips = (current) => cats.map((c) =>
  `<a class="chip" href="${esc(c.id)}.html" data-id="${esc(c.id)}" aria-pressed="${c.id === current}">${esc(c.emoji)} ${esc(c.name_th)}</a>`).join("");
const list = (cat) => {
  if (!cat?.items?.length) return `<div class="empty">กำลังเก็บข้อมูล — อันดับจะขึ้นหลังรอบอัปเดตถัดไป</div>`;
  const more = Math.max(0, (cat.total || 0) - cat.items.length);
  return cat.items.map(row).join("") + (more ? `<p class="note">อันดับ 4–${cat.total} ดูได้หลังสนับสนุนเว็บ</p>` : "");
};
const itemList = (name, items) => ({
  "@type": "ItemList", name, numberOfItems: items.length,
  itemListElement: items.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: a.url, name: a.title })),
});

const tpl = await readFile(`${SRC}/index.html`, "utf8");
const urls = [];

function render({ id = "", file, title, desc, h1, intro, listCat }) {
  const url = SITE + (file === "index.html" ? "" : file);
  urls.push(url);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE + "#site", name: "แอดชาร์ต AdChart TH", alternateName: "AdChart TH", url: SITE, inLanguage: "th" },
      { "@type": "CollectionPage", name: title, url, description: desc, isPartOf: { "@id": SITE + "#site" }, dateModified: home.updatedAt ?? today,
        mainEntity: itemList(h1, id ? (listCat?.items ?? []) : home.top3) },
      ...(id ? [{ "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "แอดชาร์ต", item: SITE },
        { "@type": "ListItem", position: 2, name: h1, item: url }] }] : []),
    ],
  };
  const head = `<link rel="canonical" href="${url}" />
  <meta property="og:locale" content="th_TH" />
  <meta property="og:site_name" content="แอดชาร์ต AdChart TH" />
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  let html = tpl
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace("<!--SSR:HEAD-->", head)
    .replace(/\s*<div class="demo-banner"[^>]*>[^<]*<\/div>/, "") // demo notice is for local copies only
    .replace('<body data-category="">', `<body data-category="${esc(id)}" data-ssr="1">`)
    .replace(/<!--SSR:H1-->[\s\S]*?<!--\/SSR:H1-->/, esc(h1))
    .replace(/<!--SSR:INTRO-->[\s\S]*?<!--\/SSR:INTRO-->/, esc(intro))
    .replace("<!--SSR:TOP3-->", home.top3.map(card).join(""))
    .replace("<!--SSR:CHIPS-->", chips(id || cats[0]?.id))
    .replace("<!--SSR:LIST-->", list(listCat));
  return writeFile(`${OUT}/${file}`, html);
}

const homeIntro = tpl.match(/<!--SSR:INTRO-->([\s\S]*?)<!--\/SSR:INTRO-->/)[1];
await render({
  file: "index.html",
  title: "แอดชาร์ต AdChart TH — ชาร์ตโฆษณาไทยยอดวิวสูงสุด อัปเดตทุกวัน",
  desc: "จัดอันดับโฆษณาไทยยอดวิวสูงสุดจากช่องทางการของแบรนด์ แยกหมวดอาหาร มือถือ รถยนต์ ความงาม ธนาคาร เกม โฆษณาซึ้ง และโฆษณามาแรง อัปเดตทุกวัน",
  h1: "ชาร์ตโฆษณาไทย ยอดวิวสูงสุด",
  intro: homeIntro,
  listCat: perCat[cats[0]?.id],
});

for (const c of cats) {
  const name = label(c);
  const isTrend = c.id === "trending";
  const top = (perCat[c.id]?.items ?? []).slice(0, 3).map((a) => a.title).join(", ");
  await render({
    id: c.id,
    file: `${c.id}.html`,
    title: `${name}${isTrend ? " ยอดวิวพุ่งต่อวัน" : " ยอดวิวสูงสุด 10 อันดับ"} — แอดชาร์ต AdChart TH`,
    desc: `${name}${isTrend ? "ที่ยอดวิวเพิ่มขึ้นเร็วที่สุดต่อวัน" : "ยอดวิวสูงสุด 10 อันดับ"} จากช่องทางการของแบรนด์ อัปเดตทุกวัน${top ? ` — ${top}` : ""}`.slice(0, 300),
    h1: `${c.emoji} ${name}${isTrend ? " ยอดวิวพุ่งต่อวัน" : " ยอดวิวสูงสุด"}`,
    intro: isTrend
      ? "โฆษณาไทยจากช่องทางการของแบรนด์ เรียงตามยอดวิวที่เพิ่มขึ้นต่อวัน อัปเดตทุกวัน — อันดับ 1–3 ดูฟรี"
      : `${name} 10 อันดับ จากช่องทางการของแบรนด์ เรียงตามยอดวิว อัปเดตทุกวัน — อันดับ 1–3 ดูฟรี`,
    listCat: perCat[c.id],
  });
}

urls.push(SITE + "contact.html");
await writeFile(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}
</urlset>
`);
console.log(`prerendered ${urls.length - 1} pages + sitemap.xml`);
