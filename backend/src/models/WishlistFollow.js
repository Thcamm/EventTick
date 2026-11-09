const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    user_id: ref("User", { required: true }),
    target_event_id: ref("Event"),
    target_organizer_id: ref("User"),
    type: { type: String, enum: ["WISHLIST_EVENT", "FOLLOW_ORGANIZER"], required: true },
  },
  options,
);

module.exports = mongoose.model("WishlistFollow", schema, "wishlists_follows");
