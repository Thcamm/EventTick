/**
 * Test toàn diện tất cả các Use Case mới hoàn thành (21 UCs):
 * UC06, UC08, UC09, UC13, UC16, UC18, UC19, UC20,
 * UC26, UC29, UC30, UC31, UC32, UC33, UC34,
 * UC36, UC37, UC40, UC42, UC43, UC44.
 *
 * Chạy: node scripts/test-all-remaining-ucs.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const {
  User,
  Category,
  Event,
  EventSession,
  TicketTier,
  Ticket,
  Order,
  Payment,
  OrganizerProfile,
  EContract,
  StaffAssignment,
  RefundRequest,
  ResaleListing,
  Review,
  PayoutSettlement,
  WishlistFollow,
} = require("../src/models");
const bookingService = require("../src/services/bookingService");

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0;
let failN = 0;

const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  cond ? pass++ : failN++;
};

async function api(method, path, { cookie, json, form } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: json ? JSON.stringify(json) : form,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let body;
  try {
    body = JSON.parse(buf.toString());
  } catch {
    body = null;
  }
  return {
    status: res.status,
    body,
    buf,
    text: buf.toString(),
    type: res.headers.get("content-type") || "",
    setCookie: res.headers.get("set-cookie"),
  };
}

const login = async (username) => {
  const res = await api("POST", "/v1/auth/login", {
    json: { username, password: "123456" },
  });
  if (!res.setCookie) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  return res.setCookie.split(";")[0];
};

(async () => {
  try {
    console.log("=== BẮT ĐẦU KIỂM THỬ 21 USE CASES CÒN LẠI ===");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventtick");

    // 1. Đăng nhập các vai trò
    const adminCookie = await login("demo_admin");
    const organizerCookie = await login("demo_organizer");
    const userCookie = await login("demo_user");
    const staffCookie = await login("demo_staff");

    check("Đăng nhập Admin", !!adminCookie);
    check("Đăng nhập Organizer", !!organizerCookie);
    check("Đăng nhập Customer", !!userCookie);
    check("Đăng nhập Staff", !!staffCookie);

    // Lấy user documents
    const adminUser = await User.findOne({ username: "demo_admin" });
    const organizerUser = await User.findOne({ username: "demo_organizer" });
    const customerUser = await User.findOne({ username: "demo_user" });
    const staffUser = await User.findOne({ username: "demo_staff" });

    // Đảm bảo Organizer có profile APPROVED
    await OrganizerProfile.findOneAndUpdate(
      { user_id: organizerUser._id },
      { status: "APPROVED", organization_name: "Công ty Test", business_type: "ENTERPRISE" },
      { upsert: true, new: true }
    );

    // Tạo test category
    let testCategory = await Category.findOne({ slug: "test-am-nhac" });
    if (!testCategory) {
      testCategory = await Category.create({
        name: "Test Âm Nhạc",
        slug: "test-am-nhac",
        is_active: true,
      });
    }

    // Tạo test event đã PUBLISHED
    let testEvent = await Event.findOne({ title: "Sự Kiện Test Đầy Đủ Use Cases" });
    if (!testEvent) {
      testEvent = await Event.create({
        title: "Sự Kiện Test Đầy Đủ Use Cases",
        description: "Mô tả sự kiện phục vụ automated test",
        organizer_id: organizerUser._id,
        category_id: testCategory._id,
        banner_url: "https://example.com/banner.jpg",
        venue_name: "Nhà thi đấu Phú Thọ",
        venue_city: "Hồ Chí Minh",
        city: "Hồ Chí Minh",
        venue_address: "1 Lữ Gia, Q.11",
        start_time: new Date(Date.now() + 86400000),
        end_time: new Date(Date.now() + 86400000 + 10800000),
        status: "PUBLISHED",
        ticket_sale_start: new Date(Date.now() - 3600000),
        ticket_sale_end: new Date(Date.now() + 86400000 * 7),
        min_price: 200000,
        max_price: 500000,
        has_seat_map: false,
      });
    } else {
      testEvent.status = "PUBLISHED";
      testEvent.ticket_sale_start = new Date(Date.now() - 3600000);
      testEvent.ticket_sale_end = new Date(Date.now() + 86400000 * 7);
      testEvent.banner_url = "https://example.com/banner.jpg";
      testEvent.city = "Hồ Chí Minh";
      testEvent.start_time = new Date(Date.now() + 86400000);
      testEvent.end_time = new Date(Date.now() + 86400000 + 10800000);
      await testEvent.save();
    }

    // Tạo test session & tier
    let testSession = await EventSession.findOne({ event_id: testEvent._id });
    if (!testSession) {
      testSession = await EventSession.create({
        event_id: testEvent._id,
        name: "Đêm diễn chính thức",
        start_time: new Date(Date.now() + 86400000),
        end_time: new Date(Date.now() + 86400000 + 10800000),
        status: "SCHEDULED",
      });
    }

    let testTier = await TicketTier.findOne({ session_id: testSession._id });
    if (!testTier) {
      testTier = await TicketTier.create({
        event_id: testEvent._id,
        session_id: testSession._id,
        name: "Vé VIP Test",
        price: 300000,
        total_quantity: 100,
        available_quantity: 95,
        sale_start_time: new Date(Date.now() - 3600000),
        sale_end_time: new Date(Date.now() + 86400000 * 7),
      });
    }

    // Đảm bảo có hợp đồng SIGNED cho event để tính hoa hồng & đối soát
    await EContract.findOneAndUpdate(
      { event_id: testEvent._id },
      {
        organizer_id: organizerUser._id,
        approved_by_admin: adminUser._id,
        status: "SIGNED",
        commission_rate_pct: 10,
        contract_terms_html: "<p>Hợp đồng mẫu kiểm thử</p>",
        signed_at: new Date(),
      },
      { upsert: true, new: true }
    );

    // =================================================================
    // 1. UC06: TÌM KIẾM, BỘ LỌC NÂNG CAO & PHÂN TRANG
    // =================================================================
    console.log("\n--- TEST UC06: Tìm kiếm, Bộ lọc nâng cao & Phân trang ---");
    {
      const res = await api("GET", "/v1/events/search?keyword=Test&city=Hồ Chí Minh");
      check("UC06: Tìm kiếm theo từ khóa + thành phố", res.status === 200 && res.body?.success);
      check("UC06: Trả về mảng sự kiện kèm phân trang", Array.isArray(res.body?.events) && res.body?.total >= 1);
      check("UC06: Thuộc tính phân trang chuẩn xác", res.body?.page === 1 && typeof res.body?.limit === "number");
    }

    // =================================================================
    // 2. UC08: WISHLIST & THEO DÕI BAN TỔ CHỨC
    // =================================================================
    console.log("\n--- TEST UC08: Wishlist & Theo dõi Ban tổ chức ---");
    {
      // Yêu thích
      const addWish = await api("POST", `/v1/user/wishlist/${testEvent._id}`, { cookie: userCookie });
      check("UC08: Thêm sự kiện vào wishlist", addWish.status === 200 && addWish.body?.inWishlist === true);

      const checkWish = await api("GET", `/v1/user/wishlist/check/${testEvent._id}`, { cookie: userCookie });
      check("UC08: Kiểm tra trạng thái wishlist = true", checkWish.body?.inWishlist === true);

      const listWish = await api("GET", "/v1/user/wishlist", { cookie: userCookie });
      check("UC08: Lấy danh sách wishlist", listWish.body?.total >= 1 && listWish.body?.events?.some(e => String(e.id || e._id) === String(testEvent._id)));

      const delWish = await api("DELETE", `/v1/user/wishlist/${testEvent._id}`, { cookie: userCookie });
      check("UC08: Xóa sự kiện khỏi wishlist", delWish.status === 200 && delWish.body?.inWishlist === false);

      // Follow
      const addFollow = await api("POST", `/v1/user/follow/${organizerUser._id}`, { cookie: userCookie });
      check("UC08: Theo dõi ban tổ chức", addFollow.status === 200 && addFollow.body?.following === true);

      const checkFollow = await api("GET", `/v1/user/follow/check/${organizerUser._id}`, { cookie: userCookie });
      check("UC08: Kiểm tra trạng thái follow = true", checkFollow.body?.following === true);

      const listFollow = await api("GET", "/v1/user/following", { cookie: userCookie });
      check("UC08: Lấy danh sách ban tổ chức đang theo dõi", listFollow.body?.total >= 1);

      const delFollow = await api("DELETE", `/v1/user/follow/${organizerUser._id}`, { cookie: userCookie });
      check("UC08: Hủy theo dõi ban tổ chức", delFollow.status === 200 && delFollow.body?.following === false);
    }

    // =================================================================
    // 3. UC09: PHÒNG CHỜ ẢO (VIRTUAL WAITING ROOM)
    // =================================================================
    console.log("\n--- TEST UC09: Phòng chờ ảo ---");
    {
      const join = await api("POST", `/v1/events/${testEvent._id}/waiting-room/join`, { cookie: userCookie });
      check("UC09: Xếp hàng vào phòng chờ ảo", join.status === 200 && join.body?.success);
      check("UC09: Nhận thông tin vị trí hàng chờ và thời gian ước tính", typeof join.body?.position === "number");

      const status = await api("GET", `/v1/events/${testEvent._id}/waiting-room/status`, { cookie: userCookie });
      check("UC09: Xem trạng thái phòng chờ ảo", status.status === 200 && status.body?.inQueue === true);
    }

    // =================================================================
    // 4. UC26: TÙY BIẾN BIỂU MẪU THÔNG TIN NGƯỜI THAM DỰ
    // =================================================================
    console.log("\n--- TEST UC26: Tùy biến biểu mẫu thông tin người tham dự ---");
    {
      const customFormPayload = {
        attendeeFormSchema: [
          { key: "fullName", label: "Họ và tên người xem", type: "text", required: true },
          { key: "tshirtSize", label: "Cỡ áo kỷ niệm", type: "select", options: ["S", "M", "L", "XL"], required: false },
        ],
      };
      const res = await api("PUT", `/v1/organizer/events/${testEvent._id}/custom-form`, {
        cookie: organizerCookie,
        json: customFormPayload,
      });
      check("UC26: Ban tổ chức lưu cấu hình Custom Form thành công", res.status === 200 && res.body?.success);
      check("UC26: Trả về đúng số lượng trường cấu hình", res.body?.attendeeFormSchema?.length === 2);
    }

    // Tạo đơn hàng mẫu và vé mẫu cho các test tiếp theo
    const sampleOrderCode = "ORD-TEST-" + Date.now();
    const testOrder = await Order.create({
      order_code: sampleOrderCode,
      buyer_id: customerUser._id,
      event_id: testEvent._id,
      session_id: testSession._id,
      status: "PAID",
      subtotal_amount: 300000,
      total_amount: 300000,
      items_snapshot: [
        {
          tier_id: testTier._id,
          tier_name: testTier.name,
          unit_price: 300000,
          quantity: 1,
        },
      ],
      lock_expires_at: new Date(Date.now() + 86400000),
    });

    const testTicket = await Ticket.create({
      ticket_code: "TCK-TEST-" + Date.now(),
      order_id: testOrder._id,
      event_id: testEvent._id,
      session_id: testSession._id,
      tier_id: testTier._id,
      owner_id: customerUser._id,
      qr_hash_signature: "hash_test_" + Date.now(),
      status: "VALID",
    });

    // =================================================================
    // 5. UC13 & UC16: BIỂU MẪU THÔNG TIN NGƯỜI THAM DỰ & HÓA ĐƠN VAT
    // =================================================================
    console.log("\n--- TEST UC13 & UC16: Biểu mẫu người tham dự & Hóa đơn VAT ---");
    {
      const checkoutInfo = {
        attendee_form_answers: [
          { fullName: "Trần Thị Khách", email: "user@demo.com", phone: "0909876543", tshirtSize: "M" },
        ],
        vat_invoice_info: {
          companyName: "Công ty TNHH Khách Hàng",
          taxCode: "0301234567",
          companyAddress: "Quận 1, TP. Hồ Chí Minh",
          recipientEmail: "tax@demo.com",
        },
      };

      const res = await api("PUT", `/v1/booking/orders/${testOrder._id}/checkout-info`, {
        cookie: userCookie,
        json: checkoutInfo,
      });

      check("UC13 & UC16: Cập nhật thông tin người tham dự & hóa đơn VAT cho đơn hàng", res.status === 200 && res.body?.success);
      check("UC13: Dữ liệu form người tham dự được lưu", res.body?.order?.attendee_form_answers?.length === 1);
      check("UC16: Dữ liệu hóa đơn VAT được lưu chuẩn xác", res.body?.order?.vat_invoice_info?.taxCode === "0301234567");
    }

    // =================================================================
    // 6. UC19: SÀN MUA BÁN LẠI VÉ (RESALE MARKETPLACE)
    // =================================================================
    console.log("\n--- TEST UC19: Sàn mua bán lại vé ---");
    let resaleListingId = null;
    {
      // 1. Chặn giá vượt quá trần 110% (300.000 * 1.1 = 330.000)
      const overPrice = await api("POST", "/v1/resale/listings", {
        cookie: userCookie,
        json: { ticketId: testTicket._id, resalePrice: 350000, bankName: "Vietcombank", accountNo: "0123456789", accountHolder: "NGUYEN VAN A" },
      });
      check("UC19: Chặn niêm yết giá vé vượt trần 110% (400)", overPrice.status === 400);

      // 2. Niêm yết hợp lệ (310.000đ <= 330.000đ)
      const validListing = await api("POST", "/v1/resale/listings", {
        cookie: userCookie,
        json: { ticketId: testTicket._id, resalePrice: 310000, bankName: "Vietcombank", accountNo: "0123456789", accountHolder: "NGUYEN VAN A" },
      });
      check("UC19: Đăng bán lại vé thành công", validListing.status === 201 && validListing.body?.success);
      resaleListingId = validListing.body?.listing?.id;

      // Vé phải chuyển sang LISTED_RESALE
      const updatedTicket = await Ticket.findById(testTicket._id);
      check("UC19: Vé được đổi trạng thái sang LISTED_RESALE", updatedTicket.status === "LISTED_RESALE");

      // 3. Xem danh sách vé bán lại theo sự kiện
      const eventListings = await api("GET", `/v1/resale/events/${testEvent._id}/listings`);
      check("UC19: Xem danh sách vé bán lại công khai của sự kiện", eventListings.status === 200 && eventListings.body?.total >= 1);

      // 4. Xem danh sách vé đã đăng của tôi
      const myListings = await api("GET", "/v1/resale/my-listings", { cookie: userCookie });
      check("UC19: Người bán xem danh sách vé đã đăng bán", myListings.status === 200 && myListings.body?.listings?.length >= 1);

      // 5. Mua lại: giữ chỗ (không voucher) -> thanh toán -> cấp vé mới
      const withVoucher = await api("POST", "/v1/resale/orders", {
        cookie: adminCookie,
        json: { eventId: testEvent._id, listingIds: [resaleListingId], voucherCode: "ANY", agreeTerms: true },
      });
      check("UC19: Vé bán lại không áp dụng voucher (400)", withVoucher.status === 400);

      const holdRes = await api("POST", "/v1/resale/orders", {
        cookie: adminCookie,
        json: { eventId: testEvent._id, listingIds: [resaleListingId], agreeTerms: true },
      });
      check("UC19: Giữ chỗ vé bán lại, tạo đơn RESALE chờ thanh toán", holdRes.status === 201 && holdRes.body?.orderId);
      const listingHeld = await ResaleListing.findById(resaleListingId);
      check("UC19: Tin bán chuyển sang RESERVED khi có người thanh toán", listingHeld?.status === "RESERVED");

      await bookingService.confirmPaymentAndIssueTickets({ orderId: holdRes.body.orderId, gateway: "VIETQR", transactionRef: "TEST-RS-" + Date.now() });
      const newTicket = await Ticket.findOne({ order_id: holdRes.body.orderId });
      check("UC19: Vé mới được phát hành cho người mua sau thanh toán", newTicket && newTicket.ticket_code !== testTicket.ticket_code && newTicket.status === "VALID");
      const listingSold = await ResaleListing.findById(resaleListingId);
      check("UC19: Tin bán SOLD, chờ Admin chi trả cho người bán", listingSold?.status === "SOLD" && listingSold?.payout_status === "PENDING");

      const payoutRes = await api("PUT", `/v1/admin/resale/payouts/${resaleListingId}/paid`, { cookie: adminCookie, json: { payoutRef: "FT-TEST-001" } });
      check("UC19: Admin xác nhận đã chuyển tiền cho người bán", payoutRes.status === 200);

      // Kiểm tra vé cũ bị vô hiệu hóa
      const oldTicketAfter = await Ticket.findById(testTicket._id);
      check("UC19: Vé cũ có trạng thái RESOLD_INVALID", oldTicketAfter.status === "RESOLD_INVALID");
    }

    // =================================================================
    // 7. UC18 (ĐÃ BỎ): không có hoàn vé lẻ, chỉ hoàn tiền khi sự kiện bị huỷ
    // =================================================================
    console.log("\n--- TEST UC18: Hoàn vé lẻ đã bị gỡ ---");
    {
      const gone = await api("POST", `/v1/booking/orders/${testOrder._id}/refund`, { cookie: userCookie, json: { reason: "x" } });
      check("UC18: API hoàn vé lẻ không còn tồn tại (404)", gone.status === 404);
      const myList = await api("GET", "/v1/booking/refund-requests", { cookie: userCookie });
      check("UC18: Khách vẫn xem được lịch sử hoàn tiền (do huỷ sự kiện)", myList.status === 200 && Array.isArray(myList.body?.refundRequests));
    }

    // =================================================================
    // 8. UC20: ĐÁNH GIÁ & PHẢN HỒI SAU SỰ KIỆN
    // =================================================================
    console.log("\n--- TEST UC20: Đánh giá & Phản hồi sau sự kiện ---");
    {
      await Review.deleteMany({ event_id: testEvent._id });

      // Tạo một vé đã sử dụng cho customerUser để đủ điều kiện đánh giá
      await Ticket.create({
        ticket_code: "TCK-REV-" + Date.now(),
        order_id: testOrder._id,
        event_id: testEvent._id,
        session_id: testSession._id,
        tier_id: testTier._id,
        owner_id: customerUser._id,
        qr_hash_signature: "hash_rev_" + Date.now(),
        status: "USED",
      });

      const reviewPayload = { rating: 5, comment: "Âm thanh ánh sáng rất tuyệt vời, tổ chức chu đáo!" };
      const createRev = await api("POST", `/v1/events/${testEvent._id}/reviews`, {
        cookie: userCookie,
        json: reviewPayload,
      });
      check("UC20: Gửi đánh giá và bình luận sự kiện", createRev.status === 201 && createRev.body?.success);

      // Chặn đánh giá trùng
      const dupRev = await api("POST", `/v1/events/${testEvent._id}/reviews`, {
        cookie: userCookie,
        json: reviewPayload,
      });
      check("UC20: Chặn gửi đánh giá lặp lại cho cùng 1 sự kiện (409)", dupRev.status === 409);

      // Lấy danh sách đánh giá công khai
      const listRev = await api("GET", `/v1/events/${testEvent._id}/reviews`);
      check("UC20: Xem danh sách đánh giá kèm điểm trung bình", listRev.status === 200 && listRev.body?.averageRating === 5 && listRev.body?.totalReviews >= 1);
    }

    // =================================================================
    // 9. UC29: QUẢN LÝ DANH SÁCH NGƯỜI THAM DỰ & ĐƠN HÀNG
    // =================================================================
    console.log("\n--- TEST UC29: Quản lý danh sách người tham dự & Đơn hàng ---");
    {
      const ordersRes = await api("GET", `/v1/organizer/events/${testEvent._id}/orders`, { cookie: organizerCookie });
      check("UC29: Lấy danh sách đơn hàng của sự kiện", ordersRes.status === 200 && ordersRes.body?.orders?.length >= 1);

      const attendeesRes = await api("GET", `/v1/organizer/events/${testEvent._id}/attendees`, { cookie: organizerCookie });
      check("UC29: Lấy danh sách người tham dự kèm thông tin vé & câu trả lời form", attendeesRes.status === 200 && Array.isArray(attendeesRes.body?.attendees));
    }

    // =================================================================
    // 10. UC30: PHÂN CÔNG NHÂN VIÊN & PHÂN LUỒNG CỔNG SOÁT VÉ
    // =================================================================
    console.log("\n--- TEST UC30: Phân công nhân viên & Phân luồng cổng ---");
    let staffAssignId = null;
    {
      await StaffAssignment.deleteMany({ event_id: testEvent._id });

      const addStaff = await api("POST", `/v1/organizer/events/${testEvent._id}/staff`, {
        cookie: organizerCookie,
        json: { staffUserId: staffUser._id, assignedGate: "Cổng A - Khu VIP" },
      });
      check("UC30: Ban tổ chức phân công nhân viên vào cổng soát vé", (addStaff.status === 201 || addStaff.status === 200) && addStaff.body?.success);
      staffAssignId = addStaff.body?.assignment?.id || addStaff.body?.assignmentId;

      const listStaff = await api("GET", `/v1/organizer/events/${testEvent._id}/staff`, { cookie: organizerCookie });
      check("UC30: Xem danh sách nhân viên đã phân công", listStaff.status === 200 && listStaff.body?.staffList?.length >= 1);

      const updateStaff = await api("PUT", `/v1/organizer/staff-assignments/${staffAssignId}`, {
        cookie: organizerCookie,
        json: { assignedGate: "Cổng B - Cửa Tây" },
      });
      check("UC30: Cập nhật phân luồng cổng cho nhân viên", updateStaff.status === 200 && updateStaff.body?.assignment?.assigned_gate === "Cổng B - Cửa Tây");

      const delStaff = await api("DELETE", `/v1/organizer/staff-assignments/${staffAssignId}`, { cookie: organizerCookie });
      check("UC30: Thu hồi quyền nhân viên soát vé khỏi sự kiện", delStaff.status === 200 && delStaff.body?.success);

      // Cấp lại phân công nhân viên để phục vụ ca soát vé thời gian thực (UC36)
      await StaffAssignment.create({
        event_id: testEvent._id,
        organizer_id: organizerUser._id,
        staff_user_id: staffUser._id,
        assigned_gate: "Cổng Chính",
        is_active: true,
      });
    }

    // =================================================================
    // 11. UC31: BẢNG ĐIỀU KHIỂN THỜI GIAN THỰC (ORGANIZER DASHBOARD)
    // =================================================================
    console.log("\n--- TEST UC31: Bảng điều khiển thời gian thực ---");
    {
      const dash = await api("GET", "/v1/organizer/dashboard", { cookie: organizerCookie });
      check("UC31: Lấy dữ liệu tổng quan Dashboard nhà tổ chức", dash.status === 200 && dash.body?.success);
      check("UC31: Chứa các chỉ số KPIs (doanh thu, số vé, đơn gần đây)", typeof dash.body?.summary?.totalRevenue === "number" && Array.isArray(dash.body?.recentOrders));
    }

    // =================================================================
    // 12. UC32: THỐNG KÊ DOANH THU THEO VÉ & BÁO CÁO TÀI CHÍNH
    // =================================================================
    console.log("\n--- TEST UC32: Thống kê doanh thu chi tiết sự kiện ---");
    {
      const analytics = await api("GET", `/v1/organizer/events/${testEvent._id}/analytics`, { cookie: organizerCookie });
      check("UC32: Lấy thống kê tài chính và tỷ lệ bán vé", analytics.status === 200 && analytics.body?.success);
      check("UC32: Phân rã doanh thu theo từng hạng vé", Array.isArray(analytics.body?.tierBreakdown));
      check("UC32: Tính toán hoa hồng và doanh thu thực nhận", typeof analytics.body?.financialSummary?.estimatedNetPayout === "number");
    }

    // =================================================================
    // 13. UC33: XUẤT BÁO CÁO DỮ LIỆU (EXPORT CSV)
    // =================================================================
    console.log("\n--- TEST UC33: Xuất báo cáo dữ liệu CSV ---");
    {
      const expAttendees = await api("GET", `/v1/organizer/events/${testEvent._id}/export/attendees`, { cookie: organizerCookie });
      check("UC33: Xuất danh sách người tham dự định dạng CSV", expAttendees.status === 200 && expAttendees.type.includes("text/csv"));
      check("UC33: File CSV có UTF-8 BOM hỗ trợ tiếng Việt", expAttendees.buf[0] === 0xEF && expAttendees.buf[1] === 0xBB && expAttendees.buf[2] === 0xBF);

      const expOrders = await api("GET", `/v1/organizer/events/${testEvent._id}/export/orders`, { cookie: organizerCookie });
      check("UC33: Xuất danh sách đơn hàng định dạng CSV", expOrders.status === 200 && expOrders.type.includes("text/csv"));
    }

    // =================================================================
    // 14. UC34: YÊU CẦU ĐỐI SOÁT & RÚT TIỀN (PAYOUT SETTLEMENT)
    // =================================================================
    console.log("\n--- TEST UC34: Yêu cầu đối soát & Rút tiền ---");
    let testPayoutId = null;
    {
      await PayoutSettlement.deleteMany({ event_id: testEvent._id });

      const summary = await api("GET", `/v1/organizer/events/${testEvent._id}/payout-summary`, { cookie: organizerCookie });
      check("UC34: Xem bảng tóm tắt đối soát tài chính", summary.status === 200 && (summary.body?.summary?.grossRevenue !== undefined || summary.body?.payoutSummary?.grossRevenue !== undefined));

      const reqPayout = await api("POST", `/v1/organizer/events/${testEvent._id}/payout/request`, { cookie: organizerCookie });
      check("UC34: Gửi yêu cầu đối soát giải ngân", reqPayout.status === 201 && reqPayout.body?.success);
      testPayoutId = reqPayout.body?.payout?.id;

      // Chặn gửi trùng khi đang REQUESTED
      const dupPayout = await api("POST", `/v1/organizer/events/${testEvent._id}/payout/request`, { cookie: organizerCookie });
      check("UC34: Chặn gửi trùng yêu cầu đối soát đang xử lý (409)", dupPayout.status === 409);

      const listPayouts = await api("GET", "/v1/organizer/payouts", { cookie: organizerCookie });
      check("UC34: Xem lịch sử các đợt đối soát", listPayouts.status === 200 && listPayouts.body?.payouts?.length >= 1);
    }

    // =================================================================
    // 15. UC36: THỐNG KÊ LƯU LƯỢNG CHECK-IN THEO CỔNG THỜI GIAN THỰC
    // =================================================================
    console.log("\n--- TEST UC36: Thống kê check-in thời gian thực ---");
    {
      const stats = await api("GET", `/v1/booking/staff/events/${testEvent._id}/check-in-stats`, { cookie: staffCookie });
      check("UC36: Nhân viên xem thống kê tỷ lệ check-in", stats.status === 200 && stats.body?.success);
      check("UC36: Trả về số vé tổng, đã quét, còn lại và breakdown từng hạng vé", typeof stats.body?.stats?.totalTickets === "number" && Array.isArray(stats.body?.stats?.tierBreakdown));
    }

    // =================================================================
    // 16. UC37: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN RBAC (ADMIN)
    // =================================================================
    console.log("\n--- TEST UC37: Quản lý người dùng & RBAC ---");
    {
      const usersRes = await api("GET", "/v1/admin/users?role=CUSTOMER", { cookie: adminCookie });
      check("UC37: Admin xem danh sách người dùng kèm bộ lọc role", usersRes.status === 200 && usersRes.body?.users?.length >= 1);

      // Chặn admin tự khóa tài khoản của mình
      const selfBlock = await api("PUT", `/v1/admin/users/${adminUser._id}/status`, {
        cookie: adminCookie,
        json: { status: "BLOCKED" },
      });
      check("UC37: Chặn Admin tự khóa tài khoản của chính mình (400)", selfBlock.status === 400);

      // Khóa và mở khóa người dùng
      const blockUser = await api("PUT", `/v1/admin/users/${customerUser._id}/status`, {
        cookie: adminCookie,
        json: { status: "BLOCKED" },
      });
      check("UC37: Admin khóa tài khoản người dùng vi phạm", blockUser.status === 200 && blockUser.body?.user?.status === "BLOCKED");

      const unblockUser = await api("PUT", `/v1/admin/users/${customerUser._id}/status`, {
        cookie: adminCookie,
        json: { status: "ACTIVE" },
      });
      check("UC37: Admin mở khóa tài khoản người dùng", unblockUser.status === 200 && unblockUser.body?.user?.status === "ACTIVE");

      // Thay đổi vai trò (RBAC)
      const changeRole = await api("PUT", `/v1/admin/users/${customerUser._id}/role`, {
        cookie: adminCookie,
        json: { role: "STAFF" },
      });
      check("UC37: Admin phân quyền tài khoản (CUSTOMER -> STAFF)", changeRole.status === 200 && changeRole.body?.user?.role === "STAFF");

      // Trả lại role CUSTOMER
      await api("PUT", `/v1/admin/users/${customerUser._id}/role`, {
        cookie: adminCookie,
        json: { role: "CUSTOMER" },
      });
    }

    // =================================================================
    // 17. UC40: CMS DANH MỤC & CẤU HÌNH HIỂN THỊ TRANG CHỦ
    // =================================================================
    console.log("\n--- TEST UC40: CMS Danh mục & Trang chủ ---");
    let cmsCatId = null;
    {
      // 1. Lấy danh mục công khai
      const publicCats = await api("GET", "/v1/categories");
      check("UC40: Khách xem danh sách danh mục hoạt động", publicCats.status === 200 && Array.isArray(publicCats.body?.categories));

      // 2. Admin tạo danh mục mới
      const newCat = await api("POST", "/v1/admin/categories", {
        cookie: adminCookie,
        json: { name: "Workshop Công Nghệ " + Date.now(), isActive: true },
      });
      check("UC40: Admin tạo danh mục mới", newCat.status === 201 && newCat.body?.success);
      cmsCatId = newCat.body?.category?._id;

      // 3. Admin cập nhật danh mục
      const updateCat = await api("PUT", `/v1/admin/categories/${cmsCatId}`, {
        cookie: adminCookie,
        json: { name: "Workshop Công Nghệ AI", iconUrl: "https://example.com/icon.png" },
      });
      check("UC40: Admin cập nhật danh mục", updateCat.status === 200 && updateCat.body?.category?.name === "Workshop Công Nghệ AI");

      // 4. Admin xoá danh mục vừa tạo
      const delCat = await api("DELETE", `/v1/admin/categories/${cmsCatId}`, { cookie: adminCookie });
      check("UC40: Admin xoá danh mục", delCat.status === 200 && delCat.body?.success);

      // 5. Cấu hình hiển thị sự kiện nổi bật trang chủ
      const featRes = await api("PUT", `/v1/admin/events/${testEvent._id}/featured`, {
        cookie: adminCookie,
        json: { isFeaturedBanner: true, isTrending: true, isSpecial: false },
      });
      check("UC40: Admin cài đặt hiển thị banner & trending cho sự kiện", featRes.status === 200 && featRes.body?.event?.isFeaturedBanner === true);
    }

    // =================================================================
    // 18. UC42: QUẢN LÝ ĐỐI SOÁT & GIẢI NGÂN (FINANCIAL SETTLEMENT)
    // =================================================================
    console.log("\n--- TEST UC42: Quản lý đối soát & Phê duyệt giải ngân ---");
    {
      const listP = await api("GET", "/v1/admin/payouts", { cookie: adminCookie });
      check("UC42: Admin xem danh sách các đợt đối soát", listP.status === 200 && listP.body?.payouts?.length >= 1);

      if (testPayoutId) {
        const approveP = await api("PUT", `/v1/admin/payouts/${testPayoutId}/approve`, { cookie: adminCookie });
        check("UC42: Admin duyệt yêu cầu đối soát (REQUESTED -> APPROVED)", approveP.status === 200 && approveP.body?.payout?.status === "APPROVED");

        const settleP = await api("PUT", `/v1/admin/payouts/${testPayoutId}/settle`, {
          cookie: adminCookie,
          json: { bankTransferReceiptUrl: "https://bank.com/receipt-123.pdf" },
        });
        check("UC42: Admin xác nhận giải ngân thành công (APPROVED -> SETTLED)", settleP.status === 200 && settleP.body?.payout?.status === "SETTLED");
      }
    }

    // =================================================================
    // 19. UC43: QUẢN LÝ HOÀN TIỀN & HOÀN TIỀN HÀNG LOẠT
    // =================================================================
    console.log("\n--- TEST UC43: Quản lý hoàn tiền & Hoàn tiền hàng loạt ---");
    {
      const listR = await api("GET", "/v1/admin/refunds", { cookie: adminCookie });
      check("UC43: Admin xem danh sách yêu cầu hoàn tiền", listR.status === 200 && Array.isArray(listR.body?.refunds));

      // Tạo sự kiện huỷ đột xuất để test hoàn tiền hàng loạt
      const cancelEvent = await Event.create({
        title: "Sự Kiện Bị Huỷ Do Bão Lũ",
        organizer_id: organizerUser._id,
        category_id: testCategory._id,
        banner_url: "https://example.com/banner-cancel.jpg",
        venue_name: "Sân vận động",
        venue_city: "Đà Nẵng",
        city: "Đà Nẵng",
        venue_address: "123 Đường Biển",
        start_time: new Date(Date.now() + 86400000),
        end_time: new Date(Date.now() + 86400000 + 10800000),
        status: "PUBLISHED",
      });

      const cancelSession = await EventSession.create({
        event_id: cancelEvent._id,
        name: "Suất duy nhất",
        start_time: cancelEvent.start_time,
        end_time: cancelEvent.end_time,
      });

      const cancelTier = await TicketTier.create({
        event_id: cancelEvent._id,
        session_id: cancelSession._id,
        name: "Vé VIP Hủy",
        price: 500000,
        total_quantity: 100,
        available_quantity: 99,
        sale_start_time: new Date(),
        sale_end_time: cancelEvent.end_time,
      });

      const orderToRefund = await Order.create({
        order_code: "ORD-BULK-REFUND-" + Date.now(),
        buyer_id: customerUser._id,
        event_id: cancelEvent._id,
        session_id: cancelSession._id,
        status: "PAID",
        subtotal_amount: 500000,
        total_amount: 500000,
        lock_expires_at: new Date(Date.now() + 86400000),
        items_snapshot: [{ tier_id: cancelTier._id, tier_name: "VIP", unit_price: 500000, quantity: 1 }],
      });

      const bulkRes = await api("POST", `/v1/admin/events/${cancelEvent._id}/bulk-refund`, {
        cookie: adminCookie,
        json: { reason: "Huỷ sự kiện do thiên tai bão lũ" },
      });

      check("UC43: Admin hoàn tiền hàng loạt khi sự kiện bị huỷ", bulkRes.status === 200 && bulkRes.body?.refundedCount >= 1);

      const checkCancelEvent = await Event.findById(cancelEvent._id);
      check("UC43: Trạng thái sự kiện chuyển thành CANCELLED", checkCancelEvent.status === "CANCELLED");

      const checkRefundedOrder = await Order.findById(orderToRefund._id);
      check("UC43: Đơn hàng chuyển sang trạng thái REFUNDED", checkRefundedOrder.status === "REFUNDED");
    }

    // =================================================================
    // 20. UC44: THỐNG KÊ DOANH THU TOÀN HỆ THỐNG THEO THÁNG
    // =================================================================
    console.log("\n--- TEST UC44: Thống kê doanh thu toàn hệ thống ---");
    {
      const currentYear = new Date().getFullYear();
      const revRes = await api("GET", `/v1/admin/analytics/revenue?year=${currentYear}`, { cookie: adminCookie });
      check("UC44: Admin xem báo cáo doanh thu theo tháng (1-12)", revRes.status === 200 && revRes.body?.monthlyStats?.length === 12);
      check("UC44: Tính toán tổng GMV, hoàn tiền và hoa hồng nền tảng", typeof revRes.body?.summary?.yearlyCommissionRevenue === "number");

      const overviewRes = await api("GET", "/v1/admin/analytics/overview", { cookie: adminCookie });
      check("UC44: Admin xem Dashboard tổng quan hệ thống", overviewRes.status === 200 && overviewRes.body?.success);
      check("UC44: Thống kê người dùng theo role và sự kiện theo status", overviewRes.body?.overview?.users?.total >= 1 && overviewRes.body?.overview?.events?.total >= 1);
    }

    console.log(`\n======================================================`);
    console.log(`KẾT QUẢ KIỂM THỬ: ${pass} PASS / ${failN} FAIL`);
    console.log(`======================================================\n`);

    process.exit(failN > 0 ? 1 : 0);
  } catch (err) {
    console.error("Lỗi thực thi test:", err);
    process.exit(1);
  }
})();
