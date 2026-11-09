const router = require("express").Router();
const ctrl = require("../controllers/resaleController");
const { requireAuth } = require("../middleware/auth");

// Danh sách vé bán lại theo sự kiện (Công khai)
router.get("/listings", ctrl.getAllActiveListings);
router.get("/events/:eventId/listings", ctrl.getEventListings);

// Quản lý vé bán lại của cá nhân & Mua vé bán lại
router.post("/listings", requireAuth, ctrl.createListing);
router.delete("/listings/:id", requireAuth, ctrl.cancelListing);
router.get("/my-listings", requireAuth, ctrl.getMyListings);
router.post("/listings/:id/buy", requireAuth, ctrl.buyListing);

module.exports = router;
