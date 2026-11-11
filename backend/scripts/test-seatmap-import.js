/**
 * Kiểm thử luồng dựng sơ đồ: Admin tải zone_map.svg + seating_manifest.xlsx -> kiểm tra -> lưu -> khách xem sơ đồ công khai.
 * Chạy:  BASE=http://localhost:3999 node scripts/test-seatmap-import.js
 * Cần: npm run seed (demo_admin, demo_organizer, demo_user); server đang chạy. Dữ liệu test tiền tố "TEST-SM", tự dọn.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const { SAMPLE_SVG, HEADERS, SAMPLE_ROWS } = require("../src/utils/seatmapTemplate");

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
};
async function api(method, p, { cookie, form } = {}) {
  const res = await fetch(BASE + p, { method, headers: cookie ? { Cookie: cookie } : {}, body: form });
  const buf = Buffer.from(await res.arrayBuffer());
  let body; try { body = JSON.parse(buf.toString()); } catch { body = null; }
  return { status: res.status, body, buf, setCookie: res.headers.get("set-cookie") };
}
const login = async (u) => {
  const r = await fetch(BASE + "/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: "123456" }) });
  return r.headers.get("set-cookie").split(";")[0];
};
async function xlsx(rows, headers = HEADERS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("seating_manifest");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const files = (svg, xls) => {
  const f = new FormData();
  if (svg) f.append("svgFile", new Blob([svg], { type: "image/svg+xml" }), "zone_map.svg");
  if (xls) f.append("excelFile", new Blob([xls]), "seating_manifest.xlsx");
  return f;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const oid = (s) => new mongoose.Types.ObjectId(s);
  const admin = await login("demo_admin");
  const org = await login("demo_organizer");
  const customer = await login("demo_user");
  const orgId = (await db.collection("users").findOne({ username: "demo_organizer" }))._id;
  const catId = (await db.collection("categories").findOne({}))._id;
  const now = Date.now();
  const mkEvent = async (title, status) => (await db.collection("events").insertOne({
    organizer_id: orgId, category_id: catId, title, description: "x", banner_url: "x", venue_name: "Sân", city: "HN",
    start_time: new Date(now + 20 * 864e5), end_time: new Date(now + 21 * 864e5), status, has_seat_map: false, created_at: new Date(),
  })).insertedId;
  const E = await mkEvent("TEST-SM Sự kiện", "APPROVED");
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const sid = (await db.collection("event_sessions").insertOne({
      event_id: E, name: `Suất ${i + 1}`, start_time: new Date(now + (20 + i) * 864e5), end_time: new Date(now + (20 + i) * 864e5 + 36e5), status: "SCHEDULED",
    })).insertedId;
    sessions.push(sid);
    for (const [name, price, qty] of [["VIP", 2000000, 1], ["CAT 1", 1000000, 1], ["GA", 500000, 1]]) {
      await db.collection("ticket_tiers").insertOne({
        event_id: E, session_id: sid, name, price, total_quantity: qty, available_quantity: qty, min_per_order: 1, max_per_order: 4,
        sale_start_time: new Date(now - 864e5), sale_end_time: new Date(now + 19 * 864e5), zone_type: "GA",
      });
    }
  }
  const draftE = await mkEvent("TEST-SM Nháp bị huỷ", "CANCELLED");

  try {
    const good = await xlsx(SAMPLE_ROWS);
    const url = `/v1/admin/events/${E}/seatmap`;

    // ---- phân quyền
    check("template.xlsx: admin tải được", (await api("GET", "/v1/admin/seatmap/template.xlsx", { cookie: admin })).buf.slice(0, 2).toString() === "PK");
    check("template.svg: admin tải được", (await api("GET", "/v1/admin/seatmap/template.svg", { cookie: admin })).buf.toString().includes("SEC_VIP_L"));
    check("organizer không dựng được sơ đồ (403)", (await api("POST", url, { cookie: org, form: files(SAMPLE_SVG, good) })).status === 403);
    check("customer không dựng được sơ đồ (403)", (await api("POST", url, { cookie: customer, form: files(SAMPLE_SVG, good) })).status === 403);
    check("chưa đăng nhập (401)", (await api("POST", url, { form: files(SAMPLE_SVG, good) })).status === 401);

    // ---- kiểm tra đầu vào
    check("thiếu file Excel -> 400", (await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, null) })).status === 400);
    check("sự kiện đã huỷ -> 409", (await api("POST", `/v1/admin/events/${draftE}/seatmap`, { cookie: admin, form: files(SAMPLE_SVG, good) })).status === 409);
    check("SVG không có SEC_ -> 400", (await api("POST", url, { cookie: admin, form: files('<svg viewBox="0 0 10 10"><rect id="A"/></svg>', good) })).status === 400);
    check("Excel không phải .xlsx -> 400", (await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, Buffer.from("a,b,c")) })).status === 400);

    const extraSvg = SAMPLE_SVG.replace("</svg>", '<rect id="SEC_THUA" x="0" y="0" width="5" height="5"/></svg>');
    const mismatch = await api("POST", url, { cookie: admin, form: files(extraSvg, await xlsx([...SAMPLE_ROWS, ["SEC_LA", "Lạ", "GA", "GA", 10, "", "", "", "", ""]])) });
    check("khu SVG/Excel lệch -> 400 kèm danh sách", mismatch.status === 400 && mismatch.body.details.onlyInSvg.includes("SEC_THUA") && mismatch.body.details.onlyInExcel.includes("SEC_LA"), JSON.stringify(mismatch.body?.details));

    const badRow = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, await xlsx(SAMPLE_ROWS.map((r) => (r[0] === "SEC_VIP_L" && r[5] === "B" ? [...r.slice(0, 8), "99", "", r[10]] : r)))) });
    check("Aisles_After ngoài phạm vi -> 400 kèm số dòng", badRow.status === 400 && /Dòng \d+/.test(badRow.body.details.errors[0]), JSON.stringify(badRow.body?.details));

    const missTier = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, await xlsx(SAMPLE_ROWS.map((r) => (r[3] === "CAT 1" ? [r[0], r[1], r[2], "KHÔNG CÓ", ...r.slice(4)] : r)))) });
    check("hạng vé chưa tồn tại -> 400 liệt kê theo suất", missTier.status === 400 && missTier.body.details.missingTiers.length === 2, JSON.stringify(missTier.body?.details));

    const gaShared = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, await xlsx(SAMPLE_ROWS.map((r) => (r[0] === "SEC_GA" ? [...r.slice(0, 3), "VIP", ...r.slice(4)] : r)))) });
    check("GA dùng chung hạng vé với khu ghế -> 400", gaShared.status === 400, gaShared.body?.message);

    // ---- dry-run không ghi
    const dry = await api("POST", url + "?dryRun=true", { cookie: admin, form: files(SAMPLE_SVG, good) });
    check("dryRun hợp lệ: trả tóm tắt, chưa ghi", dry.status === 200 && dry.body.dryRun && dry.body.summary.seatedPerSession === 38 + 38 + 70 + 70 && (await db.collection("seats").countDocuments({ event_id: E })) === 0, JSON.stringify(dry.body?.summary));

    // ---- lưu thật
    const save = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, good) });
    check("lưu sơ đồ -> 201", save.status === 201, save.body?.message);
    const perSession = 38 + 38 + 70 + 70;
    check("sinh đủ ghế cho mọi suất (loại ghế khóa)", (await db.collection("seats").countDocuments({ event_id: E })) === perSession * 2);
    check("ghế khóa không tồn tại trong DB", (await db.collection("seats").countDocuments({ event_id: E, section_name: "SEC_VIP_L", row_label: "A", seat_number: { $in: ["1", "10"] } })) === 0);
    const vip = await db.collection("ticket_tiers").findOne({ session_id: sessions[0], name: "VIP" });
    check("hạng vé VIP: SEATED, tổng = 38+38 (76)", vip.zone_type === "SEATED" && vip.total_quantity === 76 && vip.available_quantity === 76);
    const ga = await db.collection("ticket_tiers").findOne({ session_id: sessions[1], name: "GA" });
    check("hạng vé GA: GA, sức chứa 500", ga.zone_type === "GA" && ga.total_quantity === 500 && ga.available_quantity === 500);
    check("sự kiện có has_seat_map", (await db.collection("events").findOne({ _id: E })).has_seat_map === true);
    const b6 = await db.collection("seats").findOne({ session_id: sessions[0], section_name: "SEC_CAT1_L", row_label: "B", seat_number: "7" });
    const b7 = await db.collection("seats").findOne({ session_id: sessions[0], section_name: "SEC_CAT1_L", row_label: "B", seat_number: "8" });
    check("lối đi sau ghế 7 làm rộng khoảng cách", b7.coord_x - b6.coord_x === 52, `${b7.coord_x - b6.coord_x}`);

    // ---- khách xem công khai
    const pub = await api("GET", `/v1/events/sessions/${sessions[0]}/seat-map`);
    const secs = Object.fromEntries((pub.body.sections || []).map((s) => [s.sectionId, s]));
    check("sơ đồ công khai: có SVG và 5 khu", pub.body.hasMap && pub.body.svgContent.includes("SEC_VIP_L") && Object.keys(secs).length === 5);
    check("khu VIP Trái: giá, còn 38/38, SEATED, layout ARC", secs.SEC_VIP_L.price === 2000000 && secs.SEC_VIP_L.available === 38 && secs.SEC_VIP_L.type === "SEATED" && secs.SEC_VIP_L.layout === "ARC");
    check("khu GA: còn 500", secs.SEC_GA.type === "GA" && secs.SEC_GA.available === 500 && secs.SEC_GA.status === "AVAILABLE");
    check("SVG công khai không chứa script", !/<script|onload=|onclick=/i.test(pub.body.svgContent));
    const seats = (await api("GET", `/v1/events/sessions/${sessions[0]}/seats`)).body.seats;
    check("danh sách ghế: section = id khu SVG", seats.length === perSession && seats.every((s) => s.section.startsWith("SEC_")));

    // ---- khoá ghế -> số còn lại giảm; sau đó không cho dựng lại
    const held = seats.find((s) => s.section === "SEC_VIP_L");
    await db.collection("seats").updateOne({ _id: oid(held._id) }, { $set: { status: "SOLD" } });
    await db.collection("ticket_tiers").updateOne({ _id: vip._id }, { $inc: { available_quantity: -1 } });
    const pub2 = await api("GET", `/v1/events/sessions/${sessions[0]}/seat-map`);
    check("ghế đã bán: khu VIP Trái còn 37", pub2.body.sections.find((s) => s.sectionId === "SEC_VIP_L").available === 37);
    const again = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, good) });
    check("đã có vé bán -> không dựng lại (409)", again.status === 409, again.body?.message);
    const cur = await api("GET", url, { cookie: admin });
    check("admin xem được sơ đồ hiện tại kèm ghế xem trước", cur.body.hasMap && cur.body.summary.sections.length === 5 && cur.body.seats.length === perSession);
    check("dryRun cũng trả ghế xem trước", dry.body.seats.length === perSession && dry.body.summary.sections.find((x) => x.sectionId === "SEC_CAT1_L").layout === "ARC");
    const badLay = await api("POST", url, { cookie: admin, form: files(SAMPLE_SVG, await xlsx(SAMPLE_ROWS.map((r) => (r[0] === "SEC_GA" ? [...r.slice(0, 10), "SPIRAL"] : r)))) });
    check("Layout không hợp lệ -> 400 kèm số dòng", badLay.status === 400 && /Layout/.test(badLay.body.details.errors[0]), JSON.stringify(badLay.body?.details));
  } finally {
    const ids = [E, draftE];
    for (const c of ["seats", "ticket_tiers", "event_sessions", "seatmap_layouts"]) await db.collection(c).deleteMany({ event_id: { $in: ids } });
    await db.collection("events").deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} PASS, ${failN} FAIL`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
