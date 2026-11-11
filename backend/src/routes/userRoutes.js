const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

// Cung cấp API chuẩn RESTful cho Profile (hỗ trợ cả JSON và multipart/form-data upload avatar)
router.get("/profile", requireAuth, ctrl.getProfile);
router.put("/profile", requireAuth, upload.single("avatar"), ctrl.updateProfile);
router.post("/profile/avatar", requireAuth, upload.single("avatar"), ctrl.updateProfile);

module.exports = router;
