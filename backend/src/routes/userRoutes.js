const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

// Cung cấp API chuẩn RESTful cho Profile (hỗ trợ cả JSON và multipart/form-data upload avatar)
router.get("/profile", requireAuth, ctrl.getProfile);
router.put("/profile", requireAuth, upload.single("avatar"), ctrl.updateProfile);
router.post("/profile/avatar", requireAuth, upload.single("avatar"), ctrl.updateProfile);

// Thông báo trong ứng dụng (chuông ở Dashboard)
const notif = require("../controllers/notificationController");
router.get("/notifications", requireAuth, notif.list);
router.put("/notifications/read-all", requireAuth, notif.readAll);
router.put("/notifications/:id/read", requireAuth, notif.read);

module.exports = router;
