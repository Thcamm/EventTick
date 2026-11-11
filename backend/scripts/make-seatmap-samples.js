/**
 * Sinh file mẫu vào samples/seatmap/: zone_map.svg, seating_manifest.xlsx và preview.html.
 * preview.html mở thẳng bằng trình duyệt: ghế nằm trên sơ đồ, bấm để chọn (dùng CHÍNH thuật toán đặt ghế của front-end).
 */
const fs = require("fs");
const path = require("path");
const { SAMPLE_SVG, SAMPLE_ROWS, buildSampleWorkbookBuffer } = require("../src/utils/seatmapTemplate");
const { seatsOfSection } = require("../src/utils/seatGrid");

const dir = path.join(__dirname, "../../samples/seatmap");
fs.mkdirSync(dir, { recursive: true });

const secs = {};
for (const r of SAMPLE_ROWS) {
  const s = (secs[r[0]] ||= { section_id: r[0], name: r[1], type: r[2], tier: r[3], layout: r[10] || "STRAIGHT", capacity: 0, rows: [] });
  if (r[2] === "GA") s.capacity = r[4];
  else {
    const num = (v) => String(v || "").split(",").filter(Boolean).map(Number);
    s.rows.push({ label: r[5], from: r[6], to: r[7], aisles: num(r[8]), blocked: num(r[9]) });
  }
}
const sections = Object.values(secs);
sections.forEach((s) => { if (s.type === "SEATED") s.capacity = seatsOfSection(s).length; });
const seats = [];
sections.filter((s) => s.type === "SEATED").forEach((s) =>
  seatsOfSection(s).forEach((p, i) => seats.push({ _id: `${s.section_id}|${p.row}|${p.number}`, section: s.section_id, row: p.row, number: p.number, x: p.x, y: p.y, status: i % 9 === 4 ? "SOLD" : "AVAILABLE" })));

const algo = fs.readFileSync(path.join(__dirname, "../../front-end/src/features/seatmap/layoutSeats.js"), "utf8").replace(/^export /gm, "");
const color = { VIP: "#e8222d", "CAT 1": "#7b3f98", GA: "#06b6d4" };
const price = { VIP: 2000000, "CAT 1": 1000000, GA: 500000 };
const data = JSON.stringify({ sections: sections.map((s) => ({ sectionId: s.section_id, name: s.name, type: s.type, tier: s.tier, layout: s.layout, capacity: s.capacity, color: color[s.tier], price: price[s.tier] })), seats });

const html = `<!doctype html><meta charset="utf-8"><title>Xem trước sơ đồ chỗ ngồi mẫu</title>
<style>
body{margin:0;background:#000;color:#e5e7eb;font:14px/1.5 sans-serif}
h2{text-align:center;margin:16px 0 4px}p.hint{text-align:center;color:#9ca3af;margin:0 0 8px}
.wrap{position:relative;max-width:1000px;margin:0 auto}
.wrap>svg{width:100%;height:auto;display:block}
#layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#layer circle{pointer-events:auto;stroke:rgba(15,23,42,.45);stroke-width:.6}
.available{fill:#fff;cursor:pointer}.available:hover{stroke:#2dc274;stroke-width:1.6}
.selected{fill:#2dc274;stroke:#fff;stroke-width:1.2;cursor:pointer}.unavailable{fill:#ef4444;cursor:not-allowed}
[id^="SEC_"]{stroke:#fff;stroke-width:1.5}
.bar{position:sticky;bottom:0;background:#1f2026;border-top:1px solid #2e303a;padding:12px 24px;display:flex;gap:24px;align-items:center;justify-content:center}
.legend span{margin-right:16px}.legend i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-2px}
#tip{position:fixed;display:none;background:#111218;border:1px solid #3a3d4a;border-radius:8px;padding:8px 12px;pointer-events:none;font-size:13px}
</style>
<h2>Sơ đồ mẫu — bấm ghế trắng để chọn</h2>
<p class="hint">Ghế do thuật toán đặt vào đúng hình khu (hàng cong quanh sân khấu). Ghế đỏ = đã bán / không chọn được.</p>
<div class="wrap" id="wrap">${SAMPLE_SVG}<svg id="layer"></svg></div>
<div class="bar"><div class="legend"><span><i style="background:#fff"></i>Trống</span><span><i style="background:#2dc274"></i>Đang chọn</span><span><i style="background:#ef4444"></i>Không chọn được</span></div><div id="sum">Chưa chọn ghế</div></div>
<div id="tip"></div>
<script>
${algo}
const DATA = ${data};
const wrap = document.getElementById("wrap"), layer = document.getElementById("layer"), tip = document.getElementById("tip"), sum = document.getElementById("sum");
const byId = Object.fromEntries(DATA.sections.map((s) => [s.sectionId, s]));
const fmt = (v) => v.toLocaleString("vi-VN") + " đ";
document.querySelectorAll('[id^="STAGE_"]').forEach((e) => e.style.fill = "#9ca3af");
document.querySelectorAll('[id^="SEC_"]').forEach((e) => e.style.fill = byId[e.id].color);
const out = layoutAllSeats(wrap, DATA.sections, DATA.seats);
layer.setAttribute("viewBox", out.vb);
const picked = new Set();
function refresh() {
  let total = 0;
  picked.forEach((id) => { const s = DATA.seats.find((x) => x._id === id); total += byId[s.section].price; });
  sum.textContent = picked.size ? picked.size + " ghế · " + fmt(total) : "Chưa chọn ghế";
}
DATA.seats.forEach((seat) => {
  const pl = out.bySection[seat.section]; if (!pl) return;
  const p = pl.positions.get(String(seat._id)); if (!p) return;
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", pl.radius);
  const free = seat.status === "AVAILABLE";
  c.setAttribute("class", free ? "available" : "unavailable");
  c.onclick = () => {
    if (!free) return;
    if (picked.has(seat._id)) { picked.delete(seat._id); c.setAttribute("class", "available"); }
    else { picked.add(seat._id); c.setAttribute("class", "selected"); }
    refresh();
  };
  c.onmousemove = (e) => { const s = byId[seat.section]; tip.style.display = "block"; tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 14 + "px";
    tip.innerHTML = "<b>" + s.name + "</b> · Hàng " + seat.row + " · Ghế " + seat.number + "<br>" + s.tier + " · " + fmt(s.price) + "<br>" + (free ? "Còn trống" : "Không chọn được"); };
  c.onmouseleave = () => tip.style.display = "none";
  layer.appendChild(c);
});
</script>`;

(async () => {
  fs.writeFileSync(path.join(dir, "zone_map.svg"), SAMPLE_SVG);
  fs.writeFileSync(path.join(dir, "seating_manifest.xlsx"), await buildSampleWorkbookBuffer());
  fs.writeFileSync(path.join(dir, "preview.html"), html);
  console.log("OK ->", dir, "|", seats.length, "ghế");
})();
