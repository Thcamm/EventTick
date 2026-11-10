export const PATHS = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Events
  EVENT_DETAILS: "/event/:eventId",
  EVENT_SEATS: "/event/seats/:eventId",
  SEARCH: "/search",
  RESALE_MARKET: "/resale",
  RESALE_EVENT: "/resale/:eventId",
  RESALE_BUNDLE: "/resale/:eventId/:bundleCode",

  // User
  USER_TICKETS: "/user/tickets",
  USER_TICKETS_TEST: "/user/tickets/test",
  USER_ACCOUNT: "/user/my-account",

  // Organizer
  ORGANIZER_KYC: "/organizer/kyc",
  ORGANIZER_CONTRACTS: "/organizer/contracts",
  ORGANIZER_EVENT_VOUCHERS: "/organizer/events/:eventId/vouchers",
  ORGANIZER_EVENT_DASHBOARD: "/organizer/events/:eventId/dashboard",

  // Staff (Online Check-in 100%)
  STAFF_CHECK_IN: "/staff/check-in",
  STAFF_TRAFFIC: "/staff/traffic",

  // Admin / Organizer
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_CREATE_EVENT: "/admin/events",
  ADMIN_CREATE_EVENT_TEST: "/admin/events/test",
  ADMIN_MY_EVENTS: "/admin/my-event",
  ADMIN_SEATMAP: "/admin/seatmap",
  ADMIN_KYC: "/admin/kyc",
  ADMIN_EVENTS_APPROVAL: "/admin/events-approval",
  ADMIN_CATEGORIES: "/admin/categories",
  ADMIN_USERS: "/admin/users",
  ADMIN_SETTLEMENTS: "/admin/settlements",
  ADMIN_REFUNDS: "/admin/refunds",
  ADMIN_RESALE_PAYOUTS: "/admin/resale-payouts",

  // Payment
  PAYMENT: "/payment/:orderId",
  PAYMENT_RESULT: "/payment-result/:orderId",
  PAYMENT_DONE: "/payment-done",
  PAYMENT_FAIL: "/payment-fail",
  PAYMENT_ERROR: "/payment-err",
};

export default PATHS;
