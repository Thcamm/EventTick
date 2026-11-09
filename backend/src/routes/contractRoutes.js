const express = require("express");
const ctrl = require("../controllers/contractController");
const { requireAuth, requireRole } = require("../middleware/auth");

// /v1/organizer/contracts — Nhà tổ chức xem / ký hợp đồng (UC27)
const organizer = express.Router();
organizer.use(requireAuth, requireRole("ORGANIZER"));
organizer.get("/", ctrl.myContracts);
organizer.get("/:id", ctrl.myContractDetail);
organizer.get("/:id/pdf", ctrl.myContractPdf);
organizer.post("/:id/sign", ctrl.sign);
organizer.put("/:id/reject", ctrl.rejectContract);

// /v1/admin — Admin duyệt sự kiện, đặt hoa hồng (UC39, UC41)
const admin = express.Router();
admin.use(requireRole("ADMIN"));
admin.get("/events", ctrl.adminListEvents);
admin.get("/events/:id/legal-doc", ctrl.adminLegalDoc);
admin.put("/events/:id/approve", ctrl.approveEvent);
admin.put("/events/:id/reject", ctrl.rejectEvent);
admin.get("/contracts", ctrl.adminListContracts);
admin.put("/contracts/:id/commission", ctrl.updateCommission);
admin.get("/contracts/:id/pdf", ctrl.adminContractPdf);

module.exports = { organizer, admin };
