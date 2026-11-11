const mongoose = require("mongoose");
const { Event, EventSession, EContract, OrganizerProfile, Category } = require("../models");
const { savePrivate, sendPrivate } = require("../services/privateStorage");
const contractSvc = require("../services/contractService");
const { sniff } = require("../utils/fileType");
const { httpError, validId, ah, str } = require("../utils/http");
const { audit } = require("../utils/audit");

const clientIp = (req) => String(req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "").slice(0, 45);

function contractToClient(c, { full = false } = {}) {
  const o = c.toObject ? c.toObject() : c;
  const createdAt = o.createdAt || o.created_at || (o._id && typeof o._id.getTimestamp === "function" ? o._id.getTimestamp() : new Date());
  const contractNumber = o.contract_number || (o._id ? `HD-${String(o._id).slice(-8).toUpperCase()}` : "");
  const out = {
    _id: o._id,
    id: o._id ? String(o._id) : undefined,
    contractNumber,
    eventId: o.event_id?._id || o.event_id,
    eventTitle: o.event_id?.title || (typeof o.event_id === "object" ? o.event_id?.title : undefined),
    organizerId: o.organizer_id,
    commissionRatePct: o.commission_rate_pct,
    status: o.status,
    signedAt: o.signed_at,
    signerIp: o.signer_ip,
    hasSignedPdf: Boolean(o.signed_pdf_url),
    signedPdfUrl: o.signed_pdf_url,
    createdAt,
    updatedAt: o.updatedAt || o.updated_at || createdAt,
  };
  if (full) out.termsHtml = o.contract_terms_html;
  return out;
}

// ============================================================== UC39 + UC41: Admin duyệt sự kiện

// GET /v1/admin/events?status=PENDING — hàng chờ kiểm duyệt
exports.adminListEvents = ah(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    const st = String(req.query.status).toUpperCase();
    if (!["DRAFT", "PENDING", "APPROVED", "PUBLISHED", "CANCELLED", "ENDED"].includes(st)) throw httpError("status không hợp lệ", 400);
    filter.status = st;
  }
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Event.find(filter).sort({ created_at: 1 }).skip((page - 1) * limit).limit(limit).select("title organizer_id venue_name city start_time end_time status created_at rejection_reason"),
    Event.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, items });
});

// GET /v1/admin/events/:id/legal-doc — Admin xem giấy phép biểu diễn
exports.adminLegalDoc = ah(async (req, res) => {
  const event = await Event.findById(validId(req.params.id, "ID sự kiện")).select("legal_doc_url");
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  await audit(req, "EVENT_VIEW_LEGAL_DOC", "events", event._id);
  return sendPrivate(res, event.legal_doc_url);
});

/**
 * PUT /v1/admin/events/:id/approve  { commissionRatePct, customTerms? }
 * Sự kiện PENDING -> APPROVED, sinh hợp đồng WAITING_SIGN với mức hoa hồng Admin đặt.
 * Sự kiện chỉ lên PUBLISHED sau khi Organizer ký (UC27).
 */
exports.approveEvent = ah(async (req, res) => {
  const id = validId(req.params.id, "ID sự kiện");
  const customTerms = req.body?.customTerms ? str(req.body.customTerms, 5000, "điều khoản bổ sung") : undefined;

  const event = await Event.findById(id);
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  if (event.status !== "PENDING") throw httpError(`Sự kiện đang ở trạng thái ${event.status}, chỉ duyệt được sự kiện PENDING`, 409);

  let rate = req.body?.commissionRatePct;
  if (rate === undefined || rate === null || rate === "") {
    const cat = event.category_id ? await Category.findById(event.category_id).select("default_commission_pct") : null;
    rate = Number(cat?.default_commission_pct ?? 10);
  } else {
    rate = Number(rate);
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) throw httpError("commissionRatePct phải từ 0 đến 50 (%)", 400);

  const [profile, sessions] = await Promise.all([
    OrganizerProfile.findOne({ user_id: event.organizer_id }),
    EventSession.find({ event_id: event._id }).sort({ start_time: 1 }),
  ]);
  if (!profile || profile.kyc_status !== "VERIFIED") throw httpError("Nhà tổ chức chưa có hồ sơ KYC được duyệt", 409);
  if (!sessions.length) throw httpError("Sự kiện chưa có suất diễn nào", 409);

  // Chuyển trạng thái nguyên tử: chỉ một Admin duyệt thành công, không sinh hợp đồng trùng
  const claimed = await Event.findOneAndUpdate(
    { _id: event._id, status: "PENDING" },
    { status: "APPROVED", $unset: { rejection_reason: 1 } },
    { new: true },
  );
  if (!claimed) throw httpError("Sự kiện vừa được xử lý bởi Admin khác", 409);

  try {
    const contract = await EContract.create({
      event_id: event._id,
      organizer_id: event.organizer_id,
      approved_by_admin: req.user.id,
      commission_rate_pct: rate,
      contract_terms_html: contractSvc.buildTermsHtml({ event, sessions, profile, commission: rate, customTerms }),
      status: "WAITING_SIGN",
    });
    await audit(req, "EVENT_APPROVE", "events", event._id, { commissionRatePct: rate, contractId: contract._id });
    res.json({
      success: true,
      message: "Đã duyệt sự kiện. Hợp đồng đã được tạo, chờ Nhà tổ chức ký.",
      event: { _id: claimed._id, status: claimed.status },
      contract: contractToClient(contract),
    });
  } catch (err) {
    // Hoàn tác trạng thái nếu không tạo được hợp đồng (VD: sự kiện này đã có hợp đồng)
    await Event.updateOne({ _id: event._id, status: "APPROVED" }, { status: "PENDING" });
    throw err;
  }
});

// PUT /v1/admin/events/:id/reject  { reason } — trả về DRAFT kèm lý do để organizer sửa và gửi lại
exports.rejectEvent = ah(async (req, res) => {
  const reason = str(req.body?.reason, 1000, "lý do từ chối");
  const event = await Event.findOneAndUpdate(
    { _id: validId(req.params.id, "ID sự kiện"), status: "PENDING" },
    { status: "DRAFT", rejection_reason: reason },
    { new: true },
  );
  if (!event) {
    const exists = await Event.exists({ _id: req.params.id });
    throw httpError(exists ? "Chỉ từ chối được sự kiện đang PENDING" : "Không tìm thấy sự kiện", exists ? 409 : 404);
  }
  await audit(req, "EVENT_REJECT", "events", event._id, { reason });
  res.json({ success: true, message: "Đã từ chối sự kiện", event: { _id: event._id, status: event.status, rejectionReason: reason } });
});

// PUT /v1/admin/contracts/:id/commission { commissionRatePct } — chỉnh hoa hồng khi CHƯA ký
exports.updateCommission = ah(async (req, res) => {
  const rate = Number(req.body?.commissionRatePct);
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) throw httpError("commissionRatePct phải từ 0 đến 50 (%)", 400);
  const contract = await EContract.findOne({ _id: validId(req.params.id, "ID hợp đồng"), status: "WAITING_SIGN" });
  if (!contract) throw httpError("Không tìm thấy hợp đồng đang chờ ký (hợp đồng đã ký không được sửa)", 404);
  const updated = await EContract.findOneAndUpdate(
    { _id: contract._id, status: "WAITING_SIGN" },
    { commission_rate_pct: rate, contract_terms_html: contractSvc.withCommission(contract.contract_terms_html, rate) },
    { new: true },
  );
  if (!updated) throw httpError("Hợp đồng vừa được ký, không thể sửa", 409);
  await audit(req, "CONTRACT_UPDATE_COMMISSION", "e_contracts", contract._id, { from: contract.commission_rate_pct, to: rate });
  res.json({ success: true, contract: contractToClient(updated) });
});

// GET /v1/admin/contracts?status=
exports.adminListContracts = ah(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const items = await EContract.find(filter).sort({ _id: -1 }).limit(100).populate("event_id", "title category start_date end_date banner_url status location");
  const clientItems = items.map((c) => contractToClient(c));
  res.json({ success: true, items: clientItems, contracts: clientItems, total: clientItems.length });
});

// GET /v1/admin/contracts/:id/pdf
exports.adminContractPdf = ah(async (req, res) => {
  const c = await EContract.findById(validId(req.params.id, "ID hợp đồng"));
  if (!c) throw httpError("Không tìm thấy hợp đồng", 404);
  return sendPrivate(res, c.signed_pdf_url);
});

// ============================================================== UC27: Organizer ký hợp đồng

// GET /v1/organizer/contracts — hợp đồng của tôi (lọc theo chủ sở hữu ở truy vấn)
exports.myContracts = ah(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const items = await EContract.find({ organizer_id: userId }).sort({ _id: -1 }).populate("event_id", "title category start_date end_date banner_url status location");
  const clientItems = items.map((c) => contractToClient(c));
  res.json({ success: true, items: clientItems, contracts: clientItems, total: clientItems.length });
});

// GET /v1/organizer/contracts/:id — xem điều khoản trước khi ký
exports.myContractDetail = ah(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const c = await EContract.findOne({ _id: validId(req.params.id, "ID hợp đồng"), organizer_id: userId }).populate("event_id");
  if (!c) throw httpError("Không tìm thấy hợp đồng", 404);
  const data = contractToClient(c, { full: true });
  res.json({ success: true, contract: data, item: data });
});

// GET /v1/organizer/contracts/:id/pdf — tải hợp đồng đã ký
exports.myContractPdf = ah(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const c = await EContract.findOne({ _id: validId(req.params.id, "ID hợp đồng"), organizer_id: userId });
  if (!c) throw httpError("Không tìm thấy hợp đồng", 404);
  if (c.status !== "SIGNED") throw httpError("Hợp đồng chưa được ký", 409);
  return sendPrivate(res, c.signed_pdf_url);
});

/**
 * POST /v1/organizer/contracts/:id/sign  { signature: "data:image/png;base64,...", agree: true }
 * Ký -> ghi chữ ký, IP, thời điểm -> xuất PDF -> hợp đồng SIGNED -> sự kiện PUBLISHED.
 * Chuyển trạng thái nguyên tử: ký hai lần hoặc ký khi Admin vừa sửa hoa hồng đều bị chặn.
 */
exports.sign = ah(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const id = validId(req.params.id, "ID hợp đồng");
  if (req.body?.agree !== true) throw httpError("Bạn phải đồng ý với điều khoản (agree: true)", 400);

  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.signature || ""));
  if (!m) throw httpError("Chữ ký phải là ảnh PNG dạng data URL (data:image/png;base64,...)", 400);
  const png = Buffer.from(m[1], "base64");
  if (sniff(png) !== "png") throw httpError("Chữ ký không phải ảnh PNG hợp lệ", 400);
  if (png.length > 1024 * 1024) throw httpError("Ảnh chữ ký quá lớn (tối đa 1MB)", 400);
  if (png.length < 300) throw httpError("Chữ ký trống hoặc quá nhỏ", 400);

  const contract = await EContract.findOne({ _id: id, organizer_id: userId });
  if (!contract) throw httpError("Không tìm thấy hợp đồng", 404);
  if (contract.status !== "WAITING_SIGN") throw httpError(`Hợp đồng đang ở trạng thái ${contract.status}`, 409);

  const [event, profile] = await Promise.all([
    Event.findById(contract.event_id),
    OrganizerProfile.findOne({ user_id: userId }),
  ]);
  if (!event || event.status !== "APPROVED") throw httpError("Sự kiện không ở trạng thái chờ ký", 409);
  if (!profile || profile.kyc_status !== "VERIFIED") throw httpError("Hồ sơ KYC không còn hiệu lực", 403);

  const signedAt = new Date();
  const ip = clientIp(req);

  // Giữ chỗ trạng thái trước (nguyên tử), rồi mới xuất PDF/upload; lỗi thì hoàn tác
  const claimed = await EContract.findOneAndUpdate(
    { _id: contract._id, status: "WAITING_SIGN", commission_rate_pct: contract.commission_rate_pct },
    { status: "SIGNED", signed_at: signedAt, signer_ip: ip },
    { new: true },
  );
  if (!claimed) throw httpError("Hợp đồng vừa thay đổi (Admin chỉnh sửa hoặc đã được ký), hãy tải lại và xem điều khoản mới", 409);

  try {
    const pdf = await contractSvc.buildSignedPdf({ contract: claimed, event, profile, signaturePng: png, signerIp: ip, signedAt });
    const [pdfRef, sigRef] = await Promise.all([
      savePrivate(pdf, { filename: `contract_${claimed._id}.pdf`, folder: "eventtick_contracts", resourceType: "raw" }),
      savePrivate(png, { filename: `signature_${claimed._id}.png`, folder: "eventtick_contracts", resourceType: "image" }),
    ]);
    claimed.signed_pdf_url = pdfRef;
    claimed.organizer_signature_url = sigRef;
    await claimed.save();

    const published = await Event.findOneAndUpdate({ _id: event._id, status: "APPROVED" }, { status: "PUBLISHED" }, { new: true });
    if (!published) throw new Error("Không thể xuất bản sự kiện");

    await audit(req, "CONTRACT_SIGN", "e_contracts", claimed._id, { eventId: event._id, ip });
    res.json({
      success: true,
      message: "Ký hợp đồng thành công. Sự kiện đã được xuất bản.",
      contract: contractToClient(claimed),
      event: { _id: published._id, status: published.status },
    });
  } catch (err) {
    await EContract.updateOne(
      { _id: contract._id, status: "SIGNED" },
      { status: "WAITING_SIGN", $unset: { signed_at: 1, signer_ip: 1, signed_pdf_url: 1, organizer_signature_url: 1 } },
    );
    throw err;
  }
});

// PUT /v1/organizer/contracts/:id/reject  { reason } — organizer từ chối ký
exports.rejectContract = ah(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const reason = str(req.body?.reason, 1000, "lý do từ chối ký", { required: false });
  const c = await EContract.findOneAndUpdate(
    { _id: validId(req.params.id, "ID hợp đồng"), organizer_id: userId, status: "WAITING_SIGN" },
    { status: "REJECTED" },
    { new: true },
  );
  if (!c) throw httpError("Không tìm thấy hợp đồng đang chờ ký", 404);
  await Event.updateOne({ _id: c.event_id, status: "APPROVED" }, { status: "DRAFT", rejection_reason: reason || "Nhà tổ chức từ chối ký hợp đồng" });
  await audit(req, "CONTRACT_REJECT", "e_contracts", c._id, { reason });
  res.json({ success: true, message: "Đã từ chối ký hợp đồng. Sự kiện trở về bản nháp." });
});
