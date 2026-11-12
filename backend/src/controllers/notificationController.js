const { Notification } = require("../models");
const { httpError, validId, ah } = require("../utils/http");

const toClient = (n) => ({ id: n._id, type: n.type, title: n.title, body: n.body, link: n.link, read: Boolean(n.read_at), createdAt: n.created_at });

// GET /v1/user/notifications?limit=20&unread=true
exports.list = ah(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const filter = { user_id: req.user.id };
  if (String(req.query.unread) === "true") filter.read_at = { $exists: false };
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).limit(limit),
    Notification.countDocuments({ user_id: req.user.id, read_at: { $exists: false } }),
  ]);
  res.json({ success: true, unreadCount, items: items.map(toClient) });
});

// PUT /v1/user/notifications/read-all
exports.readAll = ah(async (req, res) => {
  const r = await Notification.updateMany({ user_id: req.user.id, read_at: { $exists: false } }, { read_at: new Date() });
  res.json({ success: true, updated: r.modifiedCount || 0 });
});

// PUT /v1/user/notifications/:id/read  (chỉ đánh dấu được thông báo của chính mình)
exports.read = ah(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: validId(req.params.id, "ID thông báo"), user_id: req.user.id }, { read_at: new Date() }, { new: true });
  if (!n) throw httpError("Không tìm thấy thông báo", 404);
  res.json({ success: true, notification: toClient(n) });
});
