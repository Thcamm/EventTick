const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    organizer_id: ref("User", { required: true }),
    contract_id: ref("EContract", { required: true }),
    gross_revenue: { type: Number, required: true, min: 0 },
    total_refunded: { type: Number, default: 0, min: 0 },
    platform_commission_amt: { type: Number, required: true, min: 0 },
    net_payout_amount: { type: Number, required: true },
    bank_transfer_receipt_url: { type: String },
    status: { type: String, enum: ["REQUESTED", "APPROVED", "SETTLED"], default: "REQUESTED", required: true },
    settled_by_admin: ref("User"),
    settled_at: { type: Date },
  },
  options,
);

module.exports = mongoose.model("PayoutSettlement", schema, "payout_settlements");
