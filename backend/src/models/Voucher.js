const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 50 },
    discount_type: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discount_value: { type: Number, required: true, min: 0 },
    max_discount_amount: { type: Number },
    min_order_amount: { type: Number, default: 0, min: 0 },
    usage_limit: { type: Number, required: true, min: 0 },
    used_count: { type: Number, default: 0, min: 0 },
    max_per_user: { type: Number, default: 1, min: 1 },
    valid_from: { type: Date, required: true },
    valid_until: { type: Date, required: true },
    is_active: { type: Boolean, default: true, required: true },
  },
  options,
);

module.exports = mongoose.model("Voucher", schema, "vouchers");
