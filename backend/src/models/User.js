const mongoose = require("mongoose");
const { Schema } = mongoose;
const { options } = require("./_helpers");

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 255 },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 20 },
    avatar_url: { type: String },
    role: { type: String, enum: ["CUSTOMER", "ORGANIZER", "STAFF", "ADMIN"], default: "CUSTOMER", required: true },
    // PENDING = chưa xác thực email
    status: { type: String, enum: ["ACTIVE", "BLOCKED", "PENDING"], default: "PENDING", required: true },
    google_id: { type: String, maxlength: 100 },
    default_vat_info: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now, required: true },

    // --- Trường mở rộng (ngoài đặc tả, phục vụ luồng auth hiện có) ---
    username: { type: String, trim: true },
    first_name: { type: String, trim: true },
    last_name: { type: String, trim: true },
    gender: { type: String },
    dob: { type: Date },
    email_verification_token: { type: String },
    email_verification_expires: { type: Date },
    password_reset_token: { type: String },
    password_reset_expires: { type: Date },
  },
  options,
);

// Alias tương thích front-end cũ
userSchema.virtual("name").get(function () {
  return this.full_name;
});

module.exports = mongoose.model("User", userSchema, "users");
