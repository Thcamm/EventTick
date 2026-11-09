const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    user_id: ref("User", { required: true }),
    ticket_id: ref("Ticket", { required: true }),
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    organizer_reply: { type: String },
    created_at: { type: Date, default: Date.now, required: true },
  },
  options,
);

module.exports = mongoose.model("Review", schema, "reviews");
