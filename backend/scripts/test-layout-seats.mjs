// Kiểm thử thuật toán đặt ghế vào hình khu (thuần toán học, không cần trình duyệt).
import assert from "node:assert";
import { placeSection } from "../../front-end/src/features/seatmap/layoutSeats.js";

const grid = (rows, perRow, blocked = {}) => {
  const seats = [];
  rows.forEach((r, ri) => {
    for (let n = 1; n <= perRow; n++) {
      if ((blocked[r] || []).includes(n)) continue;
      seats.push({ _id: `${r}${n}`, row: r, number: String(n), x: (n - 1) * 30 + (n > 6 ? 22 : 0), y: ri * 34 });
    }
  });
  return seats;
};
const C = { x: 500, y: 40 };
// khu hình quạt: r 250..350, góc -50..-4 độ (so với phương thẳng đứng xuống) quanh sân khấu C
const rad = (d) => (d * Math.PI) / 180;
const inSector = (x, y) => {
  const r = Math.hypot(x - C.x, y - C.y), a = Math.atan2(x - C.x, y - C.y);
  return r >= 250 && r <= 350 && a >= rad(-50) && a <= rad(-4);
};
const bbox = { x: 500 - 350, y: 40 + 250 * Math.cos(rad(50)), w: 350 - 0, h: 350 - 250 * Math.cos(rad(50)) };

// --- ARC
const seats = grid(["A", "B", "C", "D"], 12, { A: [1, 12] });
const r1 = placeSection({ seats, layout: "ARC", bbox: { x: 150, y: 40, w: 350, h: 320 }, inside: inSector, stage: C });
assert.strictEqual(r1.positions.size, seats.length);
const all = [...r1.positions.values()];
assert(all.every((p) => inSector(p.x, p.y)), "mọi ghế ARC phải nằm trong khu");
const dist = (id) => { const p = r1.positions.get(id); return Math.hypot(p.x - C.x, p.y - C.y); };
assert(dist("A2") < dist("B2") && dist("B2") < dist("C2") && dist("C2") < dist("D2"), "hàng A sát sân khấu nhất");
assert(Math.abs(dist("B1") - dist("B12")) < 0.01, "một hàng nằm trên cùng một cung tròn");
const px = (id) => r1.positions.get(id).x;
assert(px("B1") < px("B12"), "số ghế tăng từ trái sang phải");
assert(px("B7") - px("B6") > px("B6") - px("B5") * 1 - 1e6 && px("B7") - px("B6") > (px("B6") - px("B5")) * 1.2, "lối đi sau ghế 6 rộng hơn khoảng thường");
assert(r1.radius > 1.5 && r1.radius <= 16);
// không chồng ghế: khoảng cách nhỏ nhất giữa 2 ghế >= 1.6 * bán kính
let minD = Infinity;
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) minD = Math.min(minD, Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y));
assert(minD >= r1.radius * 1.6, `ghế chồng nhau: minD=${minD.toFixed(2)} r=${r1.radius.toFixed(2)}`);

// --- STRAIGHT trong hình chữ nhật
const rect = { x: 100, y: 100, w: 300, h: 120 };
const inRect = (x, y) => x >= 100 && x <= 400 && y >= 100 && y <= 220;
const s2 = grid(["A", "B", "C"], 10);
const r2 = placeSection({ seats: s2, layout: "STRAIGHT", bbox: rect, inside: inRect });
assert([...r2.positions.values()].every((p) => inRect(p.x, p.y)));
assert(px === px && r2.positions.get("A1").x < r2.positions.get("A10").x && r2.positions.get("A1").y < r2.positions.get("C1").y);

// --- STRAIGHT trong hình tam giác: tự thu nhỏ để mọi ghế nằm trong
const tri = (x, y) => y >= 100 && y <= 300 && x >= 250 - (y - 100) * 0.5 && x <= 250 + (y - 100) * 0.5;
const r3 = placeSection({ seats: grid(["A", "B", "C", "D"], 8), layout: "STRAIGHT", bbox: { x: 150, y: 100, w: 200, h: 200 }, inside: tri });
assert([...r3.positions.values()].every((p) => tri(p.x, p.y)), "ghế trong tam giác");

// --- hình méo + ARC thiếu điểm mẫu vẫn không văng lỗi
const r4 = placeSection({ seats: grid(["A"], 3), layout: "ARC", bbox: { x: 0, y: 0, w: 5, h: 5 }, inside: () => false, stage: C });
assert.strictEqual(r4.positions.size, 3);
console.log("OK layoutSeats: ARC, STRAIGHT (chữ nhật, tam giác), dự phòng");
