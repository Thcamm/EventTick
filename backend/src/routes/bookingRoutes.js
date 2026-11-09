const router = require("express").Router();
const ctrl = require("../controllers/bookingController");
const { requireAuth } = require("../middleware/auth");

router.get("/user/tickets", requireAuth, ctrl.myTickets);
router.post("/", requireAuth, ctrl.createBooking);
router.post("/carts/:eventId", requireAuth, ctrl.createBooking);
router.put("/orders/:orderId/checkout-info", requireAuth, ctrl.updateCheckoutInfo);
router.post("/create-payment-intent", ctrl.createPaymentIntent);
router.get("/orders/auth/:orderId", ctrl.getOrder);
router.post("/orders/:orderId/cancel", requireAuth, ctrl.cancelOrder);
router.post("/orders/:orderId/refund", requireAuth, ctrl.requestRefund);
router.get("/refund-requests", requireAuth, ctrl.getMyRefundRequests);
router.post("/check-in", requireAuth, ctrl.checkInTicket);
router.get("/staff/events/:eventId/check-in-stats", requireAuth, ctrl.getStaffCheckInStats);

module.exports = router;
