/**
 * Kiểm thử chuỗi: KYC (UC21, UC38) -> tạo sự kiện -> Admin duyệt + hoa hồng (UC39, UC41)
 * -> Organizer ký hợp đồng (UC27) -> sự kiện PUBLISHED.
 *
 * Chạy:  BASE=http://localhost:3999 node scripts/test-organizer-flow.js
 * Cần: npm run seed; server đang chạy. Khuyến nghị chạy server với CLOUDINARY_CLOUD_NAME= (rỗng)
 * để tài liệu test lưu cục bộ thay vì đẩy lên Cloudinary.
 * Script tự dọn dữ liệu test (trả demo_user về CUSTOMER, xóa hồ sơ/sự kiện/hợp đồng tạo ra).
 */
require("dotenv").config();
const zlib = require("zlib");
const mongoose = require("mongoose");

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
};

async function api(method, path, { cookie, json, form } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let body;
  try { body = JSON.parse(buf.toString()); } catch { body = null; }
  return { status: res.status, body, buf, type: res.headers.get("content-type") || "", setCookie: res.headers.get("set-cookie") };
}
const login = async (u) => (await api("POST", "/v1/auth/login", { json: { username: u, password: "123456" } })).setCookie.split(";")[0];

// PNG hợp lệ có nhiễu (đủ lớn để không bị coi là "chữ ký trống")
function makePng(w = 120, h = 60) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let i = 0; i < raw.length; i++) raw[i] = (i % (w * 3 + 1)) === 0 ? 0 : Math.floor(Math.random() * 256);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const kycForm = (over = {}, file = makePng(), fname = "cccd.png") => {
  const f = new FormData();
  const fields = { organizationName: "Công ty Test Sự Kiện", businessType: "ENTERPRISE", taxCode: "0312345678", bankName: "Vietcombank", bankAccountNo: "0123456789", bankAccountHolder: "CONG TY TEST", ...over };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, v);
  if (file) f.append("document", new Blob([file]), fname);
  return f;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const customer = await login("demo_user");
  const admin = await login("demo_admin");
  const otherOrg = await login("demo_organizer");
  const staff = await login("demo_staff");
  const userDoc = await db.collection("users").findOne({ username: "demo_user" });
  let createdEventId, contractId;

  try {
    // ---------------- UC21: gửi KYC
    check("chưa đăng nhập không gửi được KYC (401)", (await api("POST", "/v1/organizer/kyc", { form: kycForm() })).status === 401);
    const txt = await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm({}, Buffer.from("day khong phai anh, chi la van ban dai hon muc toi thieu"), "x.png") });
    check("tệp không phải ảnh/PDF bị từ chối (đuôi .png giả)", txt.status === 400, txt.body?.message);
    check("mã số thuế sai định dạng bị từ chối", (await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm({ taxCode: "ABC" }) })).status === 400);
    check("số tài khoản sai định dạng bị từ chối", (await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm({ bankAccountNo: "12ab" }) })).status === 400);
    check("thiếu tệp giấy tờ bị từ chối", (await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm({}, null) })).status === 400);
    check("STAFF không đăng ký làm organizer được (403)", (await api("POST", "/v1/organizer/kyc", { cookie: staff, form: kycForm() })).status === 403);

    const sub = await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm() });
    check("customer gửi KYC hợp lệ -> 201 PENDING", sub.status === 201 && sub.body.profile.kycStatus === "PENDING");
    check("phản hồi không lộ đường dẫn giấy tờ", !JSON.stringify(sub.body).includes("private:") && sub.body.profile.hasDocument === true);
    check("gửi lại khi đang chờ duyệt bị từ chối (409)", (await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm() })).status === 409);
    const profileId = sub.body.profile._id;

    const noEvent = await api("POST", "/v1/events", { cookie: customer, form: (() => { const f = new FormData(); f.append("data", JSON.stringify({ title: "x" })); return f; })() });
    check("chưa được duyệt KYC thì không tạo sự kiện được (403)", noEvent.status === 403, noEvent.body?.message);

    // ---------------- UC38: Admin duyệt KYC
    check("customer không xem được danh sách KYC (403)", (await api("GET", "/v1/admin/kyc", { cookie: customer })).status === 403);
    const list = await api("GET", "/v1/admin/kyc?status=PENDING", { cookie: admin });
    check("admin thấy hồ sơ PENDING kèm thông tin chủ hồ sơ", list.status === 200 && list.body.items.some((p) => p._id === profileId && p.owner?.email));
    const docAdmin = await api("GET", `/v1/admin/kyc/${profileId}/document`, { cookie: admin });
    check("admin xem được giấy tờ (tệp ảnh hoặc link ký)", docAdmin.status === 200 && (docAdmin.type.startsWith("image/") || docAdmin.body?.url));
    check("customer khác không xem được giấy tờ qua API admin (403)", (await api("GET", `/v1/admin/kyc/${profileId}/document`, { cookie: otherOrg })).status === 403);
    check("reject thiếu lý do bị từ chối (400)", (await api("PUT", `/v1/admin/kyc/${profileId}/reject`, { cookie: admin, json: {} })).status === 400);
    const rej = await api("PUT", `/v1/admin/kyc/${profileId}/reject`, { cookie: admin, json: { reason: "Ảnh mờ" } });
    check("admin từ chối KYC kèm lý do", rej.status === 200 && rej.body.profile.kycStatus === "REJECTED");
    const mine = await api("GET", "/v1/organizer/kyc", { cookie: customer });
    check("chủ hồ sơ thấy lý do bị từ chối", mine.body.profile.rejectionReason === "Ảnh mờ");
    const resub = await api("POST", "/v1/organizer/kyc", { cookie: customer, form: kycForm({ organizationName: "Công ty Test Sửa Lại" }, null) });
    check("gửi lại sau khi bị từ chối (dùng lại giấy tờ cũ) -> PENDING", resub.status === 201 && resub.body.profile.kycStatus === "PENDING" && !resub.body.profile.rejectionReason);
    const appr = await api("PUT", `/v1/admin/kyc/${profileId}/approve`, { cookie: admin });
    check("admin duyệt KYC", appr.status === 200 && appr.body.profile.kycStatus === "VERIFIED");
    check("duyệt lần 2 bị từ chối (409)", (await api("PUT", `/v1/admin/kyc/${profileId}/approve`, { cookie: admin })).status === 409);
    const roleNow = (await db.collection("users").findOne({ _id: userDoc._id })).role;
    check("user được nâng role lên ORGANIZER", roleNow === "ORGANIZER", roleNow);
    check("tài khoản ADMIN không bị hạ quyền khi duyệt (chỉ nâng CUSTOMER)", (await db.collection("users").findOne({ username: "demo_admin" })).role === "ADMIN");

    // ---------------- tạo sự kiện (organizer đã KYC)
    const mkEvent = () => {
      const f = new FormData();
      const start = new Date(Date.now() + 15 * 864e5).toISOString();
      f.append("data", JSON.stringify({
        title: "Sự kiện kiểm thử quy trình", category: "Thể Thao", venueName: "Sân test, Hà Nội",
        sessions: [{ name: "Suất 1", startTime: start, tickets: [{ name: "GA", price: 100000, quantity: 10 }] }],
      }));
      return f;
    };
    const ev = await api("POST", "/v1/events", { cookie: customer, form: mkEvent() });
    check("organizer đã KYC tạo sự kiện -> PENDING", ev.status === 201 && ev.body.success && ev.body.status === "PENDING", ev.body?.message);
    createdEventId = ev.body.eventId;
    check("sự kiện PENDING chưa hiện công khai", !(await api("GET", "/v1/events/search?name=" + encodeURIComponent("kiểm thử quy trình"))).body.events.length);

    // ---------------- UC39 + UC41: Admin duyệt sự kiện
    const old = await api("PUT", `/v1/events/${createdEventId}/approve`, { cookie: admin });
    check("endpoint duyệt cũ đã bị gỡ (404)", old.status === 404);
    check("organizer không duyệt được sự kiện (403)", (await api("PUT", `/v1/admin/events/${createdEventId}/approve`, { cookie: customer, json: { commissionRatePct: 5 } })).status === 403);
    check("thiếu / sai hoa hồng bị từ chối (400)", (await api("PUT", `/v1/admin/events/${createdEventId}/approve`, { cookie: admin, json: {} })).status === 400
      && (await api("PUT", `/v1/admin/events/${createdEventId}/approve`, { cookie: admin, json: { commissionRatePct: 99 } })).status === 400);
    const pend = await api("GET", "/v1/admin/events?status=PENDING", { cookie: admin });
    check("admin thấy sự kiện trong hàng chờ", pend.body.items.some((e) => e._id === createdEventId));

    const [r1, r2] = await Promise.all([
      api("PUT", `/v1/admin/events/${createdEventId}/approve`, { cookie: admin, json: { commissionRatePct: 7.5, customTerms: "Điều khoản <script>alert(1)</script> bổ sung" } }),
      api("PUT", `/v1/admin/events/${createdEventId}/approve`, { cookie: admin, json: { commissionRatePct: 7.5 } }),
    ]);
    const okOne = [r1, r2].filter((r) => r.status === 200).length;
    check("2 admin cùng duyệt một lúc: đúng 1 thành công", okOne === 1, `${r1.status}/${r2.status}`);
    const win = r1.status === 200 ? r1 : r2;
    contractId = win.body.contract._id;
    check("hợp đồng sinh ra WAITING_SIGN, hoa hồng 7.5%", win.body.contract.status === "WAITING_SIGN" && win.body.contract.commissionRatePct === 7.5);
    check("chỉ có đúng 1 hợp đồng cho sự kiện", (await db.collection("e_contracts").countDocuments({ event_id: new mongoose.Types.ObjectId(createdEventId) })) === 1);
    check("sự kiện APPROVED nhưng CHƯA công khai (chờ ký)", (await db.collection("events").findOne({ _id: new mongoose.Types.ObjectId(createdEventId) })).status === "APPROVED");

    const detail = await api("GET", `/v1/organizer/contracts/${contractId}`, { cookie: customer });
    check("organizer xem điều khoản hợp đồng, nội dung độc hại đã bị escape",
      detail.status === 200 && detail.body.contract.termsHtml.includes("&lt;script&gt;") && !detail.body.contract.termsHtml.includes("<script>"));
    check("organizer khác không thấy hợp đồng này (404)", (await api("GET", `/v1/organizer/contracts/${contractId}`, { cookie: otherOrg })).status === 404);
    check("admin chỉnh hoa hồng khi chưa ký", (await api("PUT", `/v1/admin/contracts/${contractId}/commission`, { cookie: admin, json: { commissionRatePct: 6 } })).body?.contract?.commissionRatePct === 6);
    check("điều khoản hiển thị hoa hồng mới 6.00%", (await api("GET", `/v1/organizer/contracts/${contractId}`, { cookie: customer })).body.contract.termsHtml.includes(">6.00%<"));

    // ---------------- UC27: ký hợp đồng
    const png = "data:image/png;base64," + makePng(200, 80).toString("base64");
    const sign = (cookie, body) => api("POST", `/v1/organizer/contracts/${contractId}/sign`, { cookie, json: body });
    check("ký mà không tick đồng ý bị từ chối (400)", (await sign(customer, { signature: png })).status === 400);
    check("chữ ký không phải PNG bị từ chối (400)", (await sign(customer, { agree: true, signature: "data:image/png;base64," + Buffer.from("khong phai anh nhung du dai de qua kiem tra do dai".repeat(10)).toString("base64") })).status === 400);
    check("organizer khác không ký thay được (404)", (await sign(otherOrg, { agree: true, signature: png })).status === 404);
    const signed = await sign(customer, { agree: true, signature: png });
    check("ký hợp đồng thành công -> SIGNED", signed.status === 200 && signed.body.contract.status === "SIGNED" && signed.body.contract.hasSignedPdf, signed.body?.message);
    check("sự kiện chuyển PUBLISHED sau khi ký", signed.body?.event?.status === "PUBLISHED");
    check("ký lần 2 bị từ chối (409)", (await sign(customer, { agree: true, signature: png })).status === 409);
    check("hoa hồng không sửa được sau khi ký", (await api("PUT", `/v1/admin/contracts/${contractId}/commission`, { cookie: admin, json: { commissionRatePct: 1 } })).status === 404);
    const c = await db.collection("e_contracts").findOne({ _id: new mongoose.Types.ObjectId(contractId) });
    check("DB ghi IP, thời điểm ký, chữ ký riêng tư", !!c.signer_ip && !!c.signed_at && c.organizer_signature_url?.startsWith("private:"), c.signer_ip);

    const pdf = await api("GET", `/v1/organizer/contracts/${contractId}/pdf`, { cookie: customer });
    const isPdf = pdf.buf.slice(0, 4).toString() === "%PDF" || (pdf.body?.url && pdf.body.url.startsWith("http"));
    check("organizer tải được PDF hợp đồng đã ký", pdf.status === 200 && isPdf);
    if (pdf.buf.slice(0, 4).toString() === "%PDF") check("PDF có nội dung (> 5KB, có chữ ký ảnh)", pdf.buf.length > 5000, `${pdf.buf.length} bytes`);
    check("organizer khác không tải được PDF (404)", (await api("GET", `/v1/organizer/contracts/${contractId}/pdf`, { cookie: otherOrg })).status === 404);
    check("customer thường không tải được PDF (403)", (await api("GET", `/v1/organizer/contracts/${contractId}/pdf`, { cookie: staff })).status === 403);
    check("sự kiện đã xuất bản hiện công khai", (await api("GET", "/v1/events/search?name=" + encodeURIComponent("kiểm thử quy trình"))).body.events.length === 1);

    const logs = await db.collection("audit_logs").find({ action: { $in: ["KYC_APPROVE", "KYC_REJECT", "EVENT_APPROVE", "CONTRACT_SIGN"] } }).toArray();
    check("nhật ký kiểm toán ghi đủ hành động nhạy cảm", ["KYC_APPROVE", "KYC_REJECT", "EVENT_APPROVE", "CONTRACT_SIGN"].every((a) => logs.some((l) => l.action === a)));
  } finally {
    // ---------------- dọn dữ liệu test
    const { deletePrivate } = require("../src/services/privateStorage");
    const profiles = await db.collection("organizer_profiles").find({ user_id: userDoc._id }).toArray();
    for (const p of profiles) await deletePrivate(p.id_card_or_license_url).catch(() => {});
    const contracts = await db.collection("e_contracts").find({ organizer_id: userDoc._id }).toArray();
    for (const k of contracts) { await deletePrivate(k.signed_pdf_url).catch(() => {}); await deletePrivate(k.organizer_signature_url).catch(() => {}); }
    await db.collection("organizer_profiles").deleteMany({ user_id: userDoc._id });
    await db.collection("e_contracts").deleteMany({ organizer_id: userDoc._id });
    const evs = await db.collection("events").find({ organizer_id: userDoc._id }).toArray();
    const evIds = evs.map((e) => e._id);
    await db.collection("ticket_tiers").deleteMany({ event_id: { $in: evIds } });
    await db.collection("event_sessions").deleteMany({ event_id: { $in: evIds } });
    await db.collection("events").deleteMany({ _id: { $in: evIds } });
    await db.collection("users").updateOne({ _id: userDoc._id }, { $set: { role: "CUSTOMER" } });
    await db.collection("audit_logs").deleteMany({ action: { $in: ["KYC_SUBMIT", "KYC_APPROVE", "KYC_REJECT", "KYC_VIEW_DOCUMENT", "EVENT_APPROVE", "CONTRACT_SIGN", "CONTRACT_UPDATE_COMMISSION"] } });
    await mongoose.disconnect();
    console.log(`\nKết quả: ${pass} pass, ${failN} fail`);
    process.exit(failN ? 1 : 0);
  }
})().catch((e) => { console.error("Test lỗi:", e); process.exit(1); });
