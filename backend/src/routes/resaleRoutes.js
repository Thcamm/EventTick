const router = require('express').Router();
const ctrl = require('../controllers/resaleController');
const { requireAuth } = require('../middleware/auth');

// Công khai: Chợ vé bán lại (danh sách sự kiện -> chi tiết sự kiện)
router.get('/events', ctrl.getResaleEvents);
router.get('/events/:eventId', ctrl.getEventListings);
router.get('/events/:eventId/listings', ctrl.getEventListings);

// Người bán
router.post('/listings', requireAuth, ctrl.createListing);
router.delete('/listings/:id', requireAuth, ctrl.cancelListing);
router.get('/my-listings', requireAuth, ctrl.getMyListings);

// Người mua: giữ chỗ -> thanh toán qua /payment/:orderId (giống mua vé thường)
router.post('/orders', requireAuth, ctrl.createResaleOrder);
router.post('/listings/:id/buy', requireAuth, ctrl.buyListing);

module.exports = router;
