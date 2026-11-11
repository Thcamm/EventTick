const mongoose = require("mongoose");
const { Schema } = mongoose;
const { options } = require("./_helpers");

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 255 },
    password_hash: { type: String },
    full_name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 20 },
    avatar_url: { type: String },
    role: { type: String, enum: ["CUSTOMER", "ORGANIZER", "STAFF", "ADMIN"], default: "CUSTOMER", required: true },
    // PENDING = chưa xác thực email
    status: { type: String, enum: ["ACTIVE", "BLOCKED", "PENDING"], default: "PENDING", required: true },
    google_id: { type: String, maxlength: 100 },
    auth_provider: { type: String, enum: ["LOCAL", "GOOGLE"], default: "LOCAL" },
    is_organizer_requested: { type: Boolean, default: false },
    organizer_request_at: { type: Date },
    organizer_request_note: { type: String },
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

    // --- Tương thích ngược với bản ghi camelCase cũ trong DB ---
    passwordHash: { type: String },
    fullName: { type: String, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatarUrl: { type: String },
    isActive: { type: Boolean },
    isEmailVerified: { type: Boolean },
  },
  options,
);

// Tự động đồng bộ dữ liệu từ các bản ghi camelCase cũ trước khi validate/save
userSchema.pre("validate", function (next) {
  if (!this.password_hash && this.passwordHash) {
    this.password_hash = this.passwordHash;
  }
  if (!this.full_name) {
    this.full_name =
      this.fullName ||
      [this.last_name || this.lastName, this.first_name || this.firstName].filter(Boolean).join(" ") ||
      this.username ||
      (this.email ? this.email.split("@")[0] : "User");
  }
  if (!this.first_name && this.firstName) {
    this.first_name = this.firstName;
  }
  if (!this.last_name && this.lastName) {
    this.last_name = this.lastName;
  }
  if (!this.avatar_url && this.avatarUrl) {
    this.avatar_url = this.avatarUrl;
  }
  if (this.isActive === false) {
    this.status = "BLOCKED";
  } else if (this.status === "PENDING" && this.isEmailVerified === true) {
    this.status = "ACTIVE";
  }
  next();
});

// Alias tương thích front-end cũ
userSchema.virtual("name").get(function () {
  return this.full_name || this.fullName || this.username;
});

module.exports = mongoose.model("User", userSchema, "users");
