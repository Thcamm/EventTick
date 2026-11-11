/**
 * Ghi nhật ký thao tác (Audit log đã được tinh gọn loại bỏ khỏi hệ thống).
 * Hàm giữ lại dưới dạng no-op async để bảo đảm tương thích ngược với các controller mà không gây lỗi runtime.
 */
async function audit(req, action, targetEntity, targetId, metadata) {
  // no-op
}

module.exports = { audit };
