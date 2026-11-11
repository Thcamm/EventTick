const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    actor_id: ref("User"),
    action: { type: String, required: true, maxlength: 100 },
    target_entity: { type: String, required: true, maxlength: 100 },
    target_id: { type: String, required: true, maxlength: 100 },
    metadata: { type: Schema.Types.Mixed },
    ip_address: { type: String, maxlength: 45 },
    created_at: { type: Date, default: Date.now, required: true },
  },
  options,
);

module.exports = mongoose.model("AuditLog", schema, "audit_logs");
