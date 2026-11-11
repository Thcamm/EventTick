import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import { PATHS } from './paths';

// Public pages
import HomePage from '../pages/public/HomePage';
import EventDetailPage from '../pages/public/EventDetailPage';
import ResaleMarketPage from '../pages/public/ResaleMarketPage';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Customer pages
import MyTicketsPage from '../pages/customer/MyTicketsPage';
import ProfilePage from '../pages/customer/ProfilePage';

// Role dashboards
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminResalePayoutPage from '../pages/admin/AdminResalePayoutPage';
import OrganizerDashboardPage from '../pages/organizer/OrganizerDashboardPage';
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
        <Route path={PATHS.RESALE} element={<ResaleMarketPage />} />
        <Route path={PATHS.RESALE_EVENT} element={<ResaleMarketPage />} />

        {/* Customer Protected routes under MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path={PATHS.MY_TICKETS} element={<MyTicketsPage />} />
          <Route path={PATHS.PROFILE} element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Guest only routes (Redirect if already logged in) */}
      <Route element={<GuestRoute />}>
        <Route path={PATHS.LOGIN} element={<LoginPage />} />
        <Route path={PATHS.REGISTER} element={<RegisterPage />} />
        <Route path={PATHS.VERIFY_EMAIL} element={<VerifyEmailPage />} />
        <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={PATHS.RESET_PASSWORD} element={<ResetPasswordPage />} />
      </Route>

      {/* ADMIN Portal */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path={PATHS.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_USERS} element={<AdminUsersPage />} />
          <Route path={PATHS.ADMIN_KYC} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_EVENTS} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_CATEGORIES} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_PAYOUTS} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_RESALE_PAYOUTS} element={<AdminResalePayoutPage />} />
        </Route>
      </Route>

      {/* ORGANIZER Portal */}
      <Route element={<ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']} />}>
        <Route element={<DashboardLayout />}>
          <Route path={PATHS.ORGANIZER_DASHBOARD} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_EVENTS} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_CREATE_EVENT} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_KYC} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_CONTRACTS} element={<OrganizerDashboardPage />} />
          <Route path={PATHS.ORGANIZER_PAYOUTS} element={<OrganizerDashboardPage />} />
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
