const mongoose = require("mongoose");
const { Schema } = mongoose;
const { options } = require("./_helpers");

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 100 },
    is_active: { type: Boolean, default: true, required: true },
  },
  options,
);

module.exports = mongoose.model("Category", schema, "categories");
