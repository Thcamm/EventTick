const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    organizer_id: ref("User", { required: true }),
    approved_by_admin: ref("User"),
    commission_rate_pct: { type: Number, required: true, min: 0, max: 100 },
    contract_terms_html: { type: String, required: true },
    organizer_signature_url: { type: String },
    signed_pdf_url: { type: String },
    signer_ip: { type: String, maxlength: 45 },
    signed_at: { type: Date },
    status: { type: String, enum: ["WAITING_SIGN", "SIGNED", "REJECTED"], default: "WAITING_SIGN", required: true },
  },
  options,
);

module.exports = mongoose.model("EContract", schema, "e_contracts");
