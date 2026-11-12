/**
 * Ghi một mốc vào lịch sử trạng thái của sự kiện (hiện ở tab "Lịch sử" của Organizer).
 * Không ném lỗi: ghi lịch sử không được làm hỏng việc chuyển trạng thái đã thành công.
 */
async function logEventStatus(eventId, status, { by, note } = {}) {
  try {
    const { Event } = require("../models");
    await Event.updateOne(
      { _id: eventId },
      { $push: { status_history: { status, at: new Date(), ...(by ? { by } : {}), ...(note ? { note: String(note).slice(0, 1000) } : {}) } } },
    );
  } catch (err) {
    console.error("⚠️ [EventHistory] không ghi được lịch sử:", err.message);
  }
}

module.exports = { logEventStatus };
