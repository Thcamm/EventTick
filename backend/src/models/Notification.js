const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

/** Thông báo trong ứng dụng (chuông ở Dashboard). Mỗi thông báo thuộc về đúng một người nhận. */
const schema = new Schema(
  {
    user_id: ref("User", { required: true }),
    type: { type: String, required: true, maxlength: 50 },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: "", maxlength: 1000 },
    link: { type: String, maxlength: 300 }, // đường dẫn trong ứng dụng, vd /organizer/contracts
    read_at: { type: Date },
    created_at: { type: Date, default: Date.now },
  },
  options,
);

module.exports = mongoose.model("Notification", schema, "notifications");
