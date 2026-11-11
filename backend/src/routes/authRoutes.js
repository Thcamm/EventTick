const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

// Đăng nhập / đăng ký bằng Google
const google = require("../controllers/googleAuthController");
router.get("/google", google.start);
router.get("/google/callback", google.callback);

const gone = (req, res) => res.status(410).json({ success: false, message: "Chỉ hỗ trợ đăng nhập bằng Google" });
// Đăng ký & Kích hoạt email (đã tắt: chỉ Google; giữ /login cho tài khoản demo)
router.post("/register", gone);
router.get("/verify-email", ctrl.verifyEmail);
router.post("/resend-verification", ctrl.resendVerification);

// Đăng nhập & Đăng xuất
router.post("/login", ctrl.login);
router.get("/logout", ctrl.logout);
router.get("/", ctrl.me);

// Hồ sơ cá nhân
router.get("/user", requireAuth, ctrl.getProfile);
router.post("/user/my-account", requireAuth, upload.single("avatar"), ctrl.updateProfile);

// Quên mật khẩu & Đổi mật khẩu
router.post("/forgot-password", gone);
router.post("/reset-password", gone);
router.post("/change-password", requireAuth, ctrl.changePassword);

module.exports = router;
