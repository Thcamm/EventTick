const ExcelJS = require("exceljs");

/**
 * File mẫu để Admin / Organizer tham khảo: zone_map.svg + seating_manifest.xlsx.
 * Mẫu mô phỏng sơ đồ concert: sân khấu bán nguyệt, các khu ghế hình quạt bao quanh (Layout = ARC), khu đứng GA ở phía sau.
 */
const CX = 500, CY = 40; // tâm cung = tâm sân khấu
const pt = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + r * Math.sin(a)).toFixed(1)},${(CY + r * Math.cos(a)).toFixed(1)}`;
};
/** Hình quạt: bán kính r0..r1, góc d0..d1 (độ, 0 = thẳng xuống từ sân khấu, âm = bên trái). */
const sector = (id, r0, r1, d0, d1) =>
  `<path id="${id}" d="M${pt(r1, d0)} A${r1} ${r1} 0 0 0 ${pt(r1, d1)} L${pt(r0, d1)} A${r0} ${r0} 0 0 1 ${pt(r0, d0)} Z"/>`;

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700">
  <path id="STAGE_MAIN" data-center="${CX},${CY}" d="M350,${CY} L650,${CY} A150,150 0 0 1 350,${CY} Z" fill="#9ca3af"/>
  <text x="${CX}" y="${CY + 78}" text-anchor="middle" fill="#fff" font-size="40" font-family="sans-serif">STAGE</text>

  ${sector("SEC_VIP_L", 180, 280, -40, -3)}
  ${sector("SEC_VIP_R", 180, 280, 3, 40)}
  ${sector("SEC_CAT1_L", 290, 390, -50, -3)}
  ${sector("SEC_CAT1_R", 290, 390, 3, 50)}
  <rect id="SEC_GA" x="300" y="490" width="400" height="150" rx="14"/>
  <text x="${CX}" y="575" text-anchor="middle" fill="#fff" font-size="22" font-family="sans-serif">KHU ĐỨNG (GA)</text>
  <rect id="FOH" x="440" y="655" width="120" height="30" fill="#555"/>
</svg>
`;

const HEADERS = ["Section_ID", "Section_Name", "Type", "Tier_Name", "Capacity", "Row_Label", "Seat_From", "Seat_To", "Aisles_After", "Blocked_Seats", "Layout"];

const rows = (sectionId, name, tier, labels, from, to, aisles, layout, blocked = {}) =>
  labels.map((l) => [sectionId, name, "SEATED", tier, "", l, from, to, aisles, blocked[l] || "", layout]);

const SAMPLE_ROWS = [
  ...rows("SEC_VIP_L", "VIP Trái", "VIP", ["A", "B", "C", "D"], 1, 10, "", "ARC", { A: "1,10" }),
  ...rows("SEC_VIP_R", "VIP Phải", "VIP", ["A", "B", "C", "D"], 1, 10, "", "ARC", { A: "1,10" }),
  ...rows("SEC_CAT1_L", "CAT 1 Trái", "CAT 1", ["A", "B", "C", "D", "E"], 1, 14, "7", "ARC"),
  ...rows("SEC_CAT1_R", "CAT 1 Phải", "CAT 1", ["A", "B", "C", "D", "E"], 1, 14, "7", "ARC"),
  ["SEC_GA", "Khu đứng GA", "GA", "GA", 500, "", "", "", "", "", "STRAIGHT"],
];

async function buildSampleWorkbookBuffer() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("seating_manifest");
  ws.addRow(HEADERS).font = { bold: true };
  SAMPLE_ROWS.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 16));

  const guide = wb.addWorksheet("huong_dan");
  [
    ["Cột", "Ý nghĩa"],
    ["Section_ID", "Phải trùng 100% với id của khu trong SVG (bắt đầu bằng SEC_). Một khu có thể có nhiều dòng (mỗi dòng một hàng ghế)."],
    ["Section_Name", "Tên hiển thị của khu."],
    ["Type", "SEATED (ghế đánh số) hoặc GA (vé đứng, bán theo số lượng)."],
    ["Tier_Name", "Tên hạng vé (đã tạo trong sự kiện, mỗi suất diễn đều phải có). Nhiều khu có thể dùng chung 1 hạng vé."],
    ["Capacity", "Chỉ dùng cho khu GA: sức chứa."],
    ["Row_Label", "Chỉ dùng cho khu SEATED: nhãn hàng (A, B, C...). Thứ tự dòng = thứ tự hàng từ sân khấu ra sau (hàng đầu sát sân khấu nhất)."],
    ["Seat_From / Seat_To", "Số ghế đầu và cuối của hàng. Số ghế tăng từ trái sang phải."],
    ["Aisles_After", "Các số ghế có lối đi phía sau, ngăn cách bằng dấu phẩy. VD: 6 hoặc 5,15."],
    ["Blocked_Seats", "Ghế khoá không bán (vướng cột...). Vị trí vẫn được giữ trống trên sơ đồ."],
    ["Layout", "STRAIGHT (mặc định): hàng ghế thẳng, dàn đều trong hình khu. ARC: hàng ghế cong quanh sân khấu (khu hình quạt ở khán đài concert). Với ARC, sân khấu trong SVG nên có id STAGE_… và có thể thêm thuộc tính data-center=\"x,y\" để chỉ tâm cung."],
  ].forEach((r) => guide.addRow(r));
  guide.getColumn(1).width = 22;
  guide.getColumn(2).width = 110;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { SAMPLE_SVG, SAMPLE_ROWS, HEADERS, buildSampleWorkbookBuffer };
