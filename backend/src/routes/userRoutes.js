const router = require("express").Router();
const ctrl = require("../controllers/authController");
const userFeatures = require("../controllers/userFeaturesController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

// Cung cấp API chuẩn RESTful cho Profile (hỗ trợ cả JSON và multipart/form-data upload avatar)
router.get("/profile", requireAuth, ctrl.getProfile);
router.put("/profile", requireAuth, upload.single("avatar"), ctrl.updateProfile);
router.post("/profile/avatar", requireAuth, upload.single("avatar"), ctrl.updateProfile);

// Yêu thích sự kiện (UC08)
router.get("/wishlist", requireAuth, userFeatures.getWishlist);
router.get("/wishlist/check/:eventId", requireAuth, userFeatures.checkWishlist);
router.post("/wishlist/:eventId", requireAuth, userFeatures.addToWishlist);
router.delete("/wishlist/:eventId", requireAuth, userFeatures.removeFromWishlist);

// Theo dõi ban tổ chức (UC08)
router.get("/following", requireAuth, userFeatures.getFollowingOrganizers);
router.get("/follow/check/:organizerId", requireAuth, userFeatures.checkFollowing);
router.post("/follow/:organizerId", requireAuth, userFeatures.followOrganizer);
router.delete("/follow/:organizerId", requireAuth, userFeatures.unfollowOrganizer);

module.exports = router;
