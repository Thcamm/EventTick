const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ref, options } = require('./_helpers');

const schema = new Schema(
  {
    order_id: ref('Order', { required: true }),
    event_id: ref('Event', { required: true }),
    session_id: ref('EventSession', { required: true }),
    tier_id: ref('TicketTier', { required: true }),
    seat_id: ref('Seat'),
    owner_id: ref('User', { required: true }),
    ticket_code: { type: String, required: true, uppercase: true, trim: true, maxlength: 50 },
    qr_hash_signature: { type: String, required: true, maxlength: 255 },
    status: {
      type: String,
      enum: ['VALID', 'USED', 'LISTED_RESALE', 'RESOLD_INVALID', 'REFUNDED'],
      default: 'VALID',
      required: true,
    },
    checked_in_at: { type: Date },
    checked_in_by: ref('User'),
  },
  options,
);

module.exports = mongoose.model('Ticket', schema, 'tickets');
