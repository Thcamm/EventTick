const { Event, EventSession, TicketTier, Seat, User } = require("../models");
const mailService = require("../utils/mailService");

/** Gửi email vé cho người mua sau thanh toán. Không bao giờ ném lỗi (không làm hỏng luồng thanh toán). */
async function sendTicketEmailForOrder(order, tickets) {
  try {
    if (!tickets?.length) return false;
    const [buyer, event, session, tiers, seats] = await Promise.all([
      User.findById(order.buyer_id).select("email full_name"),
      Event.findById(order.event_id).select("title venue_name city"),
      EventSession.findById(order.session_id).select("name start_time"),
      TicketTier.find({ _id: { $in: tickets.map((t) => t.tier_id) } }).select("name"),
      Seat.find({ _id: { $in: tickets.map((t) => t.seat_id).filter(Boolean) } }).select("row_label seat_number"),
    ]);
    if (!buyer?.email) return false;
    const tierName = new Map(tiers.map((t) => [String(t._id), t.name]));
    const seatLabel = new Map(seats.map((s) => [String(s._id), `Hàng ${s.row_label} - Ghế ${s.seat_number}`]));
    return await mailService.sendTicketEmail(buyer.email, {
      buyerName: buyer.full_name,
      eventTitle: event?.title,
      sessionName: session?.name,
      startTime: session?.start_time,
      venue: [event?.venue_name, event?.city].filter(Boolean).join(", "),
      orderCode: order.order_code,
      totalAmount: order.total_amount,
      tickets: tickets.map((t) => ({
        code: t.ticket_code,
        tierName: tierName.get(String(t.tier_id)) || "Vé",
        seatLabel: t.seat_id ? seatLabel.get(String(t.seat_id)) : "",
        qrData: `${t.ticket_code}.${t.qr_hash_signature}`,
      })),
    });
  } catch (err) {
    console.error("Gửi email vé lỗi:", err.message);
    return false;
  }
}

module.exports = { sendTicketEmailForOrder };
