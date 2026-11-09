const mongoose = require("mongoose");

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Ném 400 nếu id không phải ObjectId hợp lệ */
function validId(id, label = "ID") {
  if (!mongoose.isValidObjectId(id) || String(id).length !== 24) throw httpError(`${label} không hợp lệ`, 400);
  return String(id);
}

/** Bọc controller async: lỗi có statusCode trả đúng mã, lỗi DB/validate trả 4xx, còn lại 500 */
const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors || {}).map((e) => e.message).join("; ") || err.message;
      return res.status(400).json({ success: false, message: msg });
    }
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Dữ liệu bị trùng (đã tồn tại)" });
    if (err.code === 121) {
      console.error("Mongo validator từ chối:", JSON.stringify(err.errInfo?.details || err.message).slice(0, 500));
      return res.status(400).json({ success: false, message: "Dữ liệu không đúng định dạng" });
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
  });

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Số nguyên trong [min, max] hoặc ném 400 */
function intIn(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw httpError(`${label} phải là số nguyên từ ${min} đến ${max}`, 400);
  return n;
}

/** Chuỗi không rỗng, tối đa max ký tự */
function str(v, max, label, { required = true } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw httpError(`Thiếu ${label}`, 400);
    return undefined;
  }
  const s = String(v).trim();
  if (!s && required) throw httpError(`Thiếu ${label}`, 400);
  if (s.length > max) throw httpError(`${label} tối đa ${max} ký tự`, 400);
  return s;
}

function date(v, label) {
  const d = new Date(v);
  if (v === undefined || v === null || isNaN(d)) throw httpError(`${label} không hợp lệ`, 400);
  return d;
}

/** Escape HTML khi chèn dữ liệu người dùng vào mẫu HTML */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = { httpError, validId, ah, isNum, intIn, str, date, esc };
