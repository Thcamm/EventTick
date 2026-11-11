export const PATHS = {
  HOME: '/',
  EVENT_DETAIL: '/events/:id',
  SEARCH: '/search',
  RESALE: '/resale',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Customer
  MY_TICKETS: '/my-tickets',
  PROFILE: '/profile',
  WISHLIST: '/wishlist',

  // Organizer
  ORGANIZER_DASHBOARD: '/organizer/dashboard',
  ORGANIZER_EVENTS: '/organizer/events',
  ORGANIZER_CREATE_EVENT: '/organizer/events/new',
  ORGANIZER_KYC: '/organizer/kyc',
  ORGANIZER_CONTRACTS: '/organizer/contracts',
  ORGANIZER_PAYOUTS: '/organizer/payouts',

  // Staff
  STAFF_CHECKIN: '/staff/check-in',
  STAFF_STATS: '/staff/stats',

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_USERS: '/admin/users',
  ADMIN_KYC: '/admin/kyc',
  ADMIN_EVENTS: '/admin/events',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_PAYOUTS: '/admin/payouts',
};

export function getRoleHomePath(role) {
  switch (role) {
    case 'ADMIN':
      return PATHS.ADMIN_DASHBOARD;
    case 'ORGANIZER':
      return PATHS.ORGANIZER_DASHBOARD;
    case 'STAFF':
      return PATHS.STAFF_CHECKIN;
    default:
      return PATHS.HOME;
  }
}
