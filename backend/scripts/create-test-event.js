/**
 * Tạo sự kiện "test" có sơ đồ chỗ ngồi để thử giao diện đặt vé.
 * Chạy: node scripts/create-test-event.js   (BASE=http://localhost:3000, server đang chạy; cần npm run seed trước đó)
 * Chạy lại an toàn: xóa sự kiện tên đúng "test" của demo_organizer rồi tạo mới. Không đụng dữ liệu khác.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const BASE = process.env.BASE || "http://localhost:3000";
const SAMPLES = path.join(__dirname, "../../samples/seatmap");
const DAY = 864e5;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");
  const db = mongoose.connection.db;
  const organizer = await db.collection("users").findOne({ username: "demo_organizer" });
  const category = await db.collection("categories").findOne({ slug: { $exists: true } });
  if (!organizer || !category) throw new Error("Thiếu demo_organizer hoặc danh mục: chạy npm run seed trước");

  // dọn bản "test" cũ (chỉ sự kiện tên đúng "test" của demo_organizer)
  const old = await db.collection("events").find({ title: "test", organizer_id: organizer._id }).toArray();
  for (const e of old) {
    console.log("xóa sự kiện cũ:", e._id.toString());
    for (const c of ["seats", "ticket_tiers", "event_sessions", "seatmap_layouts", "e_contracts", "orders", "tickets"]) {
      await db.collection(c).deleteMany({ event_id: e._id });
    }
    await db.collection("events").deleteOne({ _id: e._id });
  }

  const now = Date.now();
  const start = new Date(now + 20 * DAY);
  start.setHours(19, 30, 0, 0);
  const banner = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop";
  const eventId = (await db.collection("events").insertOne({
    organizer_id: organizer._id, category_id: category._id, title: "test", slug: `test-${Date.now().toString(36)}`,
    description: "<p>Sự kiện thử sơ đồ chỗ ngồi (SVG + Excel).</p>", banner_url: banner, thumbnail_url: banner,
    venue_name: "Sân vận động Test", city: "Hà Nội", organizer_name: "Demo Concert Co., Ltd.",
    start_time: start, end_time: new Date(start.getTime() + 3 * 36e5 + DAY), status: "PUBLISHED",
    has_seat_map: false, allow_resale: true, max_resale_markup_pct: 10,
    is_trending: true, lowest_price: 500000, created_at: new Date(),
  })).insertedId;

  // 2 suất diễn, mỗi suất có đủ 3 hạng vé (tên khớp cột Tier_Name trong Excel); số lượng sẽ do import ghi đè
  const tiers = [["VIP", 2000000, "#e8222d"], ["CAT 1", 1000000, "#7b3f98"], ["GA", 500000, "#06b6d4"]];
  for (let i = 0; i < 2; i++) {
    const s = new Date(start.getTime() + i * DAY);
    const sid = (await db.collection("event_sessions").insertOne({
      event_id: eventId, name: `Đêm ${i + 1}`, start_time: s, end_time: new Date(s.getTime() + 3 * 36e5), status: "SCHEDULED",
    })).insertedId;
    for (const [name, price, color] of tiers) {
      await db.collection("ticket_tiers").insertOne({
        event_id: eventId, session_id: sid, name, price, total_quantity: 1, available_quantity: 1, min_per_order: 1, max_per_order: 6,
        sale_start_time: new Date(now - DAY), sale_end_time: s, zone_color: color, zone_type: "GA",
      });
    }
  }
  await db.collection("e_contracts").insertOne({
    event_id: eventId, organizer_id: organizer._id, commission_rate_pct: 5, contract_terms_html: "<p>Hợp đồng mẫu</p>",
    signed_at: new Date(), signer_ip: "127.0.0.1", status: "SIGNED",
  });
  await mongoose.disconnect();

  // Admin dựng sơ đồ qua API thật
  const login = await fetch(BASE + "/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "demo_admin", password: "123456" }),
  });
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("Đăng nhập demo_admin thất bại (đã chạy npm run seed chưa?)");
  const f = new FormData();
  f.append("svgFile", new Blob([fs.readFileSync(path.join(SAMPLES, "zone_map.svg"))], { type: "image/svg+xml" }), "zone_map.svg");
  f.append("excelFile", new Blob([fs.readFileSync(path.join(SAMPLES, "seating_manifest.xlsx"))]), "seating_manifest.xlsx");
  const r = await fetch(`${BASE}/v1/admin/events/${eventId}/seatmap`, { method: "POST", headers: { Cookie: cookie }, body: f });
  const body = await r.json();
  if (r.status !== 201) throw new Error(`Import sơ đồ lỗi ${r.status}: ${JSON.stringify(body)}`);

  console.log("Đã dựng sơ đồ:", body.summary.seatedPerSession, "ghế/suất,", body.summary.gaCapacity, "vé đứng, số suất:", body.summary.sessions);
  console.log("\nEvent ID:", eventId.toString());
  console.log(`Trang sự kiện : http://localhost:5173/event/${eventId}`);
  console.log(`Trang chọn vé : http://localhost:5173/event/seats/${eventId}`);
  console.log("Tài khoản     : demo_user / 123456 (khách), demo_admin / 123456 (admin)");
})().catch((e) => { console.error("LỖI:", e.message, e.cause ? "| " + (e.cause.code || e.cause.message) : ""); process.exit(1); });
