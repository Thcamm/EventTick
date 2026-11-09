const fs = require("fs");
const path = require("path");
const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

/**
 * Lưu tài liệu NHẠY CẢM (giấy tờ KYC, chữ ký, PDF hợp đồng, giấy phép biểu diễn).
 * Khác ảnh sự kiện: KHÔNG có URL công khai.
 *  - Có Cloudinary: upload với type "authenticated" -> chỉ tải được qua URL có chữ ký, hết hạn.
 *  - Chưa cấu hình Cloudinary: lưu vào backend/private-uploads (không được serve tĩnh).
 *
 * Giá trị lưu vào DB (các cột *_url) là một "ref" dạng chuỗi:
 *   private:cloudinary:<resource_type>:<format|->:<public_id>
 *   private:local:<tên file>
 * Chỉ các endpoint có kiểm tra quyền mới đổi ref thành link tải (xem sendPrivate).
 */
const LOCAL_DIR = path.join(__dirname, "../../private-uploads");
const REF_PREFIX = "private:";

const safeName = (name) => path.parse(name || "file").name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "file";

const isPrivateRef = (v) => typeof v === "string" && v.startsWith(REF_PREFIX);

async function savePrivate(buffer, { filename, folder = "eventtick_private", resourceType = "image" }) {
  const base = `${safeName(filename)}_${Date.now()}`;
  const ext = path.extname(filename || "").toLowerCase().replace(/[^.a-z0-9]/g, "");

  if (isCloudinaryConfigured()) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          type: "authenticated",
          resource_type: resourceType,
          // raw giữ nguyên đuôi trong public_id; image thì Cloudinary tự thêm format
          public_id: resourceType === "raw" ? base + ext : base,
        },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
      stream.end(buffer);
    });
    return `${REF_PREFIX}cloudinary:${resourceType}:${result.format || "-"}:${result.public_id}`;
  }

  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const file = base + (ext || "");
  await fs.promises.writeFile(path.join(LOCAL_DIR, file), buffer);
  return `${REF_PREFIX}local:${file}`;
}

function parseRef(ref) {
  if (!isPrivateRef(ref)) return null;
  const parts = ref.split(":");
  if (parts[1] === "cloudinary") {
    return { provider: "cloudinary", resourceType: parts[2], format: parts[3] === "-" ? "" : parts[3], publicId: parts.slice(4).join(":") };
  }
  if (parts[1] === "local") return { provider: "local", file: path.basename(parts.slice(2).join(":")) };
  return null;
}

/** Link tải có chữ ký, hết hạn sau expiresInSec (chỉ Cloudinary). Local: null. */
function signedUrl(ref, expiresInSec = 300) {
  const p = parseRef(ref);
  if (!p || p.provider !== "cloudinary") return null;
  return cloudinary.utils.private_download_url(p.publicId, p.format, {
    resource_type: p.resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
}

/**
 * Trả tài liệu riêng tư cho người ĐÃ được kiểm tra quyền:
 *  - Cloudinary: JSON { url } (link hết hạn 5 phút)
 *  - Local: stream file
 */
function sendPrivate(res, ref) {
  const p = parseRef(ref);
  if (!p) return res.status(404).json({ success: false, message: "Không có tài liệu" });
  if (p.provider === "cloudinary") {
    return res.json({ success: true, url: signedUrl(ref), expiresInSeconds: 300 });
  }
  const full = path.join(LOCAL_DIR, p.file);
  if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: "Không tìm thấy tệp" });
  return res.sendFile(full);
}

/** Xóa tài liệu (dùng khi dọn dữ liệu test) */
async function deletePrivate(ref) {
  const p = parseRef(ref);
  if (!p) return;
  if (p.provider === "cloudinary") {
    await cloudinary.uploader.destroy(p.publicId, { resource_type: p.resourceType, type: "authenticated", invalidate: true });
  } else {
    await fs.promises.rm(path.join(LOCAL_DIR, p.file), { force: true });
  }
}

module.exports = { savePrivate, signedUrl, sendPrivate, deletePrivate, isPrivateRef, parseRef };
