const { AuditLog } = require("../models");

/** Ghi nhật ký thao tác nhạy cảm (duyệt KYC, duyệt sự kiện, ký hợp đồng...). Không bao giờ làm hỏng request chính. */
async function audit(req, action, targetEntity, targetId, metadata) {
  try {
    await AuditLog.create({
      actor_id: req.user?.id,
      action,
      target_entity: targetEntity,
      target_id: String(targetId),
      metadata,
      ip_address: req.ip ? String(req.ip).slice(0, 45) : undefined,
    });
  } catch (e) {
    console.error("[audit] ghi log lỗi:", e.message);
  }
}

module.exports = { audit };
