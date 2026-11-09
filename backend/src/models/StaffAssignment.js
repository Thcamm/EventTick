const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    staff_user_id: ref("User", { required: true }),
    organizer_id: ref("User", { required: true }),
    event_id: ref("Event", { required: true }),
    assigned_gate: { type: String, maxlength: 100 },
    is_active: { type: Boolean, default: true, required: true },
  },
  options,
);

module.exports = mongoose.model("StaffAssignment", schema, "staff_assignments");
