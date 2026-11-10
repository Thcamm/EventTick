const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    user_id: ref("User", { required: true }),
    organization_name: { type: String, required: true, maxlength: 255 },
    business_type: { type: String, enum: ["INDIVIDUAL", "ENTERPRISE"], required: true },
    tax_code: { type: String, required: true, maxlength: 50 },
    id_card_or_license_url: { type: String, required: true },
    bank_name: { type: String, required: true, maxlength: 100 },
    bank_account_no: { type: String, required: true, maxlength: 50 },
    bank_account_holder: { type: String, required: true, maxlength: 150 },
    kyc_status: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING", required: true },
    verified_by: ref("User"),
    verified_at: { type: Date },
    rejection_reason: { type: String },
    submitted_at: { type: Date, default: Date.now },
  },
  options,
);

module.exports = mongoose.model("OrganizerProfile", schema, "organizer_profiles");
