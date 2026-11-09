/**
 * Lưới ghế của một khu, tính từ cấu hình hàng trong seating_manifest.xlsx.
 * Tọa độ chỉ là "lưới tương đối": cột theo số ghế (các hàng thẳng cột), cộng khoảng trống cho mỗi lối đi phía trước.
 * Front-end đặt lưới này vào đúng hình của khu trên SVG (xem front-end/src/features/seatmap/layoutSeats.js).
 */
const CELL = 30; // bước giữa 2 ghế liền kề
const AISLE = 22; // khoảng trống thêm cho mỗi lối đi
const ROW_STEP = 34; // bước giữa 2 hàng

/** sec.rows: [{ label, from, to, aisles[], blocked[] }] -> [{ row, number, x, y }] (ghế khóa không được sinh) */
function seatsOfSection(sec) {
  const minFrom = Math.min(...sec.rows.map((r) => r.from));
  const out = [];
  sec.rows.forEach((r, ri) => {
    for (let n = r.from; n <= r.to; n++) {
      if (r.blocked.includes(n)) continue;
      out.push({ row: r.label, number: String(n), x: (n - minFrom) * CELL + r.aisles.filter((a) => a < n).length * AISLE, y: ri * ROW_STEP });
    }
  });
  return out;
}

/** Ghế xem trước (chưa có _id thật, chưa gắn hạng vé) cho mọi khu SEATED — dùng ở màn Admin kiểm tra / xem sơ đồ hiện tại. */
function previewSeats(sections) {
  const out = [];
  for (const sec of sections) {
    if (sec.type !== "SEATED") continue;
    for (const p of seatsOfSection(sec)) {
      out.push({ _id: `${sec.section_id}|${p.row}|${p.number}`, section: sec.section_id, row: p.row, number: p.number, x: p.x, y: p.y, status: "AVAILABLE", tierId: null });
    }
  }
  return out;
}

module.exports = { CELL, AISLE, ROW_STEP, seatsOfSection, previewSeats };
