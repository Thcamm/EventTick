const { WishlistFollow, Event, User, OrganizerProfile } = require("../models");
const { audit } = require("../utils/audit");

// POST /v1/user/wishlist/:eventId (UC08)
exports.addToWishlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });

    const existing = await WishlistFollow.findOne({
      user_id: req.user.id,
      target_event_id: event._id,
      type: "WISHLIST_EVENT",
    });

    if (existing) {
      return res.json({ success: true, message: "Sự kiện đã có trong danh sách yêu thích", inWishlist: true, isWishlisted: true });
    }

    await WishlistFollow.create({
      user_id: req.user.id,
      target_event_id: event._id,
      type: "WISHLIST_EVENT",
    });

    await audit(req, "WISHLIST_ADD", "wishlists_follows", event._id, { eventId: event._id });

    res.json({ success: true, message: "Đã thêm sự kiện vào danh sách yêu thích", inWishlist: true, isWishlisted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /v1/user/wishlist/:eventId (UC08)
exports.removeFromWishlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    await WishlistFollow.findOneAndDelete({
      user_id: req.user.id,
      target_event_id: eventId,
      type: "WISHLIST_EVENT",
    });

    res.json({ success: true, message: "Đã xóa sự kiện khỏi danh sách yêu thích", inWishlist: false, isWishlisted: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/user/wishlist (UC08)
exports.getWishlist = async (req, res) => {
  try {
    const items = await WishlistFollow.find({
      user_id: req.user.id,
      type: "WISHLIST_EVENT",
    })
      .populate({
        path: "target_event_id",
        select: "title slug banner_url thumbnail_url venue_name city start_time end_time lowest_price status",
      })
      .sort({ created_at: -1 });

    const events = items
      .filter((i) => i.target_event_id)
      .map((i) => ({
        id: i.target_event_id._id,
        _id: i.target_event_id._id,
        title: i.target_event_id.title,
        slug: i.target_event_id.slug,
        bannerUrl: i.target_event_id.banner_url,
        thumbnailUrl: i.target_event_id.thumbnail_url,
        venueName: i.target_event_id.venue_name,
        city: i.target_event_id.city,
        startTime: i.target_event_id.start_time,
        endTime: i.target_event_id.end_time,
        lowestPrice: i.target_event_id.lowest_price,
        status: i.target_event_id.status,
        savedAt: i.created_at,
      }));

    res.json({ success: true, events, total: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/user/wishlist/check/:eventId
exports.checkWishlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const existing = await WishlistFollow.findOne({
      user_id: req.user.id,
      target_event_id: eventId,
      type: "WISHLIST_EVENT",
    });
    res.json({ success: true, inWishlist: !!existing, isWishlisted: !!existing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /v1/user/follow/:organizerId (UC08)
exports.followOrganizer = async (req, res) => {
  try {
    const { organizerId } = req.params;
    if (String(req.user.id) === String(organizerId)) {
      return res.status(400).json({ success: false, message: "Không thể tự theo dõi chính mình" });
    }

    const orgUser = await User.findById(organizerId);
    if (!orgUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ban tổ chức" });
    }

    const existing = await WishlistFollow.findOne({
      user_id: req.user.id,
      target_organizer_id: orgUser._id,
      type: "FOLLOW_ORGANIZER",
    });

    if (existing) {
      return res.json({ success: true, message: "Đang theo dõi ban tổ chức này", isFollowing: true, following: true });
    }

    await WishlistFollow.create({
      user_id: req.user.id,
      target_organizer_id: orgUser._id,
      type: "FOLLOW_ORGANIZER",
    });

    await audit(req, "ORGANIZER_FOLLOW", "wishlists_follows", orgUser._id, { organizerId: orgUser._id });

    res.json({ success: true, message: "Đã theo dõi ban tổ chức thành công", isFollowing: true, following: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /v1/user/follow/:organizerId (UC08)
exports.unfollowOrganizer = async (req, res) => {
  try {
    const { organizerId } = req.params;
    await WishlistFollow.findOneAndDelete({
      user_id: req.user.id,
      target_organizer_id: organizerId,
      type: "FOLLOW_ORGANIZER",
    });

    res.json({ success: true, message: "Đã hủy theo dõi ban tổ chức", isFollowing: false, following: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/user/following (UC08)
exports.getFollowingOrganizers = async (req, res) => {
  try {
    const items = await WishlistFollow.find({
      user_id: req.user.id,
      type: "FOLLOW_ORGANIZER",
    }).populate("target_organizer_id", "full_name username email avatar_url role");

    const organizerUserIds = items.filter((i) => i.target_organizer_id).map((i) => i.target_organizer_id._id);
    const profiles = await OrganizerProfile.find({ user_id: { $in: organizerUserIds } });
    const profileByUserId = {};
    for (const p of profiles) profileByUserId[p.user_id.toString()] = p;

    const organizers = items
      .filter((i) => i.target_organizer_id)
      .map((i) => {
        const u = i.target_organizer_id;
        const prof = profileByUserId[u._id.toString()];
        return {
          id: u._id,
          _id: u._id,
          name: prof?.business_name || u.full_name || u.username,
          username: u.username,
          avatarUrl: prof?.logo_url || u.avatar_url,
          website: prof?.website,
          followedAt: i.created_at,
        };
      });

    res.json({ success: true, organizers, total: organizers.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /v1/user/follow/check/:organizerId
exports.checkFollowing = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const existing = await WishlistFollow.findOne({
      user_id: req.user.id,
      target_organizer_id: organizerId,
      type: "FOLLOW_ORGANIZER",
    });
    res.json({ success: true, isFollowing: !!existing, following: !!existing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
