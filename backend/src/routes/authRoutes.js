const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

// Đăng ký & Kích hoạt email (UC01, UC03)
router.post("/register", ctrl.register);
router.get("/verify-email", ctrl.verifyEmail);
router.post("/resend-verification", ctrl.resendVerification);

// Xác thực Google OAuth (UC01, UC02)
router.post("/google", ctrl.googleAuth);
router.get("/google", ctrl.googleRedirect);
router.get("/google/callback", ctrl.googleCallback);

// Yêu cầu nâng cấp vai trò Nhà tổ chức (UC01)
router.post("/request-organizer", requireAuth, ctrl.requestOrganizer);

// Đăng nhập & Đăng xuất
router.post("/login", ctrl.login);
router.get("/logout", ctrl.logout);
router.get("/", ctrl.me);

// Hồ sơ cá nhân
router.get("/user", requireAuth, ctrl.getProfile);
router.post("/user/my-account", requireAuth, upload.single("avatar"), ctrl.updateProfile);

// Quên mật khẩu & Đổi mật khẩu
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password", ctrl.resetPassword);
router.post("/change-password", requireAuth, ctrl.changePassword);

module.exports = router;
