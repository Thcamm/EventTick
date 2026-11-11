const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    session_id: ref("EventSession", { required: true }),
    name: { type: String, required: true, trim: true, maxlength: 150 },
    price: { type: Number, required: true, min: 0 },
    total_quantity: { type: Number, required: true, min: 0 },
    available_quantity: { type: Number, required: true, min: 0 },
    min_per_order: { type: Number, default: 1, min: 1 },
    max_per_order: { type: Number, default: 4, min: 1 },
    sale_start_time: { type: Date, required: true },
    sale_end_time: { type: Date, required: true },
    zone_color: { type: String, maxlength: 20 },
    description: { type: String }, // mở rộng: mô tả hiển thị trên UI
    // Sơ đồ khu vực: GA = bán theo số lượng; SEATED = bán theo ghế đánh số (bảng seats)
    zone_type: { type: String, enum: ["GA", "SEATED"], default: "GA" },
  },
  options,
);

module.exports = mongoose.model("TicketTier", schema, "ticket_tiers");
