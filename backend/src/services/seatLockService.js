const { redis, HOLD_SECONDS } = require("../config/redis");

const key = (sessionId, seatId) => `seatlock:${sessionId}:${seatId}`;

// Khóa TẤT CẢ ghế hoặc không khóa ghế nào (nguyên tử): chống 2 người cùng giữ 1 ghế
const LOCK_ALL = `
for _, k in ipairs(KEYS) do
  if redis.call('EXISTS', k) == 1 then return 0 end
end
for _, k in ipairs(KEYS) do
  redis.call('SET', k, ARGV[1], 'EX', ARGV[2])
end
return 1`;

// Chỉ xóa khóa nếu vẫn thuộc về đơn hàng này (tránh xóa nhầm khóa của người khác)
const UNLOCK_OWNED = `
local n = 0
for _, k in ipairs(KEYS) do
  if redis.call('GET', k) == ARGV[1] then n = n + redis.call('DEL', k) end
end
return n`;

function unavailable() {
  const err = new Error("Dịch vụ giữ chỗ (Redis) đang không khả dụng, vui lòng thử lại sau");
  err.statusCode = 503;
  return err;
}

/** @returns {Promise<boolean>} true nếu khóa được toàn bộ ghế */
async function lockSeats(sessionId, seatIds, ownerToken) {
  try {
    const keys = seatIds.map((id) => key(sessionId, id));
    const ok = await redis.eval(LOCK_ALL, keys.length, ...keys, String(ownerToken), HOLD_SECONDS);
    return ok === 1;
  } catch (e) {
    throw unavailable();
  }
}

/** Nhả khóa (không ném lỗi: Mongo vẫn là nguồn sự thật, khóa Redis tự hết hạn sau TTL) */
async function unlockSeats(sessionId, seatIds, ownerToken) {
  if (!seatIds?.length) return 0;
  try {
    const keys = seatIds.map((id) => key(sessionId, id));
    return await redis.eval(UNLOCK_OWNED, keys.length, ...keys, String(ownerToken));
  } catch (e) {
    console.error("Redis unlock lỗi:", e.message);
    return 0;
  }
}

/** Trả về Set các seatId đang bị khóa trong Redis của 1 suất diễn */
async function getLockedSeatIds(sessionId, seatIds) {
  const locked = new Set();
  if (!seatIds.length) return locked;
  try {
    const values = await redis.mget(seatIds.map((id) => key(sessionId, id)));
    values.forEach((v, i) => v && locked.add(String(seatIds[i])));
  } catch (e) {
    // Redis lỗi: dùng trạng thái Mongo
  }
  return locked;
}

module.exports = { lockSeats, unlockSeats, getLockedSeatIds, HOLD_SECONDS };
