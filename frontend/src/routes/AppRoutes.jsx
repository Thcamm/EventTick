import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import KycLayout from './KycLayout';
import { PATHS } from './paths';

// Public pages
import HomePage from '../pages/public/HomePage';
import EventDetailPage from '../pages/public/EventDetailPage';
import ResaleMarketPage from '../pages/public/ResaleMarketPage';
import SearchResultsPage from '../pages/public/SearchResultsPage';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import GoogleSuccessPage from '../pages/auth/GoogleSuccessPage';

// Payment pages
import CheckoutInfoPage from '../pages/payment/CheckoutInfoPage';
import PaymentPage from '../pages/payment/PaymentPage';
import PaymentDonePage from '../pages/payment/PaymentDonePage';

// Customer pages
import MyTicketsPage from '../pages/customer/MyTicketsPage';
import ProfilePage from '../pages/customer/ProfilePage';

// Role dashboards
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminResalePayoutPage from '../pages/admin/AdminResalePayoutPage';
import AdminKycPage from '../pages/admin/AdminKycPage';
import AdminEventsPage from '../pages/admin/AdminEventsPage';
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage';
import AdminPayoutsPage from '../pages/admin/AdminPayoutsPage';
import OrganizerDashboardPage from '../pages/organizer/OrganizerDashboardPage';
import OrganizerKycPage from '../pages/organizer/OrganizerKycPage';
import OrganizerContractsPage from '../pages/organizer/OrganizerContractsPage';
import OrganizerEventsPage from '../pages/organizer/OrganizerEventsPage';
import OrganizerPayoutsPage from '../pages/organizer/OrganizerPayoutsPage';
import CreateEventPage from '../pages/organizer/CreateEventPage';
import OrganizerEventDashboardPage from '../pages/organizer/OrganizerEventDashboardPage';
import OrganizerVouchersPage from '../pages/organizer/OrganizerVouchersPage';
import StaffCheckInPage from '../pages/staff/StaffCheckInPage';
import StaffTrafficPage from '../pages/staff/StaffTrafficPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes wrapped in MainLayout */}
      <Route element={<MainLayout />}>
        <Route path={PATHS.HOME} element={<HomePage />} />
        <Route path={PATHS.EVENT_DETAIL} element={<EventDetailPage />} />
        <Route path={PATHS.SEARCH} element={<SearchResultsPage />} />
        <Route path={PATHS.RESALE} element={<ResaleMarketPage />} />
        <Route path={PATHS.RESALE_EVENT} element={<ResaleMarketPage />} />

        {/* Customer Protected routes under MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path={PATHS.CHECKOUT} element={<CheckoutInfoPage />} />
          <Route path={PATHS.PAYMENT} element={<PaymentPage />} />
          <Route path={PATHS.PAYMENT_DONE} element={<PaymentDonePage />} />
          <Route path={PATHS.MY_TICKETS} element={<MyTicketsPage />} />
          <Route path={PATHS.PROFILE} element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Guest only routes (Redirect if already logged in) */}
      <Route element={<GuestRoute />}>
        <Route path={PATHS.LOGIN} element={<LoginPage />} />
        <Route path={PATHS.REGISTER} element={<LoginPage mode='register' />} />
      </Route>

      {/* Google OAuth callback */}
      <Route path='/auth/google/success' element={<GoogleSuccessPage />} />

      {/* KYC: khách thường nộp hồ sơ để trở thành nhà tổ chức */}
      <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'ORGANIZER', 'ADMIN']} />}>
        <Route element={<KycLayout />}>
          <Route path={PATHS.ORGANIZER_KYC} element={<OrganizerKycPage />} />
        </Route>
      </Route>

      {/* ADMIN Portal */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path={PATHS.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_USERS} element={<AdminUsersPage />} />
          <Route path={PATHS.ADMIN_KYC} element={<AdminKycPage />} />
          <Route path='/admin/organizer-requests' element={<AdminKycPage />} />
          <Route path={PATHS.ADMIN_EVENTS} element={<AdminEventsPage />} />
          <Route path='/admin/events/pending' element={<AdminEventsPage />} />
          <Route path={PATHS.ADMIN_CATEGORIES} element={<AdminCategoriesPage />} />
          <Route path={PATHS.ADMIN_PAYOUTS} element={<AdminPayoutsPage />} />
          <Route path={PATHS.ADMIN_RESALE_PAYOUTS} element={<AdminResalePayoutPage />} />
        </Route>
      </Route>

      {/* ORGANIZER Portal */}
      <Route element={<ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path={PATHS.ORGANIZER_DASHBOARD} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_EVENTS} element={<OrganizerEventsPage />} />
          <Route path={PATHS.ORGANIZER_CREATE_EVENT} element={<CreateEventPage />} />
          <Route path={PATHS.ORGANIZER_EVENT_EDIT} element={<CreateEventPage />} />
          <Route path={PATHS.ORGANIZER_EVENT_DETAIL} element={<OrganizerEventDashboardPage />} />
          <Route path={PATHS.ORGANIZER_CONTRACTS} element={<OrganizerContractsPage />} />
          <Route path={PATHS.ORGANIZER_PAYOUTS} element={<OrganizerPayoutsPage />} />
          <Route path={PATHS.ORGANIZER_EVENT_VOUCHERS} element={<OrganizerVouchersPage />} />
        </Route>
      </Route>

      {/* STAFF Portal */}
      <Route element={<ProtectedRoute allowedRoles={['STAFF', 'ORGANIZER', 'ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path={PATHS.STAFF_CHECKIN} element={<StaffCheckInPage />} />
          <Route path={PATHS.STAFF_STATS} element={<StaffTrafficPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path='*' element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  );
}
