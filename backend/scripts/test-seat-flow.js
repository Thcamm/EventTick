/**
 * Kiểm thử luồng giữ ghế / thanh toán / tranh chấp đồng thời qua HTTP thật.
 * Chạy:  node scripts/test-seat-flow.js            (server phải đang chạy, mặc định http://localhost:3000)
 *        BASE=http://localhost:3999 node scripts/test-seat-flow.js
 * Cần: seed (npm run seed) + Redis đang chạy.
 */
const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, failN = 0;

async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}
async function login(username) {
  const r = await api("POST", "/v1/auth/login", { body: { username, password: "123456" } });
  return r.setCookie.split(";")[0];
}
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
}

// Thanh toán qua webhook SePay giả lập (endpoint demo có thể đã tắt bằng ENABLE_DEMO_PAYMENT=false).
let sepaySeq = Date.now();
async function payViaSepay(cookie, orderId, amount) {
  require("dotenv").config();
  const ins = await api("GET", "/v1/payment/orders/" + orderId + "/instructions", { cookie });
  const content = ins.json.transferContent || "";
  const id = ++sepaySeq;
  await fetch(BASE + "/v1/payment/sepay-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Apikey " + process.env.SEPAY_WEBHOOK_API_KEY },
    body: JSON.stringify({ id, transferType: "in", transferAmount: amount, content: content + " FT" + id }),
  });
  const o = await api("GET", "/v1/booking/orders/auth/" + orderId, { cookie });
  return { json: { success: o.json.status === "CONFIRMED", tickets: o.json.tickets || [] } };
}

(async () => {
  const startedAt = new Date();
  const A = await login("demo_user");
  const B = await login("demo_organizer");

  const search = await api("GET", "/v1/events/search?name=" + encodeURIComponent("Ghế Ngồi"));
  const event = search.json.events[0];
  const sessionId = event.sessions[0]._id;
  const eventId = event._id;
  const seatsRes = await api("GET", `/v1/events/sessions/${sessionId}/seats`);
  const seats = seatsRes.json.seats;
  check("sơ đồ ghế có 50 ghế, tất cả AVAILABLE", seats.length === 50 && seats.every((s) => s.status === "AVAILABLE"));
  const [s1, s2, s3, s4, s5, s6] = seats.map((s) => s._id);
  const hold = (cookie, seatIds, extra = {}) =>
    api("POST", "/v1/booking", { cookie, body: { eventId, sessionId, items: [{ seatIds }], ...extra } });

  // 1. A giữ ghế 1,2
  const a = await hold(A, [s1, s2]);
  check("A giữ ghế 1,2 thành công", a.status === 200 && a.json.success, `order=${a.json.orderId}`);

  // 2. B giữ 2,3 -> xung đột, ghế 3 không bị khóa nhầm
  const b = await hold(B, [s2, s3]);
  check("B giữ ghế 2,3 bị từ chối 409 (ghế 2 đã có người giữ)", b.status === 409, b.json.message);
  const view = (await api("GET", `/v1/events/sessions/${sessionId}/seats`)).json.seats;
  check("ghế 1,2 hiện LOCKED; ghế 3 vẫn AVAILABLE (all-or-nothing)",
    view[0].status === "LOCKED" && view[1].status === "LOCKED" && view[2].status === "AVAILABLE");

  // 3. 8 request đồng thời giành ghế 5 -> đúng 1 thắng
  const race = await Promise.all(Array.from({ length: 8 }, (_, i) => hold(i % 2 ? A : B, [s5])));
  const wins = race.filter((r) => r.status === 200).length;
  check("8 request đồng thời giành 1 ghế: đúng 1 thắng", wins === 1, `thắng=${wins}, 409=${race.filter((r) => r.status === 409).length}`);

  // 4. Hạng vé: kho giảm đúng
  const tiersAfter = (await api("GET", `/v1/events/${eventId}`)).json.event.sessions[0].tickets;
  const total = tiersAfter.reduce((n, t) => n + t.numberOfTicketLeft, 0);
  check("kho vé còn 50 - 3 = 47 (ghế 1,2 + ghế 5)", total === 47, `còn ${total}`);

  // 5. A huỷ đơn -> ghế trả lại, kho hoàn
  const cancel = await api("POST", `/v1/booking/orders/${a.json.orderId}/cancel`, { cookie: A });
  check("A huỷ đơn thành công", cancel.status === 200 && cancel.json.status === "CANCELLED");
  const after = (await api("GET", `/v1/events/sessions/${sessionId}/seats`)).json.seats;
  check("ghế 1,2 trở lại AVAILABLE", after[0].status === "AVAILABLE" && after[1].status === "AVAILABLE");
  const cancel2 = await api("POST", `/v1/booking/orders/${a.json.orderId}/cancel`, { cookie: A });
  check("huỷ lần 2 bị từ chối 409 (không hoàn kho đôi)", cancel2.status === 409);
  const total2 = (await api("GET", `/v1/events/${eventId}`)).json.event.sessions[0].tickets.reduce((n, t) => n + t.numberOfTicketLeft, 0);
  check("kho hoàn về 49", total2 === 49, `còn ${total2}`);

  // 6. Thanh toán ghế 1 -> SOLD, vé có seat_id
  const o = await hold(A, [s1]);
  const pay = await payViaSepay(A, o.json.orderId, o.json.totalAmount);
  check("thanh toán: đơn PAID, 1 vé gắn đúng seat_id", pay.json.success && pay.json.tickets.length === 1 && pay.json.tickets[0].seat_id === s1);
  const sold = (await api("GET", `/v1/events/sessions/${sessionId}/seats`)).json.seats[0];
  check("ghế 1 chuyển SOLD", sold.status === "SOLD");
  const again = await hold(B, [s1]);
  check("mua lại ghế đã bán bị từ chối 409", again.status === 409, again.json.message);
  const pay2 = await payViaSepay(A, o.json.orderId, o.json.totalAmount);
  check("thanh toán lần 2 không sinh thêm vé", pay2.json.success && pay2.json.tickets.length === 1);

  // 7. Vé đứng không bị ảnh hưởng, kiểm tra chọn sai kiểu
  const wrong = await api("POST", "/v1/booking", { cookie: A, body: { eventId, sessionId, items: [{ tierId: seatsRes.json.tiers[0]._id, quantity: 1 }] } });
  check("sự kiện có ghế mà gửi tierId/quantity bị từ chối 400", wrong.status === 400, wrong.json.message);

  // 8. Hết hạn: sửa lock_expires_at về quá khứ rồi chờ job (30s) / hoặc gọi trực tiếp
  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const e = await hold(A, [s6]);
  check("A giữ ghế 6 (chuẩn bị test hết hạn)", e.status === 200);
  const { ObjectId } = mongoose.Types;
  await db.collection("orders").updateOne({ _id: new ObjectId(e.json.orderId) }, { $set: { lock_expires_at: new Date(Date.now() - 1000) } });
  console.log("...chờ job nền nhả đơn quá hạn (tối đa 40s)");
  let released = false;
  for (let i = 0; i < 20 && !released; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const ord = await db.collection("orders").findOne({ _id: new ObjectId(e.json.orderId) });
    released = ord.status === "EXPIRED";
  }
  check("job nền chuyển đơn quá hạn sang EXPIRED", released);
  const seat6 = (await api("GET", `/v1/events/sessions/${sessionId}/seats`)).json.seats[5];
  check("ghế 6 trở lại AVAILABLE sau khi hết hạn", seat6.status === "AVAILABLE");

  // Dọn dữ liệu test: xoá đơn / vé / payment của sự kiện ghế, trả ghế và kho vé về trạng thái ban đầu
  const evOid = new ObjectId(eventId);
  const testOrders = await db.collection("orders").find({ event_id: evOid }).toArray();
  const testOrderIds = testOrders.map((o) => o._id);
  await db.collection("tickets").deleteMany({ order_id: { $in: testOrderIds } });
  await db.collection("payments").deleteMany({ order_id: { $in: testOrderIds } });
  await db.collection("orders").deleteMany({ _id: { $in: testOrderIds } });
  await db.collection("audit_logs").deleteMany({ action: "PAYMENT_UNMATCHED", created_at: { $gte: startedAt } });
  await db.collection("seats").updateMany(
    { event_id: evOid },
    { $set: { status: "AVAILABLE" }, $unset: { locked_by_user_id: 1, lock_expires_at: 1 } },
  );
  for (const t of await db.collection("ticket_tiers").find({ event_id: evOid }).toArray()) {
    await db.collection("ticket_tiers").updateOne({ _id: t._id }, { $set: { available_quantity: t.total_quantity } });
  }
  try {
    const { redis } = require("../src/config/redis");
    const keys = await redis.keys("seatlock:*");
    if (keys.length) await redis.del(...keys);
    redis.disconnect();
  } catch { /* Redis không bắt buộc cho bước dọn */ }
  await mongoose.disconnect();

  console.log(`\nKết quả: ${pass} pass, ${failN} fail`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error("Test lỗi:", e); process.exit(1); });
