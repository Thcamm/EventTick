const { Schema } = require("mongoose");

/** Tham chiếu ObjectId (FK trong đặc tả). */
const ref = (model, extra = {}) => ({ type: Schema.Types.ObjectId, ref: model, ...extra });

/**
 * Index được quản lý tập trung ở src/db/initDatabase.js (cùng validator),
 * nên tắt autoIndex + versionKey để document khớp đúng đặc tả.
 */
const options = {
  versionKey: false,
  autoIndex: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
};

module.exports = { ref, options };
