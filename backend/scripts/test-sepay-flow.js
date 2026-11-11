/**
 * Kiểm thử webhook SePay bằng giao dịch GIẢ LẬP (không cần chuyển tiền thật, không cần ngrok).
 * Chạy:  BASE=http://localhost:3999 node scripts/test-sepay-flow.js
 * Cần: npm run seed; server đang chạy; Redis chạy; .env có SEPAY_WEBHOOK_API_KEY.
 * Để test không đụng tới Cloudinary/SePay thật, script chỉ gọi API cục bộ.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const BASE = process.env.BASE || "http://localhost:3000";
const KEY = process.env.SEPAY_WEBHOOK_API_KEY;
const PREFIX = (process.env.SEPAY_PAYMENT_PREFIX || "DH").toUpperCase();
let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
};

async function api(method, path, { cookie, json, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(headers || {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body, setCookie: res.headers.get("set-cookie") };
}
const login = async (u) => (await api("POST", "/v1/auth/login", { json: { username: u, password: "123456" } })).setCookie.split(";")[0];

let seq = Date.now();
const hook = (over, key = KEY) =>
  api("POST", "/v1/payment/sepay-webhook", {
    json: { id: ++seq, gateway: "Vietcombank", transactionDate: new Date().toISOString(), accountNumber: "0123456789", transferType: "in", referenceCode: "FT" + seq, ...over },
    headers: key === null ? {} : { Authorization: `Apikey ${key}` },
  });

(async () => {
  if (!KEY) { console.error("Thiếu SEPAY_WEBHOOK_API_KEY trong .env"); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const customer = await login("demo_user");
  const admin = await login("demo_admin");
  const created = []; // đơn tạo trong test để dọn

  const ev = (await api("GET", "/v1/events/search?name=" + encodeURIComponent("Anh Trai"))).body.events[0];
  const session = ev.sessions[0];
  const tier = session.tickets[0];
  const newOrder = async (qty = 1) => {
    const r = await api("POST", "/v1/booking", { cookie: customer, json: { eventId: ev._id, sessionId: session._id, items: [{ tierId: tier._id, quantity: qty }] } });
    if (r.status !== 200) throw new Error("không tạo được đơn: " + JSON.stringify(r.body));
    created.push(r.body.orderId);
    return r.body;
  };
  const stock = async () => (await api("GET", `/v1/events/${ev._id}`)).body.event.sessions[0].tickets.find((t) => t._id === tier._id).numberOfTicketLeft;
  const content = (o) => `${PREFIX}${o.orderCode.replace(/[^A-Za-z0-9]/g, "")}`;
  const ticketsOf = (orderId) => db.collection("tickets").countDocuments({ order_id: new mongoose.Types.ObjectId(orderId) });

  try {
    // ------- xác thực
    check("không có API key -> 401", (await hook({ content: "x", transferAmount: 1000 }, null)).status === 401);
    check("sai API key -> 401", (await hook({ content: "x", transferAmount: 1000 }, "sai-key")).status === 401);
    check("API key sai độ dài không làm server lỗi (401)", (await hook({ content: "x", transferAmount: 1000 }, "a")).status === 401);

    // ------- hướng dẫn thanh toán
    const o1 = await newOrder(1);
    const ins = await api("GET", `/v1/payment/orders/${o1.orderId}/instructions`, { cookie: customer });
    check("khách lấy được hướng dẫn chuyển khoản (nội dung + số tiền)", ins.status === 200 && ins.body.transferContent === content(o1) && ins.body.amount === o1.totalAmount, ins.body.transferContent);
    check("người khác không xem được hướng dẫn của đơn này (404)", (await api("GET", `/v1/payment/orders/${o1.orderId}/instructions`, { cookie: admin })).status === 404);
    check("chưa đăng nhập không xem được hướng dẫn (401)", (await api("GET", `/v1/payment/orders/${o1.orderId}/instructions`)).status === 401);

    // ------- không khớp
    const unmatchedBefore = await db.collection("audit_logs").countDocuments({ action: "PAYMENT_UNMATCHED" });
    check("tiền ra bị bỏ qua", (await hook({ transferType: "out", content: content(o1), transferAmount: o1.totalAmount })).body.message?.includes("tiền ra"));
    check("số tiền <= 0 bị từ chối (400)", (await hook({ content: content(o1), transferAmount: -5 })).status === 400);
    const noCode = await hook({ content: "chuyen tien an trua", transferAmount: 50000 });
    check("nội dung không có mã đơn: 200, không xác nhận đơn nào", noCode.status === 200 && noCode.body.success);
    const unknown = await hook({ content: `${PREFIX}ORD20200101ABCDEF`, transferAmount: 50000 });
    check("mã đơn không tồn tại: 200", unknown.status === 200 && unknown.body.message === "Không tìm thấy đơn hàng");
    check("đơn chưa bị ảnh hưởng bởi giao dịch lạ", (await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(o1.orderId) })).status === "PENDING_PAYMENT");

    // ------- thiếu tiền
    const short = await hook({ content: content(o1), transferAmount: o1.totalAmount - 1 });
    check("chuyển thiếu 1đ: đơn KHÔNG được xác nhận", short.status === 200 && (await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(o1.orderId) })).status === "PENDING_PAYMENT");
    check("chuyển thiếu: chưa phát hành vé", (await ticketsOf(o1.orderId)) === 0);

    // ------- thành công
    const stockBefore = await stock();
    const okTx = seq + 1;
    const ok = await hook({ id: okTx, content: `Chuyen khoan ${content(o1)} cam on`, transferAmount: o1.totalAmount });
    check("chuyển đủ tiền (nội dung có chữ khác kèm theo): thành công", ok.status === 200 && ok.body.success && !ok.body.message);
    const ord = await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(o1.orderId) });
    check("đơn chuyển PAID", ord.status === "PAID");
    check("sinh đúng 1 vé", (await ticketsOf(o1.orderId)) === 1);
    const pay = await db.collection("payments").findOne({ order_id: ord._id });
    check("payments ghi nhận: VIETQR, SUCCESS, đúng số tiền, mã SEPAY-<id>", pay.gateway === "VIETQR" && pay.status === "SUCCESS" && pay.amount === ord.total_amount && pay.transaction_ref === `SEPAY-${okTx}`);
    check("webhook_payload lưu lại để đối soát", pay.webhook_payload?.referenceCode === `FT${okTx}`);
    check("kho vé không bị trừ thêm lần nữa khi thanh toán", (await stock()) === stockBefore);

    // ------- trùng
    const dup = await hook({ id: okTx, content: content(o1), transferAmount: o1.totalAmount });
    check("SePay gọi lại cùng giao dịch: 200, không sinh thêm vé / payment", dup.status === 200 && (await ticketsOf(o1.orderId)) === 1 && (await db.collection("payments").countDocuments({ order_id: ord._id })) === 1);
    const o2 = await newOrder(1);
    const race = await Promise.all(Array.from({ length: 5 }, () => hook({ id: seq + 1000, content: content(o2), transferAmount: o2.totalAmount })));
    check("5 webhook TRÙNG gửi đồng thời: tất cả 200", race.every((r) => r.status === 200));
    check("... nhưng chỉ 1 payment và 1 vé", (await db.collection("payments").countDocuments({ order_id: new mongoose.Types.ObjectId(o2.orderId) })) === 1 && (await ticketsOf(o2.orderId)) === 1);

    // ------- tiền thừa / đơn đã trả
    const extra = await hook({ content: content(o1), transferAmount: o1.totalAmount });
    check("chuyển lần 2 cho đơn đã thanh toán: không sinh vé thêm", extra.status === 200 && (await ticketsOf(o1.orderId)) === 1);
    const o3 = await newOrder(1);
    const over = await hook({ content: content(o3), transferAmount: o3.totalAmount + 20000 });
    check("chuyển thừa 20.000đ: đơn vẫn PAID", over.status === 200 && (await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(o3.orderId) })).status === "PAID");

    // ------- đơn hết hạn
    const o4 = await newOrder(2);
    const stockHeld = await stock();
    await db.collection("orders").updateOne({ _id: new mongoose.Types.ObjectId(o4.orderId) }, { $set: { lock_expires_at: new Date(Date.now() - 5000) } });
    const late = await hook({ content: content(o4), transferAmount: o4.totalAmount });
    const o4db = await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(o4.orderId) });
    check("thanh toán SAU khi đơn hết hạn: 200 nhưng đơn không PAID", late.status === 200 && o4db.status !== "PAID", o4db.status);
    check("... không phát hành vé", (await ticketsOf(o4.orderId)) === 0);
    check("... kho đã được hoàn lại 2 vé (không rò rỉ)", (await stock()) === stockHeld + 2);

    // ------- đối soát
    const list = await api("GET", "/v1/payment/admin/unmatched", { cookie: admin });
    check("Admin xem được danh sách giao dịch cần đối soát", list.status === 200 && list.body.total >= unmatchedBefore + 6, `tổng ${list.body.total}`);
    const reasons = list.body.items.map((i) => i.reason || "").join(" | ");
    check("danh sách ghi rõ: thiếu tiền, thừa tiền, đơn hết hạn, không có mã", /thiếu tiền/.test(reasons) && /thừa/.test(reasons) && /không còn hiệu lực/.test(reasons) && /không có mã đơn/.test(reasons));
    check("khách thường không xem được danh sách đối soát (403)", (await api("GET", "/v1/payment/admin/unmatched", { cookie: customer })).status === 403);

    // ------- cổng demo
    const demo = await newOrder(1);
    const dd = await api("POST", "/v1/booking/create-payment-intent", { cookie: customer, json: { orderId: demo.orderId } });
    check("thanh toán demo vẫn chạy khi ENABLE_DEMO_PAYMENT=true", process.env.ENABLE_DEMO_PAYMENT === "false" ? dd.status === 403 : dd.status === 200);
  } finally {
    // dọn dữ liệu test: hoàn kho phần đơn PAID đã tạo, xóa đơn/vé/payment tạo ra
    const ids = created.map((i) => new mongoose.Types.ObjectId(i));
    const orders = await db.collection("orders").find({ _id: { $in: ids } }).toArray();
    for (const o of orders) {
      if (o.status === "PAID") for (const it of o.items_snapshot) await db.collection("ticket_tiers").updateOne({ _id: it.tier_id }, { $inc: { available_quantity: it.quantity } });
      if (o.status === "PENDING_PAYMENT") for (const it of o.items_snapshot) await db.collection("ticket_tiers").updateOne({ _id: it.tier_id }, { $inc: { available_quantity: it.quantity } });
    }
    await db.collection("tickets").deleteMany({ order_id: { $in: ids } });
    await db.collection("payments").deleteMany({ order_id: { $in: ids } });
    await db.collection("orders").deleteMany({ _id: { $in: ids } });
    await db.collection("audit_logs").deleteMany({ action: "PAYMENT_UNMATCHED" });
    await mongoose.disconnect();
    console.log(`\nKết quả: ${pass} pass, ${failN} fail`);
    process.exit(failN ? 1 : 0);
  }
})().catch((e) => { console.error("Test lỗi:", e); process.exit(1); });
