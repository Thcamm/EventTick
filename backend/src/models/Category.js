const mongoose = require("mongoose");
const { Schema } = mongoose;
const { options } = require("./_helpers");

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 100 },
    is_active: { type: Boolean, default: true, required: true },
    default_commission_pct: { type: Number, default: 10, min: 0, max: 50 },
  },
  options,
);

module.exports = mongoose.model("Category", schema, "categories");
