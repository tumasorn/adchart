// Footer visit counter. Counts one view per page load; "visitor" = first view of the day in
// this browser (remembered in localStorage). Only the live site counts — local copies peek.
(() => {
  const el = document.getElementById("siteStats");
  const C = window.APP_CONFIG || {};
  if (!el || !C.API_URL) return;
  const url = C.API_URL.replace(/\/rankings$/, "/stats");
  const live = /(^|\.)github\.io$/.test(location.hostname);

  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Bangkok date
  let newVisitor = false;
  try {
    if (localStorage.getItem("adchart_seen") !== today) { newVisitor = true; localStorage.setItem("adchart_seen", today); }
  } catch { /* private mode: count the view, not the visitor */ }

  const n = (x) => Number(x || 0).toLocaleString("th-TH");
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(live ? { new_visitor: newVisitor } : { peek: true }),
    keepalive: true,
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((s) => {
      el.innerHTML = `
        <span class="stat"><b>${n(s.today_visitors)}</b> คนวันนี้</span>
        <span class="stat"><b>${n(s.today_views)}</b> ครั้งวันนี้</span>
        <span class="stat"><b>${n(s.total_visitors)}</b> คนทั้งหมด</span>
        <span class="stat"><b>${n(s.total_views)}</b> ครั้งทั้งหมด</span>`;
      el.hidden = false;
    })
    .catch(() => { /* stats are optional: hide on failure */ });
})();
