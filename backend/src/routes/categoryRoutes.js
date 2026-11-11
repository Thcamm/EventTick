const express = require("express");
const router = express.Router();
const { Category } = require("../models");
const { ah, httpError } = require("../utils/http");

// GET /v1/categories
router.get(
  "/",
  ah(async (req, res) => {
    const categories = await Category.find({ is_active: true }).sort({ name: 1 });
    res.json({ success: true, categories });
  }),
);

// GET /v1/categories/:slug
router.get(
  "/:slug",
  ah(async (req, res) => {
    const category = await Category.findOne({ slug: req.params.slug, is_active: true });
    if (!category) throw httpError("Không tìm thấy danh mục", 404);
    res.json({ success: true, category });
  }),
);

module.exports = router;
