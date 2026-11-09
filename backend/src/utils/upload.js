const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Lưu trữ tạm trong memory buffer để linh hoạt upload lên Cloudinary hoặc lưu local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB/file
});

/**
 * Upload buffer lên Cloudinary bằng upload_stream kèm timeout
 */
function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error("Cloudinary upload vượt quá thời gian chờ (15s timeout)"));
      }
    }, 15000);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ticketerra_events",
        resource_type: "image",
        public_id: path.parse(filename).name + "_" + Date.now(),
      },
      (error, result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (error) {
          console.error("❌ Cloudinary upload stream error:", error.message || error);
          return reject(error);
        }
        resolve(result.secure_url);
      },
    );

    stream.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      console.error("❌ Cloudinary stream network error:", err.message || err);
      reject(err);
    });

    stream.end(buffer);
  });
}

/**
 * Xử lý lưu ảnh:
 * - Nếu có cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET):
 *   -> Upload trực tiếp lên Cloudinary CDN và trả về secure_url (https://res.cloudinary.com/...).
 * - Nếu chưa cấu hình Cloudinary hoặc upload Cloudinary gặp lỗi:
 *   -> Fallback lưu vào thư mục local /uploads và trả về URL tĩnh localhost.
 */
async function saveUploadedFile(req, file) {
  if (!file) return undefined;

  const sizeKb = (file.buffer.length / 1024).toFixed(1);
  if (isCloudinaryConfigured()) {
    try {
      console.log(`☁️ Đang upload ảnh "${file.originalname}" (${sizeKb} KB) lên Cloudinary...`);
      const secureUrl = await uploadToCloudinary(file.buffer, file.originalname);
      console.log(`✅ Upload Cloudinary thành công: ${secureUrl}`);
      return secureUrl;
    } catch (err) {
      console.warn(`⚠️ Upload Cloudinary thất bại (${err.message || err}), tự động fallback sang lưu local disk`);
    }
  }

  // Fallback lưu file local nếu chưa điền key Cloudinary hoặc Cloudinary lỗi
  const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
  const filePath = path.join(UPLOADS_DIR, uniqueName);
  await fs.promises.writeFile(filePath, file.buffer);
  const localUrl = `${req.protocol}://${req.get("host")}/uploads/${uniqueName}`;
  console.log(`💾 Đã lưu ảnh local: ${localUrl}`);
  return localUrl;
}

module.exports = upload;
module.exports.saveUploadedFile = saveUploadedFile;
