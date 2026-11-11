const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");

// ponytail: reload .env on demand so nodemon doesn't need manual restart when .env changes
const reloadEnv = () => dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

/**
 * SePay: thanh toán chuyển khoản ngân hàng, xác nhận qua webhook.
 * Nội dung chuyển khoản = <PREFIX><mã đơn không dấu gạch>, ví dụ DHORD20261108AB12CD.
 * SePay tách mã này vào trường `code` của webhook (theo "Cấu trúc mã thanh toán" đã cấu hình).
 */
const getPrefix = () => (process.env.SEPAY_PAYMENT_PREFIX || "DH").toUpperCase();

/**
 * ORD-20261108-AB12CD -> "DH20261108 ORD20261108AB12CD"
 * ponytail: Đặt mã số thuần `<PREFIX>YYYYMMDD` ở đầu để khớp cấu hình mặc định của SePay
 * (Hậu tố chỉ gồm số, 1–10 ký tự -> SePay không bỏ qua webhook), kèm mã đầy đủ để định danh đơn.
 */
function paymentContent(orderCode) {
  const clean = String(orderCode).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const digits = clean.replace(/\D/g, "").slice(0, 8);
  const p = getPrefix();
  return digits ? `${p}${digits} ${clean}` : `${p}${clean}`;
}

/** Tìm mã đơn trong nội dung chuyển khoản; trả về dạng ORD-YYYYMMDD-XXXXXX hoặc null */
function extractOrderCode(text) {
  if (!text) return null;
  reloadEnv();
  const p = getPrefix();
  const flat = String(text).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m =
    flat.match(new RegExp(`(?:${p}ORD|ORD)(\\d{8})([A-F0-9]{6})`)) ||
    flat.match(new RegExp(`${p}(\\d{8})([A-F0-9]{6})`));
  return m ? `ORD-${m[1]}-${m[2]}` : null;
}

function qrUrl({ amount, orderCode }) {
  reloadEnv();
  const acc = process.env.SEPAY_BANK_ACCOUNT;
  const bank = process.env.SEPAY_BANK_NAME;
  if (!acc || !bank) return null;
  const q = new URLSearchParams({ acc, bank, amount: String(amount), des: paymentContent(orderCode) });
  return `https://qr.sepay.vn/img?${q.toString()}`;
}

/** Header SePay gửi: `Authorization: Apikey <key>`. So sánh thời gian cố định. */
function verifyApiKey(header) {
  reloadEnv();
  const expected = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!expected) return false; // chưa cấu hình thì từ chối hết, tránh mở cửa
  const m = /^Apikey\s+(.+)$/i.exec(header || "");
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bankInfo() {
  reloadEnv();
  return {
    bank: process.env.SEPAY_BANK_NAME || null,
    account: process.env.SEPAY_BANK_ACCOUNT || null,
  };
}

module.exports = { paymentContent, extractOrderCode, qrUrl, verifyApiKey, bankInfo, get PREFIX() { return getPrefix(); } };
