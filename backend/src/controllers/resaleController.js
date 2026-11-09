const crypto = require("crypto");
const mongoose = require("mongoose");
const { ResaleListing, Ticket, TicketTier, Event, Order, Payment } = require("../models");
const { signTicket } = require("../services/bookingService");
const { audit } = require("../utils/audit");

function genResaleOrderCode() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RS-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// POST /v1/resale/listings (UC19)
exports.createListing = async (req, res) => {
  try {
    const { ticketId, resalePrice } = req.body;
    if (!ticketId || resalePrice === undefined || resalePrice === null) {
      return res.status(400).json({ success: false, message: "Thiếu mã vé hoặc giá bán lại" });
    }

    const priceNum = Number(resalePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: "Giá bán lại không hợp lệ" });
    }

    const ticket = await Ticket.findOne({ _id: ticketId, owner_id: req.user.id })
      .populate("tier_id")
      .populate("event_id");

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy vé hợp lệ thuộc tài khoản của bạn" });
    }

    if (ticket.status !== "VALID") {
      return res.status(400).json({ success: false, message: `Không thể đăng bán vé ở trạng thái ${ticket.status}` });
    }

    if (ticket.event_id?.start_time && new Date() >= ticket.event_id.start_time) {
      return res.status(400).json({ success: false, message: "Sự kiện đã bắt đầu, không thể đăng bán lại vé" });
    }

    const originalPrice = ticket.tier_id?.price || priceNum;
    const maxAllowedPrice = Math.round(originalPrice * 1.1); // Giới hạn trần 110% giá gốc để chống phe vé
    if (priceNum > maxAllowedPrice) {
      return res.status(400).json({
        success: false,
        message: `Giá bán lại vượt trần quy định (tối đa 110% giá gốc: ${maxAllowedPrice.toLocaleString()} ₫)`,
      });
    }

    // Atomic: Chuyển vé sang LISTED_RESALE
    const updatedTicket = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: "VALID" },
      { status: "LISTED_RESALE" },
      { new: true },
    );
    if (!updatedTicket) {
      return res.status(409).json({ success: false, message: "Vé đang được xử lý hoặc không còn hợp lệ" });
    }

    const listing = await ResaleListing.create({
      ticket_id: ticket._id,
      seller_id: req.user.id,
      original_price: originalPrice,
      resale_price: priceNum,
      status: "ACTIVE",
    });

    await audit(req, "RESALE_LIST_CREATE", "resale_listings", listing._id, {
      ticketId: ticket._id,
      resalePrice: priceNum,
    });

    res.status(201).json({
      success: true,
      message: "Đăng bán lại vé thành công!",
      listing: {
        id: listing._id,
        ticketId: ticket._id,
        originalPrice,
        resalePrice: priceNum,
        status: listing.status,
        createdAt: listing.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /v1/resale/listings/:id (UC19)
exports.cancelListing = async (req, res) => {
  try {
    const listing = await ResaleListing.findOne({ _id: req.params.id, seller_id: req.user.id });
    if (!listing) return res.status(404).json({ success: false, message: "Không tìm thấy tin bán vé" });

    if (listing.status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: `Tin bán vé đang ở trạng thái ${listing.status}` });
    }

    listing.status = "CANCELLED";
    await listing.save();

    // Hoàn lại vé sang VALID
    await Ticket.updateOne({ _id: listing.ticket_id, status: "LISTED_RESALE" }, { status: "VALID" });

    await audit(req, "RESALE_LIST_CANCEL", "resale_listings", listing._id, { ticketId: listing.ticket_id });

    res.json({ success: true, message: "Đã huỷ đăng bán lại vé thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/resale/events/:eventId/listings (UC19)
exports.getEventListings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const listings = await ResaleListing.find({ status: "ACTIVE" })
      .populate({
        path: "ticket_id",
        match: { event_id: eventId },
        populate: [
          { path: "tier_id", select: "name price zone_color" },
          { path: "seat_id", select: "section_name row_label seat_number" },
          { path: "session_id", select: "name start_time end_time" },
        ],
      })
      .populate("seller_id", "full_name username avatar_url")
      .sort({ resale_price: 1 });

    // Lọc những listing có ticket khớp eventId
    const activeListings = listings.filter((l) => l.ticket_id);

    res.json({
      success: true,
      listings: activeListings.map((l) => ({
        id: l._id,
        resalePrice: l.resale_price,
        originalPrice: l.original_price,
        tierName: l.ticket_id.tier_id?.name,
        seat: l.ticket_id.seat_id
          ? `${l.ticket_id.seat_id.section_name}-${l.ticket_id.seat_id.row_label}${l.ticket_id.seat_id.seat_number}`
          : "Vé tự do (GA)",
        session: l.ticket_id.session_id,
        seller: {
          id: l.seller_id?._id,
          name: l.seller_id?.full_name || l.seller_id?.username || "Người bán",
          avatarUrl: l.seller_id?.avatar_url,
        },
        createdAt: l.created_at,
      })),
      total: activeListings.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/resale/my-listings (UC19)
exports.getMyListings = async (req, res) => {
  try {
    const listings = await ResaleListing.find({ seller_id: req.user.id })
      .populate({
        path: "ticket_id",
        populate: [
          { path: "event_id", select: "title banner_url venue_name" },
          { path: "tier_id", select: "name price" },
          { path: "seat_id", select: "section_name row_label seat_number" },
        ],
      })
      .sort({ created_at: -1 });

    res.json({
      success: true,
      listings: listings.map((l) => ({
        id: l._id,
        resalePrice: l.resale_price,
        originalPrice: l.original_price,
        status: l.status,
        ticketCode: l.ticket_id?.ticket_code,
        eventName: l.ticket_id?.event_id?.title,
        tierName: l.ticket_id?.tier_id?.name,
        seat: l.ticket_id?.seat_id
          ? `${l.ticket_id.seat_id.section_name}-${l.ticket_id.seat_id.row_label}${l.ticket_id.seat_id.seat_number}`
          : null,
        createdAt: l.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /v1/resale/listings/:id/buy (UC19)
exports.buyListing = async (req, res) => {
  try {
    const listingId = req.params.id;
    const buyerId = req.user.id;

    const listing = await ResaleListing.findById(listingId).populate("ticket_id");
    if (!listing) return res.status(404).json({ success: false, message: "Không tìm thấy tin bán vé" });

    if (String(listing.seller_id) === String(buyerId)) {
      return res.status(400).json({ success: false, message: "Không thể tự mua lại vé của chính mình" });
    }

    if (listing.status !== "ACTIVE") {
      return res.status(409).json({ success: false, message: "Vé này đã có người khác mua hoặc đã bị huỷ bán" });
    }

    const oldTicket = listing.ticket_id?._id ? listing.ticket_id : await Ticket.findById(listing.ticket_id);
    if (!oldTicket || oldTicket.status !== "LISTED_RESALE") {
      return res.status(409).json({ success: false, message: "Trạng thái vé không hợp lệ để mua" });
    }

    // Atomic: Chuyển listing sang SOLD
    const claimedListing = await ResaleListing.findOneAndUpdate(
      { _id: listing._id, status: "ACTIVE" },
      { status: "SOLD" },
      { new: true },
    );
    if (!claimedListing) {
      return res.status(409).json({ success: false, message: "Vé vừa được người khác mua nhanh hơn" });
    }

    // 1. Vô hiệu hoá vé cũ (RESOLD_INVALID)
    await Ticket.updateOne({ _id: oldTicket._id }, { status: "RESOLD_INVALID" });

    // 2. Tạo Order mua lại vé (RESALE)
    const order = await Order.create({
      buyer_id: buyerId,
      event_id: oldTicket.event_id,
      session_id: oldTicket.session_id,
      order_code: genResaleOrderCode(),
      order_type: "RESALE",
      items_snapshot: [
        {
          tier_id: oldTicket.tier_id,
          tier_name: "Vé mua lại (Resale)",
          unit_price: listing.resale_price,
          quantity: 1,
          seat_ids: oldTicket.seat_id ? [oldTicket.seat_id] : [],
        },
      ],
      subtotal_amount: listing.resale_price,
      discount_amount: 0,
      total_amount: listing.resale_price,
      status: "PAID",
      lock_expires_at: new Date(Date.now() + 86400000),
    });

    claimedListing.buyer_order_id = order._id;
    await claimedListing.save();

    // 3. Tạo thanh toán Payment
    await Payment.create({
      order_id: order._id,
      gateway: "VIETQR",
      transaction_ref: `RESALE-TX-${Date.now()}`,
      amount: listing.resale_price,
      status: "SUCCESS",
      paid_at: new Date(),
    });

    // 4. Sinh vé mới tinh với QR signature mới cho người mua
    const newTicketCode = `TK-RS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const newTicket = await Ticket.create({
      order_id: order._id,
      event_id: oldTicket.event_id,
      session_id: oldTicket.session_id,
      tier_id: oldTicket.tier_id,
      seat_id: oldTicket.seat_id,
      owner_id: buyerId,
      ticket_code: newTicketCode,
      qr_hash_signature: signTicket(newTicketCode),
      status: "VALID",
    });

    await audit(req, "RESALE_BUY_SUCCESS", "resale_listings", claimedListing._id, {
      oldTicketId: oldTicket._id,
      newTicketId: newTicket._id,
      buyerId,
      amount: listing.resale_price,
    });

    res.status(201).json({
      success: true,
      message: "Mua vé bán lại thành công! Vé mới đã được cấp vào tài khoản của bạn.",
      orderId: order._id,
      orderCode: order.order_code,
      newTicket: {
        id: newTicket._id,
        code: newTicket.ticket_code,
        ticketCode: newTicket.ticket_code,
        qrHash: newTicket.qr_hash_signature,
        status: newTicket.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
