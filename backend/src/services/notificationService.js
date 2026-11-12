const { Notification, User } = require("../models");
const mailService = require("../utils/mailService");

/**
 * Tạo thông báo trong ứng dụng + gửi email (không chờ email). Lỗi ở đây KHÔNG được làm hỏng
 * nghiệp vụ chính (duyệt, ký, giải ngân...), nên mọi lỗi chỉ ghi log.
 */
async function notify(userId, { type, title, body = "", link }) {
  try {
    const n = await Notification.create({ user_id: userId, type, title, body, link });
    const u = await User.findById(userId).select("email full_name status");
    if (u?.email && u.status !== "BLOCKED") {
      mailService.sendNotificationEmail(u.email, { name: u.full_name, title, body, link }).catch(() => {});
    }
    return n;
  } catch (err) {
    console.error("⚠️ [Notification] không tạo được thông báo:", err.message);
    return null;
  }
}

/** Gửi cho mọi Admin đang hoạt động. */
async function notifyAdmins(payload) {
  try {
    const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }).select("_id");
    await Promise.all(admins.map((a) => notify(a._id, payload)));
  } catch (err) {
    console.error("⚠️ [Notification] không gửi được cho Admin:", err.message);
  }
}

module.exports = { notify, notifyAdmins };
