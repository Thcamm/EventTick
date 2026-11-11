const router = require("express").Router();
const ctrl = require("../controllers/paymentController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/sepay-webhook", ctrl.sepayWebhook);
router.get("/orders/:orderId/instructions", requireAuth, ctrl.paymentInstructions);
// Admin: giao dịch tiền vào không khớp đơn (chuyển thiếu/thừa, đơn hết hạn...) cần đối soát
router.get("/admin/unmatched", requireRole("ADMIN"), ctrl.listUnmatched);

module.exports = router;
