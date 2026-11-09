const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    order_id: ref("Order", { required: true }),
    ticket_id: ref("Ticket"),
    user_id: ref("User", { required: true }),
    refund_type: { type: String, enum: ["USER_CANCEL", "EVENT_BULK_REFUND"], required: true },
    refund_amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: { type: String, enum: ["PROCESSING", "COMPLETED", "REJECTED"], default: "PROCESSING", required: true },
    processed_at: { type: Date },
  },
  options,
);

module.exports = mongoose.model("RefundRequest", schema, "refund_requests");
