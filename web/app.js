(() => {
  const C = window.APP_CONFIG || {};
  const DEMO = !C.API_URL;
  const $ = (s) => document.querySelector(s);
  const EMAIL_KEY = "adrank_email"; // kept from the old name so saved donor emails still work

  const store = {
    get() { try { return localStorage.getItem(EMAIL_KEY) || ""; } catch { return ""; } },
    set(v) { try { localStorage.setItem(EMAIL_KEY, v); } catch {} },
  };

  const one = (x) => (Math.round(x * 10) / 10).toLocaleString("th-TH");
  const fmt = (n) => n >= 1e6 ? `${one(n / 1e6)} ล้าน` : n >= 1e4 ? `${one(n / 1e4)} หมื่น` : n.toLocaleString("th-TH");
  const viewsHTML = (n) => `${fmt(n)}<small>วิว</small>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : "#");

  let state = { categories: [], current: "", email: store.get(), data: null };

  // ---------- API ----------
  async function api(category, email) {
    if (DEMO) return demoApi(category, email);
    const opts = email
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, email }) }
      : { method: "GET" };
    const url = email ? C.API_URL : `${C.API_URL}${category ? `?category=${encodeURIComponent(category)}` : ""}`;
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    return r.json();
  }

  // ---------- render ----------
  function renderTop3(list) {
    const el = $("#top3");
    if (!list?.length) { el.innerHTML = `<div class="empty">ยังไม่มีข้อมูล — ระบบจะเก็บข้อมูลรอบแรกเร็ว ๆ นี้</div>`; return; }
    el.innerHTML = list.map((a, i) => `
      <a class="card r${i + 1}" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener" aria-label="อันดับ ${i + 1}: ${esc(a.title)}">
        <div class="thumb">
          <img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" loading="${i ? "lazy" : "eager"}" />
          <span class="badge">#${i + 1}</span>
          <span class="play" aria-hidden="true">▶</span>
        </div>
        <div class="card-body">
          <div class="views">${viewsHTML(a.view_count)}</div>
          <div class="title">${esc(a.title)}</div>
        </div>
      </a>`).join("");
  }

  function renderChips() {
    $("#chips").innerHTML = state.categories.map((c) => `
      <button class="chip" type="button" data-id="${esc(c.id)}" aria-pressed="${c.id === state.current}">
        ${esc(c.emoji)} ${esc(c.name_th)}
      </button>`).join("");
  }

  const rowHTML = (a) => `
    <a class="row r${a.rank}" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">
      <span class="n">${a.rank}</span>
      <span class="t"><img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" loading="lazy" /></span>
      <span class="meta">
        <div class="v">${a.daily_gain != null
          ? `<span class="gain">▲ +${fmt(a.daily_gain)}</span><small>วิว/วัน</small><small class="total">· รวม ${fmt(a.view_count)}</small>`
          : viewsHTML(a.view_count)}</div>
        <div class="tt">${esc(a.title)}</div>
      </span>
    </a>`;

  const lockedRow = (n) => `
    <div class="row" aria-hidden="true">
      <span class="n">${n}</span><span class="t"></span>
      <span class="meta"><div class="bar" style="width:40%"></div><div class="bar" style="width:80%"></div></span>
    </div>`;

  function renderRanking(cat) {
    const el = $("#ranking");
    if (!cat || !cat.items?.length) {
      el.innerHTML = `<div class="empty">${cat?.id === "trending"
        ? "กำลังเก็บยอดวิวรายวัน — อันดับมาแรงจะขึ้นหลังรอบอัปเดตถัดไป"
        : "หมวดนี้ยังไม่มีข้อมูล"}</div>`;
      return;
    }
    let html = (cat.id === "trending" ? `<p class="note">เรียงตามยอดวิวที่เพิ่มขึ้นต่อวัน</p>` : "") + cat.items.map(rowHTML).join("");
    const hidden = Math.max(0, (cat.total || 10) - cat.items.length);
    if (!cat.unlocked && hidden > 0) {
      const from = cat.items.length + 1, to = cat.items.length + hidden;
      html += `
        <div class="locked">
          ${Array.from({ length: hidden }, (_, i) => lockedRow(from + i)).join("")}
          <div class="unlock">
            <h3>🔒 อันดับ ${from}–${to} ถูกล็อกไว้</h3>
            <p>บริจาคเล็กน้อยผ่าน Ko-fi หรือ Stripe เพื่อดูครบ 10 อันดับทุกหมวด</p>
            <button class="btn primary" type="button" data-open-donate>☕ บริจาคเพื่อดูต่อ</button>
            ${state.email ? `<p style="font-size:12px">อีเมล ${esc(state.email)} ยังไม่พบการบริจาค · <a href="#" data-open-donate style="text-decoration:underline">เปลี่ยนอีเมล</a></p>` : ""}
          </div>
        </div>`;
    }
    el.innerHTML = html;
  }

  function renderUpdated(ts) {
    $("#updated").textContent = ts
      ? `อัปเดต ${new Date(ts).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`
      : "";
  }

  // ---------- flow ----------
  let seq = 0; // only the latest request may render (a slow earlier one must not overwrite it)
  async function load(category) {
    const my = ++seq;
    state.current = category;
    renderChips();
    $("#ranking").innerHTML = `<div class="skel" style="height:280px"></div>`;
    try {
      const d = await api(category, state.email);
      if (my !== seq) return d;
      state.data = d;
      if (!state.categories.length) {
        state.categories = d.categories || [];
        if (!category && state.categories[0]) return load(state.categories[0].id);
      }
      renderTop3(d.top3);
      renderUpdated(d.updatedAt);
      renderChips();
      renderRanking(d.category);
      return d;
    } catch (e) {
      if (my !== seq) return;
      $("#ranking").innerHTML = `<div class="empty">${esc(e.message)} <br><button class="btn primary" style="margin-top:12px" onclick="location.reload()">ลองใหม่</button></div>`;
    }
  }

  // ---------- donate sheet ----------
  const dlg = $("#donate");
  function openDonate() {
    $("#email").value = state.email;
    $("#unlockDays").textContent = C.UNLOCK_DAYS || 30;
    $("#msg").textContent = ""; $("#msg").className = "msg";
    syncPayLinks();
    dlg.showModal();
  }
  function syncPayLinks() {
    const email = $("#email").value.trim();
    $("#kofiBtn").href = C.KOFI_URL;
    const s = new URL(C.STRIPE_LINK, location.href);
    if (email) s.searchParams.set("prefilled_email", email);
    $("#stripeBtn").href = s.toString();
  }
  function remember() {
    const e = $("#email").value.trim().toLowerCase();
    if (e) { state.email = e; store.set(e); }
  }

  $("#email").addEventListener("input", syncPayLinks);
  $("#kofiBtn").addEventListener("click", remember);
  $("#stripeBtn").addEventListener("click", remember);

  $("#checkBtn").addEventListener("click", async () => {
    const e = $("#email").value.trim().toLowerCase();
    const msg = $("#msg");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { msg.textContent = "กรุณาใส่อีเมลให้ถูกต้อง"; msg.className = "msg err"; return; }
    state.email = e; store.set(e);
    const btn = $("#checkBtn"); btn.disabled = true; msg.textContent = "กำลังตรวจสอบ…"; msg.className = "msg";
    const d = await load(state.current);
    btn.disabled = false;
    if (d?.category?.unlocked) {
      msg.textContent = "ปลดล็อกแล้ว ขอบคุณที่สนับสนุน 💖"; msg.className = "msg ok";
      setTimeout(() => dlg.close(), 900);
    } else {
      msg.textContent = "ยังไม่พบการบริจาคจากอีเมลนี้ — ถ้าเพิ่งจ่าย รอสักครู่แล้วลองอีกครั้ง"; msg.className = "msg err";
    }
  });

  document.addEventListener("click", (ev) => {
    const chip = ev.target.closest(".chip");
    if (chip) {
      ev.preventDefault(); // pre-rendered chips are <a href="food.html"> links for crawlers
      load(chip.dataset.id);
      // on the built site each category has its own page: keep the address bar shareable
      if (document.body.dataset.ssr === "1") {
        history.replaceState(null, "", `${chip.dataset.id}.html`);
        retitle(chip.dataset.id);
      }
      return;
    }
    if (ev.target.closest("[data-open-donate]")) { ev.preventDefault(); openDonate(); }
  });
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); }); // tap backdrop to close

  // ---------- demo data (used only when API_URL is empty) ----------
  function demoApi(category, email) {
    const cats = [
      ["food", "อาหารและเครื่องดื่ม", "🍜", ["#ff7a45", "#ffc94a"]],
      ["tech", "มือถือและเทคโนโลยี", "📱", ["#4f7cff", "#7ee2ff"]],
      ["car", "รถยนต์", "🚗", ["#3a3a4c", "#ff3d5a"]],
      ["beauty", "ความงาม", "💄", ["#ff5fa2", "#ffd1e8"]],
      ["finance", "ธนาคารและประกัน", "🏦", ["#16a36b", "#a7f0c9"]],
      ["emotion", "โฆษณาซึ้ง", "🥹", ["#8a5cff", "#ffb3c7"]],
    ];
    const thumb = (emoji, [a, b], n) => "data:image/svg+xml;utf8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><text x="160" y="108" font-size="64" text-anchor="middle">${emoji}</text><text x="300" y="166" font-size="16" fill="#fff" fill-opacity=".8" text-anchor="end" font-family="sans-serif">DEMO ${n}</text></svg>`);
    const all = {};
    cats.forEach(([id, name, emoji, col], ci) => {
      all[id] = Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1, category_id: id, video_id: `${id}${i}`,
        title: `ตัวอย่างโฆษณาหมวด${name} อันดับ ${i + 1}`,
        thumbnail_url: thumb(emoji, col, i + 1),
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent("โฆษณา " + name)}`,
        view_count: Math.round((98e6 - ci * 9e6) / (1 + i * 0.6)),
        scraped_at: new Date(new Date().setHours(3, 0, 0, 0)).toISOString(),
      }));
    });
    const top3 = Object.values(all).flat().sort((a, b) => b.view_count - a.view_count).slice(0, 3);
    const unlocked = !!email && email.endsWith("@demo.com"); // demo: any @demo.com email counts as a donor
    const out = {
      categories: cats.map(([id, name_th, emoji]) => ({ id, name_th, emoji })),
      top3, updatedAt: top3[0].scraped_at,
    };
    if (category) out.category = { id: category, items: all[category].slice(0, unlocked ? 10 : 3), total: 10, unlocked };
    return new Promise((r) => setTimeout(() => r(out), 250));
  }

  // keep heading / intro / tab title in step with the category page we just switched to
  // (same wording as build/prerender.mjs)
  function retitle(id) {
    const c = state.categories.find((x) => x.id === id);
    if (!c) return;
    const trend = id === "trending";
    const name = trend ? "โฆษณามาแรง" : c.name_th.startsWith("โฆษณา") ? c.name_th : `โฆษณา${c.name_th}`;
    const suffix = trend ? " ยอดวิวพุ่งต่อวัน" : " ยอดวิวสูงสุด";
    const h1 = document.querySelector(".page-title"), intro = document.querySelector(".intro");
    if (h1) h1.textContent = `${c.emoji} ${name}${suffix}`;
    if (intro) intro.textContent = trend
      ? "โฆษณาไทยจากช่องทางการของแบรนด์ เรียงตามยอดวิวที่เพิ่มขึ้นต่อวัน อัปเดตทุกวัน — อันดับ 1–3 ดูฟรี"
      : `${name} 10 อันดับ จากช่องทางการของแบรนด์ เรียงตามยอดวิว อัปเดตทุกวัน — อันดับ 1–3 ดูฟรี`;
    document.title = `${name}${trend ? " ยอดวิวพุ่งต่อวัน" : " ยอดวิวสูงสุด 10 อันดับ"} — แอดชาร์ต AdChart TH`;
  }

  if (DEMO) $("#demoBanner").hidden = false;
  // category pages (food.html, car.html…) are pre-rendered at build time with data-category set
  load(document.body.dataset.category || "");
})();
