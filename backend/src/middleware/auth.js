const { verifyToken } = require("../utils/jwt");

/**
 * Đọc cookie "token" (nếu có) và gắn req.user = { id, username } | null.
 * Áp dụng cho MỌI request — để route nào cũng biết được ai đang đăng nhập
 * mà không bắt buộc phải đăng nhập (vd: GET /auth dùng cho Header.jsx).
 */
function attachUser(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      req.user = null; // token hết hạn hoặc không hợp lệ -> coi như chưa đăng nhập
    }
  } else {
    req.user = null;
  }
  next();
}

/** Chặn request nếu chưa đăng nhập — dùng cho các route cần bảo vệ. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
  }
  next();
}

module.exports = { attachUser, requireAuth };

/**
 * Phân quyền theo DB (không tin role trong JWT, vì JWT sống 7 ngày và có thể đã cũ
 * khi Admin đổi quyền / khóa tài khoản).
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
      const { User } = require("../models");
      const u = await User.findById(req.user.id).select("role status");
      if (!u || u.status === "BLOCKED") {
        return res.status(403).json({ success: false, message: "Tài khoản không khả dụng" });
      }
      if (!roles.includes(u.role)) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện thao tác này" });
      }
      req.dbUser = u;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Chỉ Organizer đã được Admin duyệt KYC (kyc_status = VERIFIED) mới được qua. */
async function requireVerifiedOrganizer(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
    const { User, OrganizerProfile } = require("../models");
    const u = await User.findById(req.user.id).select("role status");
    if (!u || u.status === "BLOCKED") return res.status(403).json({ success: false, message: "Tài khoản không khả dụng" });
    if (u.role !== "ORGANIZER") {
      return res.status(403).json({ success: false, message: "Chỉ Nhà tổ chức mới thực hiện được. Hãy gửi hồ sơ KYC (POST /v1/organizer/kyc) và chờ Admin duyệt." });
    }
    const profile = await OrganizerProfile.findOne({ user_id: u._id }).select("kyc_status");
    if (!profile || profile.kyc_status !== "VERIFIED") {
      return res.status(403).json({ success: false, message: "Hồ sơ KYC chưa được duyệt" });
    }
    req.dbUser = u;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports.requireRole = requireRole;
module.exports.requireVerifiedOrganizer = requireVerifiedOrganizer;
