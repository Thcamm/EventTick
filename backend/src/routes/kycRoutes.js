const express = require("express");
const ctrl = require("../controllers/kycController");
const upload = require("../utils/upload");
const { requireAuth, requireRole } = require("../middleware/auth");

// /v1/organizer/kyc  — Nhà tổ chức gửi / xem hồ sơ của mình (UC21)
const organizer = express.Router();
organizer.post("/", requireAuth, upload.single("document"), ctrl.submit);
organizer.get("/", requireAuth, ctrl.mine);
organizer.get("/document", requireAuth, ctrl.myDocument);

// /v1/admin/kyc  — Admin duyệt hồ sơ (UC38)
const admin = express.Router();
admin.use(requireRole("ADMIN"));
admin.get("/", ctrl.list);
admin.get("/:id", ctrl.detail);
admin.get("/:id/document", ctrl.document);
admin.put("/:id/approve", ctrl.approve);
admin.put("/:id/reject", ctrl.reject);

module.exports = { organizer, admin };
