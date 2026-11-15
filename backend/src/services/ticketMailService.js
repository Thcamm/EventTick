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
    let targetEmail = buyer?.email;
    if (!targetEmail && Array.isArray(order.attendee_form_answers)) {
      const emailField = order.attendee_form_answers.find(
        (a) => typeof a?.value === "string" && a.value.includes("@"),
      );
      if (emailField) targetEmail = emailField.value.trim();
    }
    if (!targetEmail && order.vat_invoice_info?.email) {
      targetEmail = String(order.vat_invoice_info.email).trim();
    }

    if (!targetEmail) {
      console.warn(`⚠️ [ticketMail] Đơn ${order.order_code}: Không tìm thấy email của người mua (buyer_id: ${order.buyer_id})`);
      return false;
    }

    const tierName = new Map(tiers.map((t) => [String(t._id), t.name]));
    const seatLabel = new Map(seats.map((s) => [String(s._id), `Hàng ${s.row_label} - Ghế ${s.seat_number}`]));
    const ok = await mailService.sendTicketEmail(targetEmail, {
      buyerName: buyer?.full_name || "Quý khách",
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
    if (ok) {
      console.log(`✅ [ticketMail] Đã gửi email vé đơn ${order.order_code} tới ${targetEmail}`);
    }
    return ok;
  } catch (err) {
    console.error("Gửi email vé lỗi:", err.message);
    return false;
  }
}

module.exports = { sendTicketEmailForOrder };
