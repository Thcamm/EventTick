/**
 * Kiểm thử quản lý sự kiện của Nhà tổ chức: UC22 (tạo), UC23 (sửa / rút / huỷ), UC25 (hạng vé),
 * UC24 (Admin dựng sơ đồ từ SVG + Excel), UC28 (voucher), và đặt vé trộn khu GA + ghế đánh số.
 *
 * Chạy:  BASE=http://localhost:3999 node scripts/test-organizer-events.js
 * Cần: npm run seed; server đang chạy (khuyên chạy với CLOUDINARY_CLOUD_NAME= rỗng để tệp lưu cục bộ); Redis chạy.
 * Dữ liệu test có tiền tố "TEST-ORG" và tự dọn sau khi chạy (không đụng dữ liệu seed).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
  return cond;
};

async function api(method, p, { cookie, json, form } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let body; try { body = JSON.parse(buf.toString()); } catch { body = null; }
  return { status: res.status, body, buf, type: res.headers.get("content-type") || "", setCookie: res.headers.get("set-cookie") };
}
const login = async (u, pw = "123456") => (await api("POST", "/v1/auth/login", { json: { username: u, password: pw } })).setCookie.split(";")[0];
const iso = (days) => new Date(Date.now() + days * 864e5).toISOString();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const eventForm = (over = {}) => {
  const f = new FormData();
  f.append("data", JSON.stringify({
    title: "TEST-ORG Sự kiện kiểm thử", category: "Thể Thao", venueName: "Sân A, Hà Nội",
    sessions: [{ name: "Đêm 1", startTime: iso(20), tickets: [{ name: "GA", price: 100000, quantity: 50 }] }],
    ...over,
  }));
  return f;
};

(async () => {
  const started = new Date();
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const oid = (s) => new mongoose.Types.ObjectId(s);

  // organizer thứ hai (đã KYC) để kiểm tra phân quyền giữa các organizer
  const org2 = (await db.collection("users").insertOne({
    email: "org2-test@t.vn", username: "test_org2", password_hash: await bcrypt.hash("123456", 10), full_name: "Org Hai",
    role: "ORGANIZER", status: "ACTIVE", created_at: new Date(),
  })).insertedId;
  await db.collection("organizer_profiles").insertOne({
    user_id: org2, organization_name: "Org 2", business_type: "INDIVIDUAL", tax_code: "0312345679", id_card_or_license_url: "x",
    bank_name: "BIDV", bank_account_no: "123456789", bank_account_holder: "ORG 2", kyc_status: "VERIFIED",
  });

  const org = await login("demo_organizer");
  const other = await login("test_org2");
  const customer = await login("demo_user");
  const admin = await login("demo_admin");
  const uploaded = [];

  try {
    // ============================================================ UC22: tạo sự kiện
    check("customer không tạo được sự kiện (403)", (await api("POST", "/v1/events", { cookie: customer, form: eventForm() })).status === 403);
    check("chưa đăng nhập không tạo được (401)", (await api("POST", "/v1/events", { form: eventForm() })).status === 401);
    const bad = async (name, over, code = 400) => check(`tạo sự kiện: ${name} -> ${code}`, (await api("POST", "/v1/events", { cookie: org, form: eventForm(over) })).status === code);
    await bad("không có suất diễn", { sessions: [] });
    await bad("suất diễn đã qua", { sessions: [{ startTime: iso(-1), tickets: [{ name: "GA", price: 1, quantity: 1 }] }] });
    await bad("giá âm", { sessions: [{ startTime: iso(5), tickets: [{ name: "GA", price: -5, quantity: 10 }] }] });
    await bad("số lượng 0", { sessions: [{ startTime: iso(5), tickets: [{ name: "GA", price: 1000, quantity: 0 }] }] });
    await bad("min/đơn > max/đơn", { sessions: [{ startTime: iso(5), tickets: [{ name: "GA", price: 1000, quantity: 5, minPerOrder: 5, maxPerOrder: 2 }] }] });
    await bad("zoneColor sai", { sessions: [{ startTime: iso(5), tickets: [{ name: "GA", price: 1000, quantity: 5, zoneColor: "red" }] }] });
    await bad("kết thúc trước bắt đầu", { sessions: [{ startTime: iso(6), endTime: iso(5), tickets: [{ name: "GA", price: 1000, quantity: 5 }] }] });
    await bad("trần giá bán lại 500%", { maxResaleMarkupPct: 500 });
    await bad("form: key không hợp lệ", { customFormSchema: [{ key: "1abc", label: "x", type: "text" }] });
    await bad("form: select thiếu lựa chọn", { customFormSchema: [{ key: "size", label: "Cỡ áo", type: "select", options: ["S"] }] });
    await bad("suất không có hạng vé (không phải nháp)", { sessions: [{ startTime: iso(5), tickets: [] }] });
    const noJson = new FormData(); noJson.append("data", "{khong phai json");
    check("data không phải JSON -> 400", (await api("POST", "/v1/events", { cookie: org, form: noJson })).status === 400);
    const fakeImg = eventForm(); fakeImg.append("backgroundImage", new Blob([Buffer.from("khong phai anh, noi dung dai hon muc toi thieu")]), "a.png");
    check("ảnh giả (đuôi .png nhưng không phải ảnh) bị từ chối", (await api("POST", "/v1/events", { cookie: org, form: fakeImg })).status === 400);

    const draft = await api("POST", "/v1/events", { cookie: org, form: eventForm({ saveAsDraft: true, sessions: [{ name: "Đêm 1", startTime: iso(20) }], allowResale: true, maxResaleMarkupPct: 15,
      customFormSchema: [{ key: "size", label: "Cỡ áo", type: "select", options: ["S", "M", "L"], required: true }, { key: "note", label: "Ghi chú", type: "text" }] }) });
    check("lưu bản nháp (chưa có hạng vé) -> 201 DRAFT", draft.status === 201 && draft.body.status === "DRAFT", draft.body?.message);
    const E = draft.body.eventId;
    const det0 = (await api("GET", `/v1/organizer/events/${E}`, { cookie: org })).body.event;
    check("chi tiết đọc lại đúng chính sách + form", det0.allowResale && det0.maxResaleMarkupPct === 15 && det0.customFormSchema.length === 2);
    const S = det0.sessions[0]._id;
    check("nháp chưa hiện công khai", !(await api("GET", "/v1/events/search?name=" + encodeURIComponent("TEST-ORG"))).body.events.length);

    // ------------------------------------------------ giấy phép biểu diễn (riêng tư)
    const lf = new FormData(); lf.append("document", new Blob([Buffer.from("noi dung khong phai anh hay pdf, du dai de qua kiem tra")]), "gp.pdf");
    check("giấy phép không phải ảnh/PDF bị từ chối", (await api("PUT", `/v1/organizer/events/${E}/legal-doc`, { cookie: org, form: lf })).status === 400);
    const lf2 = new FormData(); lf2.append("document", new Blob([PNG]), "gp.png");
    const lr = await api("PUT", `/v1/organizer/events/${E}/legal-doc`, { cookie: org, form: lf2 });
    check("nộp giấy phép hợp lệ", lr.status === 200 && lr.body.hasLegalDoc);
    check("phản hồi chi tiết không lộ đường dẫn giấy phép", !JSON.stringify((await api("GET", `/v1/organizer/events/${E}`, { cookie: org })).body).includes("private:"));
    const ld = await api("GET", `/v1/admin/events/${E}/legal-doc`, { cookie: admin });
    check("admin xem được giấy phép", ld.status === 200 && (ld.type.startsWith("image/") || !!ld.body?.url));
    check("organizer không xem được giấy phép qua API admin (403)", (await api("GET", `/v1/admin/events/${E}/legal-doc`, { cookie: org })).status === 403);

    // ------------------------------------------------ ảnh
    const imf = new FormData(); imf.append("backgroundImage", new Blob([PNG]), "bg.png");
    const im = await api("PUT", `/v1/organizer/events/${E}/images`, { cookie: org, form: imf });
    check("đổi ảnh bìa", im.status === 200 && !!im.body.bannerUrl, im.body?.message);
    if (im.body?.bannerUrl?.includes("/uploads/")) uploaded.push(path.basename(im.body.bannerUrl));

    // ============================================================ phân quyền giữa organizer
    check("organizer khác không xem được sự kiện (404)", (await api("GET", `/v1/organizer/events/${E}`, { cookie: other })).status === 404);
    check("organizer khác không sửa được (404)", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: other, json: { title: "hack" } })).status === 404);
    check("organizer khác không huỷ được (404)", (await api("POST", `/v1/organizer/events/${E}/cancel`, { cookie: other })).status === 404);
    check("organizer khác không thêm hạng vé vào suất này (404)", (await api("POST", `/v1/organizer/sessions/${S}/tiers`, { cookie: other, json: { name: "x", price: 1, totalQuantity: 1 } })).status === 404);
    check("organizer khác không tạo voucher cho sự kiện này (404)", (await api("POST", `/v1/organizer/events/${E}/vouchers`, { cookie: other, json: { code: "HACK1", discountType: "FIXED", discountValue: 1, usageLimit: 1, validUntil: iso(5) } })).status === 404);
    check("customer không vào được API organizer (403)", (await api("GET", "/v1/organizer/events", { cookie: customer })).status === 403);
    check("danh sách sự kiện chỉ của mình", !(await api("GET", "/v1/organizer/events", { cookie: other })).body.events.some((e) => e._id === E));

    // ============================================================ UC25: hạng vé
    check("gửi duyệt khi chưa có hạng vé bị từ chối (400)", (await api("POST", `/v1/organizer/events/${E}/submit`, { cookie: org })).status === 400);
    const addTier = (json) => api("POST", `/v1/organizer/sessions/${S}/tiers`, { cookie: org, json });
    check("thêm hạng vé: giá âm -> 400", (await addTier({ name: "x", price: -1, totalQuantity: 5 })).status === 400);
    check("thêm hạng vé: thiếu tên -> 400", (await addTier({ price: 1000, totalQuantity: 5 })).status === 400);
    check("thêm hạng vé: giờ đóng bán trước giờ mở -> 400", (await addTier({ name: "x", price: 1000, totalQuantity: 5, saleStartTime: iso(9), saleEndTime: iso(8) })).status === 400);
    const ga = await addTier({ name: "GA Đứng", price: 100000, totalQuantity: 50, maxPerOrder: 4, zoneColor: "#22c55e" });
    check("thêm hạng vé GA hợp lệ -> 201", ga.status === 201 && ga.body.tier.zoneType === "GA" && ga.body.tier.availableQuantity === 50);
    const GA = ga.body.tier._id;
    const seated = await addTier({ name: "Ghế Ngồi", price: 200000, totalQuantity: 1 });
    const SEATED = seated.body.tier._id;
    check("thêm hạng vé thứ hai", seated.status === 201);
    check("lowest_price của sự kiện cập nhật theo hạng vé rẻ nhất", (await db.collection("events").findOne({ _id: oid(E) })).lowest_price === 100000);

    // ------------------------------------------------ sơ đồ chỗ ngồi (UC24): Admin dựng từ SVG + Excel
    const ExcelJS = require("exceljs");
    const smSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect id="STAGE_MAIN" x="100" y="10" width="200" height="40"/><rect id="SEC_A" x="50" y="80" width="300" height="100"/><rect id="SEC_GA" x="50" y="200" width="300" height="80"/></svg>';
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("seating_manifest");
    ws.addRow(["Section_ID", "Section_Name", "Type", "Tier_Name", "Capacity", "Row_Label", "Seat_From", "Seat_To", "Aisles_After", "Blocked_Seats"]);
    ["A", "B", "C"].forEach((r) => ws.addRow(["SEC_A", "Khu A", "SEATED", "Ghế Ngồi", "", r, 1, 4, "", ""]));
    ws.addRow(["SEC_GA", "Khu đứng", "GA", "GA Đứng", 50, "", "", "", "", ""]);
    const smXlsx = Buffer.from(await wb.xlsx.writeBuffer());
    const smFiles = () => { const f = new FormData(); f.append("svgFile", new Blob([smSvg]), "zone_map.svg"); f.append("excelFile", new Blob([smXlsx]), "seating_manifest.xlsx"); return f; };
    const smUrl = `/v1/admin/events/${E}/seatmap`;
    check("organizer không dựng được sơ đồ (403)", (await api("POST", smUrl, { cookie: org, form: smFiles() })).status === 403);
    const imp = await api("POST", smUrl, { cookie: admin, form: smFiles() });
    check("admin dựng sơ đồ từ SVG + Excel -> 201", imp.status === 201, imp.body?.message);
    check("DB có đúng 12 ghế", (await db.collection("seats").countDocuments({ tier_id: oid(SEATED) })) === 12);
    const tierDb = await db.collection("ticket_tiers").findOne({ _id: oid(SEATED) });
    check("hạng vé chuyển SEATED, số lượng = số ghế", tierDb.zone_type === "SEATED" && tierDb.total_quantity === 12 && tierDb.available_quantity === 12);
    check("sự kiện được đánh dấu có sơ đồ ghế", (await db.collection("events").findOne({ _id: oid(E) })).has_seat_map === true);
    check("dựng lại khi chưa bán vé được (thay thế ghế cũ)", (await api("POST", smUrl, { cookie: admin, form: smFiles() })).status === 201 && (await db.collection("seats").countDocuments({ tier_id: oid(SEATED) })) === 12);
    const noTotal = await api("PUT", `/v1/organizer/tiers/${SEATED}`, { cookie: org, json: { totalQuantity: 5 } });
    check("hạng vé theo ghế: không đổi totalQuantity tay được (400)", noTotal.status === 400);
    check("organizer không còn API sinh ghế (404)", (await api("POST", `/v1/organizer/tiers/${SEATED}/generate-seats`, { cookie: org, json: {} })).status === 404);
    check("sự kiện chưa duyệt: sơ đồ công khai 404", (await api("GET", `/v1/events/sessions/${S}/seat-map`)).status === 404);

    // ============================================================ UC23: gửi duyệt / rút / sửa
    const sub = await api("POST", `/v1/organizer/events/${E}/submit`, { cookie: org });
    check("gửi duyệt -> PENDING", sub.status === 200 && sub.body.status === "PENDING", sub.body?.message);
    check("gửi duyệt lần 2 bị từ chối (409)", (await api("POST", `/v1/organizer/events/${E}/submit`, { cookie: org })).status === 409);
    check("PENDING: không sửa tiêu đề (409)", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { title: "Đổi tên" } })).status === 409);
    check("PENDING: sửa mô tả được", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { description: "<p>Mô tả mới</p>" } })).status === 200);
    check("PENDING: không thêm hạng vé (409)", (await addTier({ name: "x", price: 1000, totalQuantity: 5 })).status === 409);
    check("PENDING: organizer không còn API sinh ghế / lưu sơ đồ (404)", (await api("POST", `/v1/organizer/tiers/${SEATED}/generate-seats`, { cookie: org, json: {} })).status === 404);
    const wd = await api("POST", `/v1/organizer/events/${E}/withdraw`, { cookie: org });
    check("rút lại -> DRAFT", wd.status === 200 && wd.body.status === "DRAFT");
    check("rút lại khi đã là DRAFT bị từ chối (409)", (await api("POST", `/v1/organizer/events/${E}/withdraw`, { cookie: org })).status === 409);
    check("DRAFT: sửa tiêu đề + trần giá bán lại", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { title: "TEST-ORG Sự kiện đã đổi tên", maxResaleMarkupPct: 20 } })).status === 200);
    check("sửa: trần giá bán lại 150% -> 400", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { maxResaleMarkupPct: 150 } })).status === 400);
    check("sửa: không có trường nào -> 400", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: {} })).status === 400);
    check("sửa: danh mục không tồn tại -> 400", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { category: "Danh mục ma" } })).status === 400);

    // suất diễn (DRAFT)
    const s2 = await api("POST", `/v1/organizer/events/${E}/sessions`, { cookie: org, json: { name: "Đêm 2", startTime: iso(21) } });
    check("thêm suất diễn khi DRAFT", s2.status === 201);
    const S2 = s2.body.sessionId;
    check("thêm suất: đã qua -> 400", (await api("POST", `/v1/organizer/events/${E}/sessions`, { cookie: org, json: { startTime: iso(-3) } })).status === 400);
    check("khoảng thời gian sự kiện được tính lại theo các suất", (await db.collection("events").findOne({ _id: oid(E) })).end_time > (await db.collection("events").findOne({ _id: oid(E) })).start_time);
    check("gửi duyệt khi một suất chưa có hạng vé bị từ chối (400)", (await api("POST", `/v1/organizer/events/${E}/submit`, { cookie: org })).status === 400);
    check("sửa giờ suất diễn", (await api("PUT", `/v1/organizer/sessions/${S2}`, { cookie: org, json: { startTime: iso(22) } })).status === 200);
    check("xoá suất diễn (chưa có đơn)", (await api("DELETE", `/v1/organizer/sessions/${S2}`, { cookie: org })).status === 200);
    check("không xoá được suất diễn cuối cùng (409)", (await api("DELETE", `/v1/organizer/sessions/${S}`, { cookie: org })).status === 409);

    // sửa hạng vé
    check("sửa giá hạng vé", (await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { price: 120000 } })).body?.tier?.price === 120000);
    check("sửa hạng vé: min > max -> 400", (await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { minPerOrder: 5, maxPerOrder: 2 } })).status === 400);
    check("sửa hạng vé: màu sai -> 400", (await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { zoneColor: "xanh" } })).status === 400);
    await db.collection("ticket_tiers").updateOne({ _id: oid(GA) }, { $set: { available_quantity: 45 } }); // giả lập đã bán / giữ 5 vé
    const shrink = await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { totalQuantity: 3 } });
    check("không giảm số lượng dưới số vé đã bán/giữ (409)", shrink.status === 409, shrink.body?.message);
    const grow = await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { totalQuantity: 8 } });
    check("giảm về 8 (>= 5 đã bán): còn lại = 3", grow.status === 200 && grow.body.tier.totalQuantity === 8 && grow.body.tier.availableQuantity === 3, JSON.stringify(grow.body?.tier && { t: grow.body.tier.totalQuantity, a: grow.body.tier.availableQuantity }));
    const up = await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: org, json: { totalQuantity: 60 } });
    check("tăng lên 60: còn lại = 55", up.status === 200 && up.body.tier.availableQuantity === 55);
    check("không xoá được hạng vé đã bán (409)", (await api("DELETE", `/v1/organizer/tiers/${GA}`, { cookie: org })).status === 409);
    const vip = await addTier({ name: "Tạm", price: 5000, totalQuantity: 5 });
    check("xoá hạng vé chưa bán", (await api("DELETE", `/v1/organizer/tiers/${vip.body.tier._id}`, { cookie: org })).status === 200);
    check("organizer khác không sửa / xoá được hạng vé (404)", (await api("PUT", `/v1/organizer/tiers/${GA}`, { cookie: other, json: { price: 1 } })).status === 404 && (await api("DELETE", `/v1/organizer/tiers/${GA}`, { cookie: other })).status === 404);
    await db.collection("ticket_tiers").updateOne({ _id: oid(GA) }, { $set: { available_quantity: 60, total_quantity: 60 } }); // trả về trạng thái chưa bán để test đặt vé

    // ============================================================ UC28: voucher
    const vcPost = (json, cookie = org) => api("POST", `/v1/organizer/events/${E}/vouchers`, { cookie, json });
    const okV = { code: "test-v10", discountType: "FIXED", discountValue: 10000, usageLimit: 5, maxPerUser: 1, validUntil: iso(30) };
    check("voucher: mã quá ngắn -> 400", (await vcPost({ ...okV, code: "ab" })).status === 400);
    check("voucher: mã có ký tự lạ -> 400", (await vcPost({ ...okV, code: "A B!" })).status === 400);
    check("voucher: loại giảm sai -> 400", (await vcPost({ ...okV, discountType: "GIFT" })).status === 400);
    check("voucher: giảm % > 100 -> 400", (await vcPost({ ...okV, code: "PCT101", discountType: "PERCENT", discountValue: 101 })).status === 400);
    check("voucher: giảm âm -> 400", (await vcPost({ ...okV, code: "NEG1", discountValue: -5 })).status === 400);
    check("voucher: hết hạn trước ngày bắt đầu -> 400", (await vcPost({ ...okV, code: "BADDATE", validFrom: iso(10), validUntil: iso(5) })).status === 400);
    check("voucher: trần giảm cho loại FIXED -> 400", (await vcPost({ ...okV, code: "MAXFIX", maxDiscountAmount: 5000 })).status === 400);
    check("voucher: usageLimit 0 -> 400", (await vcPost({ ...okV, code: "LIM0", usageLimit: 0 })).status === 400);
    const v1 = await vcPost(okV);
    check("tạo voucher hợp lệ, mã được chuẩn hoá chữ hoa", v1.status === 201 && v1.body.voucher.code === "TEST-V10", v1.body?.message);
    check("trùng mã trong cùng sự kiện -> 409", (await vcPost(okV)).status === 409);
    check("liệt kê voucher của sự kiện", (await api("GET", `/v1/organizer/events/${E}/vouchers`, { cookie: org })).body.items.some((v) => v.code === "TEST-V10"));
    const V1 = v1.body.voucher._id;
    check("organizer khác không sửa / xoá voucher (404)", (await api("PUT", `/v1/organizer/vouchers/${V1}`, { cookie: other, json: { isActive: false } })).status === 404 && (await api("DELETE", `/v1/organizer/vouchers/${V1}`, { cookie: other })).status === 404);
    check("sửa voucher chưa dùng: đổi mức giảm", (await api("PUT", `/v1/organizer/vouchers/${V1}`, { cookie: org, json: { discountValue: 20000 } })).body?.voucher?.discountValue === 20000);
    const pctV = await vcPost({ code: "TEST-PCT", discountType: "PERCENT", discountValue: 10, maxDiscountAmount: 50000, usageLimit: 3, validUntil: iso(30) });
    check("tạo voucher %, có trần giảm", pctV.status === 201 && pctV.body.voucher.maxDiscountAmount === 50000);
    check("xoá voucher chưa dùng", (await api("DELETE", `/v1/organizer/vouchers/${pctV.body.voucher._id}`, { cookie: org })).status === 200);

    // ============================================================ đặt vé thật trên sự kiện đã xuất bản
    await db.collection("events").updateOne({ _id: oid(E) }, { $set: { status: "PUBLISHED" } });
    const pub = await api("GET", `/v1/events/sessions/${S}/seat-map`);
    check("sơ đồ công khai trả SVG + khu (giá, còn bao nhiêu)", pub.status === 200 && pub.body.hasMap && pub.body.sections.length === 2 && pub.body.svgContent.includes("SEC_A"), pub.body?.message);
    check("sơ đồ công khai phân biệt khu GA và khu ghế", pub.body.sections.some((z) => z.type === "GA") && pub.body.sections.some((z) => z.type === "SEATED"));
    const seatList = (await api("GET", `/v1/events/sessions/${S}/seats`)).body.seats;
    check("danh sách ghế của suất có 12 ghế", seatList.length === 12);
    const [s1, s2s] = seatList.map((s) => s._id);
    const book = (items, extra = {}, cookie = customer) => api("POST", "/v1/booking", { cookie, json: { eventId: E, sessionId: S, items, ...extra } });

    check("đặt khu ghế bằng tierId + quantity bị từ chối (400)", (await book([{ tierId: SEATED, quantity: 1 }])).status === 400);
    const mixed = await book([{ tierId: GA, quantity: 2 }, { seatIds: [s1, s2s] }], { voucherCode: "test-v10" });
    check("đặt trộn: 2 vé GA + 2 ghế đánh số + voucher -> thành công", mixed.status === 200 && mixed.body.discountAmount === 20000, mixed.body?.message);
    const ord = await db.collection("orders").findOne({ _id: oid(mixed.body.orderId) });
    check("đơn lưu đủ 2 dòng, dòng ghế có đúng 2 seat_ids", ord.items_snapshot.length === 2 && ord.items_snapshot.find((i) => i.seat_ids.length === 2));
    check("tổng tiền = 2×120.000 + 2×200.000 - 20.000", ord.total_amount === 240000 + 400000 - 20000, String(ord.total_amount));
    check("đặt lại đúng ghế đó bị từ chối (409)", (await book([{ seatIds: [s1] }], {}, admin)).status === 409);
    const reimp = await api("POST", `/v1/admin/events/${E}/seatmap`, { cookie: admin, form: smFiles() });
    check("dựng lại sơ đồ khi đang có ghế bị giữ bị từ chối (409)", reimp.status === 409, reimp.body?.message);
    check("voucher đã có người dùng: không đổi mức giảm (409)", (await api("PUT", `/v1/organizer/vouchers/${V1}`, { cookie: org, json: { discountValue: 1 } })).status === 409);
    check("voucher đã có người dùng: không xoá (409)", (await api("DELETE", `/v1/organizer/vouchers/${V1}`, { cookie: org })).status === 409);
    check("tắt voucher đã dùng được", (await api("PUT", `/v1/organizer/vouchers/${V1}`, { cookie: org, json: { isActive: false } })).status === 200);
    const cancelO = await api("POST", `/v1/booking/orders/${mixed.body.orderId}/cancel`, { cookie: customer });
    check("khách huỷ đơn: trả ghế, hoàn kho, hoàn lượt voucher", cancelO.status === 200 && (await db.collection("seats").countDocuments({ tier_id: oid(SEATED), status: { $ne: "AVAILABLE" } })) === 0 && (await db.collection("ticket_tiers").findOne({ _id: oid(GA) })).available_quantity === 60 && (await db.collection("vouchers").findOne({ _id: oid(V1) })).used_count === 0);
    check("voucher đã tắt không dùng được (400)", (await book([{ tierId: GA, quantity: 1 }], { voucherCode: "TEST-V10" })).status === 400);

    // ============================================================ huỷ sự kiện
    const pend = await book([{ tierId: GA, quantity: 3 }]);
    check("có đơn đang giữ chỗ trước khi huỷ", pend.status === 200 && (await db.collection("ticket_tiers").findOne({ _id: oid(GA) })).available_quantity === 57);
    await db.collection("orders").insertOne({ buyer_id: (await db.collection("users").findOne({ username: "demo_user" }))._id, event_id: oid(E), session_id: oid(S), order_code: "ORD-20200101-TESTPD", order_type: "PRIMARY",
      items_snapshot: [{ tier_id: oid(GA), tier_name: "GA", unit_price: 1, quantity: 1, seat_ids: [] }], subtotal_amount: 1, discount_amount: 0, total_amount: 1, status: "PAID", lock_expires_at: new Date(), created_at: new Date() });
    const blocked = await api("POST", `/v1/organizer/events/${E}/cancel`, { cookie: org });
    check("sự kiện đã có đơn thanh toán: không tự huỷ được (409)", blocked.status === 409, blocked.body?.message);
    await db.collection("orders").deleteOne({ order_code: "ORD-20200101-TESTPD" });
    const canc = await api("POST", `/v1/organizer/events/${E}/cancel`, { cookie: org });
    check("huỷ sự kiện (không có đơn trả tiền) -> CANCELLED, nhả 1 đơn giữ chỗ", canc.status === 200 && canc.body.releasedOrders === 1, canc.body?.message);
    check("kho vé được hoàn lại sau khi huỷ", (await db.collection("ticket_tiers").findOne({ _id: oid(GA) })).available_quantity === 60);
    check("suất diễn chuyển CANCELLED", (await db.collection("event_sessions").findOne({ _id: oid(S) })).status === "CANCELLED");
    check("sự kiện đã huỷ không đặt vé được (400)", (await book([{ tierId: GA, quantity: 1 }])).status === 400);
    check("sự kiện đã huỷ không sửa được (409)", (await api("PUT", `/v1/organizer/events/${E}`, { cookie: org, json: { description: "x" } })).status === 409);
    check("huỷ lần 2 bị từ chối (409)", (await api("POST", `/v1/organizer/events/${E}/cancel`, { cookie: org })).status === 409);
    check("sự kiện đã huỷ không hiện công khai", !(await api("GET", "/v1/events/search?name=" + encodeURIComponent("TEST-ORG"))).body.events.length);

    // ============================================================ nhật ký
    const acts = (await db.collection("audit_logs").find({ created_at: { $gte: started } }).toArray()).map((l) => l.action);
    check("nhật ký kiểm toán ghi các thao tác (tạo, nộp, sửa hạng vé, dựng sơ đồ, voucher, huỷ)",
      ["EVENT_CREATE_DRAFT", "EVENT_SUBMIT", "TIER_CREATE", "SEATMAP_IMPORT", "VOUCHER_CREATE", "EVENT_CANCEL"].every((a) => acts.includes(a)));
  } finally {
    // ---------------- dọn dữ liệu test (chỉ sự kiện TEST-ORG; không đụng dữ liệu seed)
    const evs = await db.collection("events").find({ title: /^TEST-ORG/ }).toArray();
    const ids = evs.map((e) => e._id);
    const { deletePrivate } = require("../src/services/privateStorage");
    for (const e of evs) await deletePrivate(e.legal_doc_url).catch(() => {});
    const orders = await db.collection("orders").find({ event_id: { $in: ids } }).toArray();
    const oids = orders.map((o) => o._id);
    for (const c of ["tickets", "payments"]) await db.collection(c).deleteMany({ order_id: { $in: oids } });
    for (const c of ["orders", "vouchers", "seats", "ticket_tiers", "event_sessions", "e_contracts", "staff_assignments"]) await db.collection(c).deleteMany({ event_id: { $in: ids } });
    await db.collection("events").deleteMany({ _id: { $in: ids } });
    await db.collection("organizer_profiles").deleteMany({ user_id: org2 });
    await db.collection("users").deleteOne({ _id: org2 });
    await db.collection("audit_logs").deleteMany({ created_at: { $gte: started } });
    for (const f of uploaded) fs.rmSync(path.join(__dirname, "../uploads", f), { force: true });
    await mongoose.disconnect();
    console.log(`\nKết quả: ${pass} pass, ${failN} fail`);
    process.exit(failN ? 1 : 0);
  }
})().catch((e) => { console.error("Test lỗi:", e); process.exit(1); });
