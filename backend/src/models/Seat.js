const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    session_id: ref("EventSession", { required: true }),
    tier_id: ref("TicketTier", { required: true }),
    section_name: { type: String, required: true, maxlength: 100 },
    row_label: { type: String, required: true, maxlength: 20 },
    seat_number: { type: String, required: true, maxlength: 20 },
    coord_x: { type: Number },
    coord_y: { type: Number },
    status: { type: String, enum: ["AVAILABLE", "LOCKED", "SOLD"], default: "AVAILABLE", required: true },
    locked_by_user_id: ref("User"),
    lock_expires_at: { type: Date },
  },
  options,
);

module.exports = mongoose.model("Seat", schema, "seats");
