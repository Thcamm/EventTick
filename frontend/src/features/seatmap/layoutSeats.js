/**
 * Đặt ghế vào đúng hình của khu trên mặt bằng SVG.
 *
 * Backend chỉ gửi lưới tương đối (row, number, x, y: các hàng thẳng cột, đã có khoảng trống lối đi).
 * Ở đây ta "đổ" lưới đó vào hình khu:
 *   STRAIGHT: kéo lưới cho vừa khung chữ nhật của khu, thu nhỏ dần cho tới khi mọi ghế nằm trong hình khu.
 *   ARC:      mỗi hàng là một cung tròn quanh sân khấu (hàng đầu sát sân khấu), ghế trải đều theo góc mà khu chiếm
 *             ở bán kính đó -> hàng ghế cong theo khán đài như sơ đồ concert.
 *
 * placeSection là hàm thuần (không đụng DOM) để kiểm thử được; shapeTools là lớp mỏng nối với DOM SVG.
 */
const SHAPES = "path, polygon, rect, circle, ellipse, polyline";
const SAMPLE_N = 70;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x <= -Math.PI) x += 2 * Math.PI;
  return x;
};
const minPositiveGap = (sortedValues) => {
  let g = Infinity;
  for (let i = 1; i < sortedValues.length; i++) {
    const d = sortedValues[i] - sortedValues[i - 1];
    if (d > 1e-9 && d < g) g = d;
  }
  return g;
};

function groupRows(seats) {
  const ys = [...new Set(seats.map((s) => s.y))].sort((a, b) => a - b);
  const rows = ys.map(() => []);
  seats.forEach((s) => rows[ys.indexOf(s.y)].push(s));
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));
  return { rows, ys };
}

function samplePoints(bbox, inside) {
  const pts = [];
  for (let i = 0; i < SAMPLE_N; i++) {
    for (let j = 0; j < SAMPLE_N; j++) {
      const x = bbox.x + ((i + 0.5) / SAMPLE_N) * bbox.w;
      const y = bbox.y + ((j + 0.5) / SAMPLE_N) * bbox.h;
      if (inside(x, y)) pts.push({ x, y });
    }
  }
  return pts;
}

function placeStraight({ seats, bbox, inside, center }) {
  const xs = seats.map((s) => s.x), ys = seats.map((s) => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = maxX - minX, H = maxY - minY;
  const put = (f) => {
    const fw = bbox.w * f, fh = bbox.h * f;
    return seats.map((s) => ({
      id: String(s._id),
      x: center.x - fw / 2 + (W > 0 ? ((s.x - minX) / W) * fw : fw / 2),
      y: center.y - fh / 2 + (H > 0 ? ((s.y - minY) / H) * fh : fh / 2),
    }));
  };
  let f = 1, placed = put(f);
  while (f > 0.3 && !placed.every((p) => inside(p.x, p.y))) {
    f = +(f - 0.05).toFixed(2);
    placed = put(f);
  }
  const { rows, ys: rowYs } = groupRows(seats);
  const colGap = Math.min(...rows.map((r) => minPositiveGap(r.map((s) => s.x))));
  const rowGap = minPositiveGap(rowYs);
  const spX = W > 0 && Number.isFinite(colGap) ? (colGap / W) * bbox.w * f : Infinity;
  const spY = H > 0 && Number.isFinite(rowGap) ? (rowGap / H) * bbox.h * f : Infinity;
  const sp = Math.min(spX, spY);
  return { placed, radius: clamp(0.38 * (Number.isFinite(sp) ? sp : 10), 1.5, 16) };
}

function placeArc({ seats, pts, center, stage }) {
  const { rows } = groupRows(seats);
  const R = rows.length;
  const base = Math.atan2(center.x - stage.x, center.y - stage.y); // hướng từ sân khấu tới khu
  const polar = pts.map((p) => ({ r: Math.hypot(p.x - stage.x, p.y - stage.y), a: wrap(Math.atan2(p.x - stage.x, p.y - stage.y) - base) }));
  const rmin = Math.min(...polar.map((p) => p.r)), rmax = Math.max(...polar.map((p) => p.r));
  const rowGap = (rmax - rmin) / R;
  const gA = { min: Math.min(...polar.map((p) => p.a)), max: Math.max(...polar.map((p) => p.a)) };

  const placed = [];
  let minSp = rowGap;
  rows.forEach((row, i) => {
    const ri = rmin + (i + 0.5) * rowGap;
    const near = polar.filter((p) => Math.abs(p.r - ri) <= rowGap / 2);
    let a0 = near.length ? Math.min(...near.map((p) => p.a)) : gA.min;
    let a1 = near.length ? Math.max(...near.map((p) => p.a)) : gA.max;
    const pad = (rowGap * 0.5) / ri; // chừa nửa ghế ở hai đầu hàng
    if (a1 - a0 > 2 * pad) { a0 += pad; a1 -= pad; } else { a0 = a1 = (a0 + a1) / 2; }
    const x0 = row[0].x, w = row[row.length - 1].x - x0;
    const ts = row.map((s) => (w > 0 ? (s.x - x0) / w : 0.5));
    const g = minPositiveGap(ts);
    if (Number.isFinite(g)) minSp = Math.min(minSp, ri * (a1 - a0) * g);
    row.forEach((s, k) => {
      const ang = base + a0 + ts[k] * (a1 - a0);
      placed.push({ id: String(s._id), x: stage.x + ri * Math.sin(ang), y: stage.y + ri * Math.cos(ang), ri, ang });
    });
  });
  return { placed, radius: clamp(0.38 * minSp, 1.5, 16), rowGap };
}

/**
 * seats: [{ _id, row, number, x, y }] của một khu.  layout: "STRAIGHT" | "ARC".
 * bbox: {x, y, w, h} của khu (tọa độ SVG).  inside(x, y): điểm có nằm trong hình khu không.
 * stage: {x, y} tâm cung (chỉ cần cho ARC).  Trả về { positions: Map(id -> {x, y}), radius }.
 */
export function placeSection({ seats, layout, bbox, inside, stage }) {
  if (!seats.length) return { positions: new Map(), radius: 4 };
  const pts = samplePoints(bbox, inside);
  const center = pts.length
    ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length }
    : { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };

  let out;
  if (layout === "ARC" && pts.length > 10 && stage) {
    out = placeArc({ seats, pts, center, stage });
    // ghế rơi ra ngoài hình khu (hình méo): dịch dọc bán kính vào lại trong khu
    const step = (out.rowGap || 4) / 4;
    out.placed.forEach((p) => {
      if (inside(p.x, p.y)) return;
      for (let d = 1; d <= 8; d++) {
        for (const sgn of [1, -1]) {
          const r2 = p.ri + sgn * d * step;
          const x = stage.x + r2 * Math.sin(p.ang), y = stage.y + r2 * Math.cos(p.ang);
          if (inside(x, y)) { p.x = x; p.y = y; return; }
        }
      }
    });
  } else {
    out = placeStraight({ seats, bbox, inside, center });
  }
  return { positions: new Map(out.placed.map((p) => [p.id, { x: p.x, y: p.y }])), radius: out.radius };
}

// ---------------------------------------------------------------- DOM SVG

/** Hình học của một phần tử SVG (khu / sân khấu) trong hệ tọa độ của thẻ <svg> gốc. */
export function shapeTools(root, el) {
  const rootCtm = root.getScreenCTM?.();
  if (!rootCtm) return null;
  const rootInv = rootCtm.inverse();
  const nodes = el.matches?.(SHAPES) ? [el] : [...el.querySelectorAll(SHAPES)];
  const items = nodes
    .map((n) => {
      const ctm = n.getScreenCTM?.();
      if (!ctm) return null;
      const m = rootInv.multiply(ctm);
      return { n, m, inv: m.inverse() };
    })
    .filter(Boolean);
  if (!items.length) return null;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  items.forEach(({ n, m }) => {
    const b = n.getBBox();
    [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].forEach(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(m);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    });
  });
  const bbox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const inside = (x, y) =>
    items.some(({ n, inv }) => {
      const p = new DOMPoint(x, y).matrixTransform(inv);
      return typeof n.isPointInFill === "function" ? n.isPointInFill(p) : true;
    });
  return { bbox, inside };
}

/** Tâm cung của sân khấu: thuộc tính data-center="x,y" nếu có, không thì tâm khung chữ nhật của sân khấu. */
export function stageCenter(root) {
  const el = root.querySelector('[id^="STAGE_"]');
  if (!el) return null;
  const dc = (el.getAttribute("data-center") || "").split(",").map(Number);
  if (dc.length === 2 && dc.every(Number.isFinite)) return { x: dc[0], y: dc[1] };
  const t = shapeTools(root, el);
  return t ? { x: t.bbox.x + t.bbox.w / 2, y: t.bbox.y + t.bbox.h / 2 } : null;
}

/** Tính vị trí mọi ghế trên mặt bằng. sections: [{ sectionId, layout }]; seats có thuộc tính `section`. */
export function layoutAllSeats(root, sections, seats) {
  const svg = root.querySelector("svg");
  if (!svg) return { vb: null, bySection: {} };
  const stage = stageCenter(svg);
  const grouped = new Map();
  seats.forEach((s) => {
    if (!grouped.has(s.section)) grouped.set(s.section, []);
    grouped.get(s.section).push(s);
  });
  const bySection = {};
  sections.forEach((sec) => {
    const list = grouped.get(sec.sectionId);
    if (!list?.length) return;
    const el = [...svg.querySelectorAll('[id^="SEC_"]')].find((n) => n.id === sec.sectionId);
    const tools = el && shapeTools(svg, el);
    if (!tools) return;
    bySection[sec.sectionId] = placeSection({ seats: list, layout: sec.layout, bbox: tools.bbox, inside: tools.inside, stage });
  });
  return { vb: svg.getAttribute("viewBox"), bySection };
}
