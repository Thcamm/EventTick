/**
 * Kiểm thử SePay qua địa chỉ ngrok CÔNG KHAI (giống đường SePay thật sẽ đi), giao dịch giả lập.
 * Chạy:  node scripts/test-sepay-tunnel.js [https://xxxx.ngrok-free.dev]
 * Nếu không truyền URL, tự đọc từ ngrok local (http://127.0.0.1:4040).
 * Backend phải đang chạy và đã nạp .env mới nhất (đổi .env xong phải khởi động lại backend).
 * Script tạo 1 đơn thử rồi dọn sạch; không in khóa bí mật.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const LOCAL = process.env.LOCAL_BASE || `http://localhost:${process.env.PORT || 3000}`;
const KEY = process.env.SEPAY_WEBHOOK_API_KEY;
const PREFIX = (process.env.SEPAY_PAYMENT_PREFIX || "DH").toUpperCase();
let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
  return cond;
};

async function call(base, method, path, { cookie, json, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(headers || {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 120) }; }
  return { status: res.status, body, setCookie: res.headers.get("set-cookie"), type: res.headers.get("content-type") || "" };
}

async function publicUrl() {
  if (process.argv[2]) return process.argv[2].replace(/\/+$/, "");
  const r = await fetch("http://127.0.0.1:4040/api/tunnels").then((x) => x.json()).catch(() => null);
  const t = r?.tunnels?.find((x) => x.public_url.startsWith("https://"));
  return t?.public_url;
}

(async () => {
  const PUB = await publicUrl();
  if (!PUB) { console.error("Không tìm thấy tunnel ngrok. Hãy chạy: ngrok http 3000"); process.exit(1); }
  console.log("Tunnel:", PUB, "-> backend", LOCAL, "\n");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  let orderId;

  try {
    // 1. Backend + tunnel thông
    console.log("[1] gọi backend cục bộ...");
    const local401 = await call(LOCAL, "POST", "/v1/payment/sepay-webhook");
    check("backend cục bộ nhận được webhook (không key -> 401)", local401.status === 401);
    console.log("[1b] gọi qua tunnel công khai...");
    const pub401 = await call(PUB, "POST", "/v1/payment/sepay-webhook");
    check("qua tunnel ngrok tới đúng backend (không key -> 401, JSON)", pub401.status === 401 && pub401.type.includes("json"), `HTTP ${pub401.status} ${pub401.type}`);

    // 2. Key trong .env khớp với backend ĐANG CHẠY (phát hiện quên restart)
    const withKey = await call(LOCAL, "POST", "/v1/payment/sepay-webhook", {
      json: { id: Date.now(), transferType: "out", transferAmount: 1 },
      headers: { Authorization: `Apikey ${KEY}` },
    });
    if (!check("API key trong .env được backend đang chạy chấp nhận", withKey.status === 200, `HTTP ${withKey.status}`)) {
      console.log("\n=> Backend đang chạy dùng key CŨ trong bộ nhớ. Khởi động lại backend (Ctrl+C rồi npm run dev) rồi chạy lại script.");
      return;
    }

    // 3. Đặt vé thật qua API, thanh toán giả lập qua đường công khai
    const login = await call(LOCAL, "POST", "/v1/auth/login", { json: { username: "demo_user", password: "123456" } });
    const cookie = login.setCookie?.split(";")[0];
    if (!check("đăng nhập demo_user (cần đã seed)", !!cookie)) return;
    const ev = (await call(LOCAL, "GET", "/v1/events/search?name=" + encodeURIComponent("Anh Trai"))).body.events?.[0];
    if (!check("có sự kiện mẫu để đặt vé", !!ev)) return;
    const session = ev.sessions[0], tier = session.tickets[0];
    const stockOf = async () => (await call(LOCAL, "GET", `/v1/events/${ev._id}`)).body.event.sessions[0].tickets.find((t) => t._id === tier._id).numberOfTicketLeft;
    const stock0 = await stockOf();

    const order = await call(LOCAL, "POST", "/v1/booking", { cookie, json: { eventId: ev._id, sessionId: session._id, items: [{ tierId: tier._id, quantity: 1 }] } });
    if (!check("tạo đơn PENDING_PAYMENT", order.status === 200, order.body.message)) return;
    orderId = order.body.orderId;

    const ins = await call(LOCAL, "GET", `/v1/payment/orders/${orderId}/instructions`, { cookie });
    check("hướng dẫn chuyển khoản có STK, ngân hàng, nội dung", ins.status === 200 && !!ins.body.account && !!ins.body.bank && ins.body.transferContent?.startsWith(PREFIX), `${ins.body.bank} ${ins.body.account} | ND: ${ins.body.transferContent}`);
    check("có URL mã QR của SePay", /^https:\/\/qr\.sepay\.vn\/img\?/.test(ins.body.qrUrl || ""));
    if (ins.body.qrUrl) {
      const qr = await fetch(ins.body.qrUrl).catch(() => null);
      check("URL mã QR tải được ảnh", !!qr && qr.status === 200 && (qr.headers.get("content-type") || "").startsWith("image/"), qr ? `HTTP ${qr.status} ${qr.headers.get("content-type")}` : "không kết nối được");
    }

    const demo = await call(LOCAL, "POST", "/v1/booking/create-payment-intent", { cookie, json: { orderId } });
    check("thanh toán demo đã TẮT (403), chỉ còn thanh toán thật", demo.status === 403, `HTTP ${demo.status}`);

    // 4. Webhook giả lập đi qua tunnel công khai
    const txId = Date.now();
    const hookBody = { id: txId, gateway: "BIDV", transactionDate: new Date().toISOString().replace("T", " ").slice(0, 19), accountNumber: process.env.SEPAY_BANK_ACCOUNT, code: null, content: `${ins.body.transferContent} FT${txId}`, transferType: "in", transferAmount: order.body.totalAmount, accumulated: 0, referenceCode: `FT${txId}`, description: "giao dich gia lap" };
    const wrong = await call(PUB, "POST", "/v1/payment/sepay-webhook", { json: hookBody, headers: { Authorization: "Apikey sai-key-hoan-toan" } });
    check("qua tunnel: key sai bị từ chối (401), đơn chưa thanh toán", wrong.status === 401 && (await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(orderId) })).status === "PENDING_PAYMENT");
    const good = await call(PUB, "POST", "/v1/payment/sepay-webhook", { json: hookBody, headers: { Authorization: `Apikey ${KEY}` } });
    check("qua tunnel: webhook đúng key -> 200 success", good.status === 200 && good.body.success === true && !good.body.message, JSON.stringify(good.body));

    const ord = await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    check("đơn chuyển PAID", ord.status === "PAID", ord.status);
    const tickets = await db.collection("tickets").countDocuments({ order_id: ord._id });
    check("đã phát hành 1 vé", tickets === 1);
    const pay = await db.collection("payments").findOne({ order_id: ord._id });
    check("payments: VIETQR / SUCCESS / đúng số tiền / SEPAY-<id>", pay?.gateway === "VIETQR" && pay.status === "SUCCESS" && pay.amount === ord.total_amount && pay.transaction_ref === `SEPAY-${txId}`);
    const dup = await call(PUB, "POST", "/v1/payment/sepay-webhook", { json: hookBody, headers: { Authorization: `Apikey ${KEY}` } });
    check("SePay gọi lại (retry): 200, không phát thêm vé", dup.status === 200 && (await db.collection("tickets").countDocuments({ order_id: ord._id })) === 1);
    const mine = await call(LOCAL, "GET", "/v1/booking/user/tickets", { cookie });
    check("khách thấy vé mới trong 'Vé của tôi'", mine.body.tickets?.some((t) => t.eventId === ev._id));
    check("kho vé giảm đúng 1", (await stockOf()) === stock0 - 1, `${stock0} -> ${await stockOf()}`);
  } catch (e) {
    console.log("FAIL  script gặp lỗi: " + (e.cause?.code || e.message));
    console.log(String(e.stack).split("\n").slice(0, 4).join("\n"));
    failN++;
  } finally {
    if (orderId) {
      const oid = new mongoose.Types.ObjectId(orderId);
      const o = await db.collection("orders").findOne({ _id: oid });
      if (o && ["PAID", "PENDING_PAYMENT"].includes(o.status)) {
        for (const it of o.items_snapshot) await db.collection("ticket_tiers").updateOne({ _id: it.tier_id }, { $inc: { available_quantity: it.quantity } });
      }
      await db.collection("tickets").deleteMany({ order_id: oid });
      await db.collection("payments").deleteMany({ order_id: oid });
      await db.collection("orders").deleteOne({ _id: oid });
    }
    await db.collection("audit_logs").deleteMany({ action: "PAYMENT_UNMATCHED" });
    await mongoose.disconnect();
    console.log(`\nKết quả: ${pass} pass, ${failN} fail`);
    process.exit(failN ? 1 : 0);
  }
})().catch((e) => { console.error("Test lỗi:", e); process.exit(1); });
