/**
 * Seed dữ liệu mẫu cho database EventTick (schema theo eventtick_database_specification.md).
 * Chạy: npm run seed   (tự tạo collection + validator + index trước khi nạp dữ liệu)
 *
 * CẢNH BÁO: xoá sạch dữ liệu nghiệp vụ (events, tiers, orders, tickets...) trước khi nạp lại.
 * Users/categories được upsert theo email/slug.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Câu hỏi mẫu của BTC, để test bước "Thông tin đặt vé" trước thanh toán.
const DEMO_FORM = [
  { key: "full_name", label: "Họ tên người tham dự", type: "text", required: true },
  { key: "phone", label: "Số điện thoại liên hệ", type: "text", required: true },
  { key: "tshirt", label: "Size áo", type: "select", required: false, options: ["S", "M", "L", "XL"] },
];

const connectDB = require("../config/db");
const initDatabase = require("../db/initDatabase");
const M = require("../models");
const { signTicket } = require("../services/bookingService");

const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/users.json"), "utf-8"));
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/events.json"), "utf-8"));

// Tên thành phố suy ra từ venueName ("..., TP. Hồ Chí Minh" -> "TP. Hồ Chí Minh")
const cityOf = (venue) => (venue.includes(",") ? venue.split(",").pop().trim() : "Chưa rõ");

function resolveTimes(session) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (session.daysFromNow ?? 0));
  start.setHours(session.startHour ?? 19, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 3600 * 1000);
  return { start, end };
}

async function run() {
  await connectDB();
  await initDatabase();

  // --- Xoá dữ liệu nghiệp vụ cũ ---
  console.log("\nXoá dữ liệu nghiệp vụ cũ...");
  for (const name of [
    "PayoutSettlement", "RefundRequest", "ResaleListing",
    "Ticket", "Payment", "Order", "Voucher", "Seat", "SeatmapLayout", "TicketTier", "EventSession", "EContract", "StaffAssignment", "Event",
    "OrganizerProfile",
  ]) {
    await M[name].deleteMany({});
  }

  // --- Categories ---
  const categoriesDef = [
    { name: "Nhạc sống & Concert", slug: "nhac-song-concert" },
    { name: "Hội thảo & Workshop", slug: "hoi-thao-workshop" },
    { name: "Thể Thao", slug: "the-thao" },
    { name: "Sân khấu & Nghệ thuật", slug: "san-khau-nghe-thuat" },
    { name: "Khác", slug: "khac" },
  ];
  const categoryByName = {};
  for (const c of categoriesDef) {
    categoryByName[c.name] = await M.Category.findOneAndUpdate(
      { slug: c.slug },
      { ...c, is_active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`Categories: ${categoriesDef.length}`);

  // --- Users ---
  const userByName = {};
  for (const u of usersData) {
    userByName[u.username] = await M.User.findOneAndUpdate(
      { email: u.email },
      {
        username: u.username,
        email: u.email,
        password_hash: await bcrypt.hash(u.password, 10),
        full_name: u.name,
        first_name: u.firstName,
        last_name: u.lastName,
        phone: u.phone,
        gender: u.gender,
        role: u.role,
        status: "ACTIVE",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`  user ${u.username} (${u.role}) / mật khẩu: ${u.password}`);
  }
  const admin = userByName.demo_admin;
  const organizer = userByName.demo_organizer;
  const staff = userByName.demo_staff;
  const customer = userByName.demo_user;

  // --- Organizer profile (KYC đã duyệt) ---
  await M.OrganizerProfile.create({
    user_id: organizer._id,
    organization_name: "Demo Concert Co., Ltd.",
    business_type: "ENTERPRISE",
    tax_code: "0312345678",
    id_card_or_license_url: "https://picsum.photos/seed/license/600/400",
    bank_name: "Vietcombank",
    bank_account_no: "0123456789",
    bank_account_holder: "CONG TY TNHH DEMO CONCERT",
    kyc_status: "VERIFIED",
    verified_by: admin._id,
    verified_at: new Date(),
  });

  // --- Events + ticket tiers + contracts + staff ---
  const events = [];
  const sessionsByEvent = {};
  const tiersByEvent = {};
  for (const [eIdx, e] of eventsData.entries()) {
    const rawSessions = [...(e.sessions || [])];
    // Demo nhiều suất: sự kiện đầu tiên có thêm suất thứ 2 (sau 1 ngày) với cùng hạng vé
    if (eIdx === 0 && rawSessions.length === 1) {
      rawSessions.push({ ...rawSessions[0], daysFromNow: (rawSessions[0].daysFromNow ?? 0) + 1 });
    }
    const times = rawSessions.map(resolveTimes);
    const start = new Date(Math.min(...times.map((t) => t.start)));
    const end = new Date(Math.max(...times.map((t) => t.end)));

    const rawTiers = rawSessions.flatMap((s) => s.tickets || []);
    const event = await M.Event.create({
      organizer_id: organizer._id,
      category_id: (categoryByName[e.category] || categoryByName["Khác"])._id,
      title: e.eventName,
      description: e.eventDesc,
      banner_url: e.backgroundImage,
      thumbnail_url: e.backgroundImage,
      venue_name: e.venueName,
      city: cityOf(e.venueName),
      start_time: start,
      end_time: end,
      has_seat_map: false,
      allow_resale: true,
      max_resale_markup_pct: 10,
      status: "PUBLISHED",
      is_featured_banner: !!e.isSpecial,
      is_special: !!e.isSpecial,
      is_trending: !!e.isTrending,
      organizer_name: "Demo Concert Co., Ltd.",
      organizer_info: e.organizerInfo,
      lowest_price: Math.min(...rawTiers.map((t) => Number(t.price) || 0)),
    });

    const sessions = await M.EventSession.insertMany(
      times.map((t, i) => ({
        event_id: event._id,
        name: rawSessions[i].name || `Suất diễn ${i + 1}`,
        start_time: t.start,
        end_time: t.end,
        status: "SCHEDULED",
      })),
    );

    const tierDocs = [];
    rawSessions.forEach((rs, si) => {
      (rs.tickets || []).forEach((t, i) => {
        tierDocs.push({
          event_id: event._id,
          session_id: sessions[si]._id,
          name: t.name,
          price: Number(t.price) || 0,
          total_quantity: Number(t.stock) || 50,
          available_quantity: Number(t.stock) || 50,
          zone_type: "GA",
          min_per_order: 1,
          max_per_order: 4,
          sale_start_time: new Date(Date.now() - 24 * 3600 * 1000),
          sale_end_time: times[si].start,
          zone_color: ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6"][i % 4],
          description: t.desc || `Vé hạng ${t.name}`,
        });
      });
    });
    const tiers = await M.TicketTier.insertMany(tierDocs);

    await M.EContract.create({
      event_id: event._id,
      organizer_id: organizer._id,
      approved_by_admin: admin._id,
      commission_rate_pct: 5,
      contract_terms_html: "<h3>Hợp đồng dịch vụ bán vé</h3><p>Sàn thu phí hoa hồng 5% trên doanh thu bán vé.</p>",
      signed_at: new Date(),
      signer_ip: "127.0.0.1",
      status: "SIGNED",
    });
    await M.StaffAssignment.create({
      staff_user_id: staff._id,
      organizer_id: organizer._id,
      event_id: event._id,
      assigned_gate: "Gate A",
      is_active: true,
    });

    events.push(event);
    sessionsByEvent[event._id] = sessions;
    tiersByEvent[event._id] = tiers;
    console.log(`  event "${event.title}" (${sessions.length} suất, ${tiers.length} hạng vé)`);
  }

  // --- Sự kiện có SƠ ĐỒ GHẾ để test chọn ghế / khóa ghế Redis (UC11, UC12) ---
  {
    const start = new Date(Date.now() + 20 * 24 * 3600 * 1000);
    start.setHours(19, 30, 0, 0);
    const seatEvent = await M.Event.create({
      organizer_id: organizer._id,
      category_id: categoryByName['Sân khấu & Nghệ thuật']._id,
      title: 'Vở Kịch Có Ghế Ngồi - Đêm Diễn Đặc Biệt',
      description: '<p>Sự kiện có sơ đồ ghế để test chọn ghế.</p>',
      banner_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=1200&auto=format&fit=crop',
      thumbnail_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=1200&auto=format&fit=crop',
      venue_name: 'Nhà Hát Lớn, Hà Nội',
      city: 'Hà Nội',
      start_time: start,
      end_time: new Date(start.getTime() + 3 * 3600 * 1000),
      has_seat_map: true,
      allow_resale: true,
      max_resale_markup_pct: 10,
      status: 'PUBLISHED',
      custom_form_schema: DEMO_FORM,
      organizer_name: 'Demo Concert Co., Ltd.',
      lowest_price: 200000,
    });
    const seatSession = await M.EventSession.create({
      event_id: seatEvent._id, name: 'Đêm diễn chính', start_time: start,
      end_time: new Date(start.getTime() + 3 * 3600 * 1000), status: 'SCHEDULED',
    });
    const mkTier = (name, price, color, qty) => ({
      event_id: seatEvent._id, session_id: seatSession._id, name, price,
      total_quantity: qty, available_quantity: qty, min_per_order: 1, max_per_order: 6, zone_type: 'SEATED',
      sale_start_time: new Date(Date.now() - 24 * 3600 * 1000), sale_end_time: start, zone_color: color,
    });
    const [vip, std] = await M.TicketTier.insertMany([mkTier('Ghế VIP', 500000, '#f59e0b', 20), mkTier('Ghế Thường', 200000, '#3b82f6', 30)]);
    const seatDocs = [];
    const rows = [['A', vip, 'SEC_VIP'], ['B', vip, 'SEC_VIP'], ['C', std, 'SEC_STD'], ['D', std, 'SEC_STD'], ['E', std, 'SEC_STD']];
    rows.forEach(([row, tier, section], r) => {
      const perRow = 10;
      const rowIdx = section === 'SEC_VIP' ? r : r - 2; // hàng thứ mấy trong khu
      for (let n = 1; n <= perRow; n++) {
        seatDocs.push({ event_id: seatEvent._id, session_id: seatSession._id, tier_id: tier._id,
          section_name: section, row_label: row, seat_number: String(n).padStart(2, '0'),
          coord_x: (n - 1) * 30, coord_y: rowIdx * 34, status: 'AVAILABLE' });
      }
    });
    await M.Seat.insertMany(seatDocs);
    // Sơ đồ SVG + cấu hình khu (giống kết quả Admin import seating_manifest.xlsx)
    const mkRows = (labels) => labels.map((label) => ({ label, from: 1, to: 10, aisles: [], blocked: [] }));
    await M.SeatmapLayout.create({
      event_id: seatEvent._id,
      svg_content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><rect id="STAGE_MAIN" x="150" y="10" width="300" height="50" rx="8"/><text x="300" y="42" text-anchor="middle" fill="#fff" font-size="20" font-family="sans-serif">SÂN KHẤU</text><rect id="SEC_VIP" x="100" y="90" width="400" height="90" rx="10"/><rect id="SEC_STD" x="60" y="210" width="480" height="130" rx="10"/></svg>',
      stage_ids: ['STAGE_MAIN'],
      sections: [
        { section_id: 'SEC_VIP', name: 'Khu VIP', type: 'SEATED', tier_name: 'Ghế VIP', capacity: 20, rows: mkRows(['A', 'B']) },
        { section_id: 'SEC_STD', name: 'Khu Thường', type: 'SEATED', tier_name: 'Ghế Thường', capacity: 30, rows: mkRows(['C', 'D', 'E']) },
      ],
      updated_by: admin._id,
    });
    await M.EContract.create({ event_id: seatEvent._id, organizer_id: organizer._id, approved_by_admin: admin._id,
      commission_rate_pct: 5, contract_terms_html: '<p>Hợp đồng mẫu</p>', signed_at: new Date(), signer_ip: '127.0.0.1', status: 'SIGNED' });
    await M.StaffAssignment.create({ staff_user_id: staff._id, organizer_id: organizer._id, event_id: seatEvent._id, assigned_gate: 'Gate A', is_active: true });
    console.log('  event có sơ đồ ghế: "' + seatEvent.title + '" (' + seatDocs.length + ' ghế, 5 hàng A-E x 10)');
  }

  // --- Vouchers (theo từng sự kiện đầu tiên) ---
  const first = events[0];
  const validFrom = new Date(Date.now() - 24 * 3600 * 1000);
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await M.Voucher.insertMany([
    {
      event_id: first._id, code: "CHAOHEXUAN2026", discount_type: "PERCENT", discount_value: 20,
      max_discount_amount: 50000, min_order_amount: 100000, usage_limit: 100, max_per_user: 1,
      valid_from: validFrom, valid_until: validUntil,
    },
    {
      event_id: first._id, code: "GIAM50K", discount_type: "FIXED", discount_value: 50000,
      min_order_amount: 200000, usage_limit: 50, max_per_user: 2,
      valid_from: validFrom, valid_until: validUntil,
    },
  ]);
  console.log(`  vouchers: CHAOHEXUAN2026, GIAM50K (sự kiện "${first.title}")`);

  // --- 1 đơn hàng đã thanh toán + vé mẫu cho demo_user ---
  const session = sessionsByEvent[first._id][0];
  const tier = tiersByEvent[first._id].find((t) => t.session_id.equals(session._id));
  const qty = 2;
  await M.TicketTier.updateOne({ _id: tier._id }, { $inc: { available_quantity: -qty } });
  const order = await M.Order.create({
    buyer_id: customer._id,
    event_id: first._id,
    session_id: session._id,
    order_code: `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-SEED01`,
    order_type: "PRIMARY",
    items_snapshot: [{ tier_id: tier._id, tier_name: tier.name, unit_price: tier.price, quantity: qty, seat_ids: [] }],
    subtotal_amount: tier.price * qty,
    discount_amount: 0,
    total_amount: tier.price * qty,
    status: "PAID",
    lock_expires_at: new Date(),
  });
  await M.Payment.create({
    order_id: order._id,
    gateway: "VNPAY",
    transaction_ref: "TX-SEED-0001",
    amount: order.total_amount,
    status: "SUCCESS",
    paid_at: new Date(),
  });
  const ticketDocs = Array.from({ length: qty }, (_, i) => {
    const code = `TK-SEED-${i + 1}`;
    return {
      order_id: order._id, event_id: first._id, session_id: session._id, tier_id: tier._id, owner_id: customer._id,
      ticket_code: code, qr_hash_signature: signTicket(code), status: "VALID",
    };
  });
  await M.Ticket.insertMany(ticketDocs);
  console.log(`  order ${order.order_code} (PAID) + ${qty} vé: TK-SEED-1, TK-SEED-2`);

  console.log("\nSeed xong.");
  await mongoose.disconnect();
  require("../config/redis").redis.disconnect();
}

run().catch(async (err) => {
  console.error("Seed lỗi:", err);
  await mongoose.disconnect();
  require("../config/redis").redis.disconnect();
  process.exit(1);
});
