const Redis = require("ioredis");

/**
 * Redis dùng cho khóa ghế / giữ chỗ tạm thời (TTL mặc định 600s = 10 phút).
 * Server vẫn khởi động được khi Redis tắt; chỉ các thao tác cần Redis (đặt ghế) mới trả 503.
 */
const url = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

let warned = false;
redis.on("ready", () => {
  warned = false;
  console.log("✅ Đã kết nối Redis:", url);
});
redis.on("error", (err) => {
  if (!warned) {
    console.error("❌ Lỗi Redis:", err.message, "-> đặt ghế sẽ không hoạt động cho tới khi Redis chạy lại.");
    warned = true;
  }
});

const HOLD_SECONDS = Number(process.env.SEAT_LOCK_TTL_SECONDS) || 600;

module.exports = { redis, HOLD_SECONDS };
