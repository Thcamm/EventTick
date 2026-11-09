const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    order_id: ref("Order", { required: true }), // 1-1 với orders
    gateway: { type: String, enum: ["VNPAY", "VIETQR", "MOMO", "STRIPE"], required: true },
    transaction_ref: { type: String, required: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["INITIATED", "SUCCESS", "FAILED", "REFUNDED"], default: "INITIATED", required: true },
    webhook_payload: { type: Schema.Types.Mixed },
    paid_at: { type: Date },
  },
  options,
);

module.exports = mongoose.model("Payment", schema, "payments");
