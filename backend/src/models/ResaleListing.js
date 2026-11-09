const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    ticket_id: ref("Ticket", { required: true }),
    seller_id: ref("User", { required: true }),
    buyer_order_id: ref("Order"),
    original_price: { type: Number, required: true, min: 0 },
    resale_price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["ACTIVE", "SOLD", "CANCELLED"], default: "ACTIVE", required: true },
    created_at: { type: Date, default: Date.now, required: true },
  },
  options,
);

module.exports = mongoose.model("ResaleListing", schema, "resale_listings");
