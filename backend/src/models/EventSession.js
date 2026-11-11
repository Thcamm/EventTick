const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

// Suất diễn: events (1) -> (N) event_sessions (1) -> (N) ticket_tiers & seats
const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    name: { type: String, required: true, trim: true, maxlength: 255 },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    status: { type: String, enum: ["SCHEDULED", "CANCELLED", "ENDED"], default: "SCHEDULED", required: true },
    // Khung vẽ sơ đồ: { width, height, background_url, decorations: [{ label, shape, fill }] }
    seat_map: { type: Schema.Types.Mixed },
  },
  options,
);

schema.pre("validate", function (next) {
  if (this.start_time && this.end_time && this.end_time <= this.start_time) {
    return next(new Error("end_time phải sau start_time"));
  }
  next();
});

module.exports = mongoose.model("EventSession", schema, "event_sessions");
