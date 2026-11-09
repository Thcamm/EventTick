import React from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import { PATHS } from "./paths";

// Pages
import HomePage from "@/pages/public/HomePage";
import SearchResultsPage from "@/pages/public/SearchResultsPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import EventDetailPage from "@/pages/events/EventDetailPage";
import RealtimeEventDetailsPage from "@/pages/events/RealtimeEventDetailsPage";

// Admin Pages
import CreateEventPage from "@/pages/admin/CreateEventPage";
import MyEventPage from "@/pages/admin/MyEventPage";
import AdminSeatmapPage from "@/pages/admin/AdminSeatmapPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminKycPage from "@/pages/admin/AdminKycPage";
import AdminEventApprovalPage from "@/pages/admin/AdminEventApprovalPage";
import AdminUserPage from "@/pages/admin/AdminUserPage";
import AdminCategoryPage from "@/pages/admin/AdminCategoryPage";
import AdminSettlementPage from "@/pages/admin/AdminSettlementPage";
import AdminRefundPage from "@/pages/admin/AdminRefundPage";

// Organizer Pages
import OrganizerKycPage from "@/pages/organizer/OrganizerKycPage";
import OrganizerContractsPage from "@/pages/organizer/OrganizerContractsPage";
import OrganizerEventDashboardPage from "@/pages/organizer/OrganizerEventDashboardPage";
import OrganizerVouchersPage from "@/pages/organizer/OrganizerVouchersPage";

// Staff Pages
import StaffCheckInPage from "@/pages/staff/StaffCheckInPage";
import StaffTrafficPage from "@/pages/staff/StaffTrafficPage";

// Resale Page
import ResaleMarketPage from "@/pages/resale/ResaleMarketPage";

// User Pages
import MyTicketPage from "@/pages/user/MyTicketPage";
import AccountPage from "@/pages/user/AccountPage";

// Payment Pages
import PaymentPage from "@/pages/payment/PaymentPage";
import PaymentDonePage from "@/pages/payment/PaymentDonePage";
import PaymentFailPage from "@/pages/payment/PaymentFailPage";
import PaymentResultPage from "@/pages/payment/PaymentResultPage";
import PaymentErr from "@/pages/payment/PaymentErr";

// Helper component for singular/plural route redirection
function RedirectEventsToEvent() {
  const { eventId } = useParams();
  return <Navigate to={eventId ? `/event/${eventId}` : PATHS.HOME} replace />;
}

const AppRoutes = () => {
  return (
    <Routes>
      {/* Routes wrapped with MainLayout (Header + Outlet + Footer) */}
      <Route element={<MainLayout />}>
        {/* Public routes */}
        <Route path={PATHS.HOME} element={<HomePage />} />
        <Route path={PATHS.SEARCH} element={<SearchResultsPage />} />
        <Route path={PATHS.EVENT_DETAILS} element={<EventDetailPage />} />
        <Route path={PATHS.RESALE_MARKET} element={<ResaleMarketPage />} />

        {/* User protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path={PATHS.USER_TICKETS} element={<MyTicketPage />} />
          <Route path={PATHS.USER_ACCOUNT} element={<AccountPage />} />
          <Route path={PATHS.ADMIN_MY_EVENTS} element={<MyEventPage />} />
        </Route>

        {/* Organizer protected routes (ORGANIZER & ADMIN) */}
        <Route element={<ProtectedRoute allowedRoles={["ORGANIZER", "ADMIN"]} />}>
          <Route path={PATHS.ADMIN_CREATE_EVENT} element={<CreateEventPage />} />
          <Route path={PATHS.ORGANIZER_KYC} element={<OrganizerKycPage />} />
          <Route path={PATHS.ORGANIZER_CONTRACTS} element={<OrganizerContractsPage />} />
          <Route path={PATHS.ORGANIZER_EVENT_DASHBOARD} element={<OrganizerEventDashboardPage />} />
          <Route path={PATHS.ORGANIZER_EVENT_VOUCHERS} element={<OrganizerVouchersPage />} />
        </Route>

        {/* Staff protected routes (STAFF, ORGANIZER, ADMIN) */}
        <Route element={<ProtectedRoute allowedRoles={["STAFF", "ORGANIZER", "ADMIN"]} />}>
          <Route path={PATHS.STAFF_CHECK_IN} element={<StaffCheckInPage />} />
          <Route path={PATHS.STAFF_TRAFFIC} element={<StaffTrafficPage />} />
        </Route>

        {/* Admin only protected routes */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route path={PATHS.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
          <Route path={PATHS.ADMIN_KYC} element={<AdminKycPage />} />
          <Route path={PATHS.ADMIN_EVENTS_APPROVAL} element={<AdminEventApprovalPage />} />
          <Route path={PATHS.ADMIN_USERS} element={<AdminUserPage />} />
          <Route path={PATHS.ADMIN_CATEGORIES} element={<AdminCategoryPage />} />
          <Route path={PATHS.ADMIN_SETTLEMENTS} element={<AdminSettlementPage />} />
          <Route path={PATHS.ADMIN_REFUNDS} element={<AdminRefundPage />} />
          <Route path={PATHS.ADMIN_SEATMAP} element={<AdminSeatmapPage />} />
        </Route>
      </Route>

      {/* Auth routes */}
      <Route path={PATHS.LOGIN} element={<LoginPage />} />
      <Route path={PATHS.REGISTER} element={<RegisterPage />} />
      <Route path={PATHS.VERIFY_EMAIL} element={<VerifyEmailPage />} />
      <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={PATHS.RESET_PASSWORD} element={<ResetPasswordPage />} />

      {/* Legacy /test route aliases redirecting seamlessly to protected routes */}
      <Route
        path={PATHS.ADMIN_CREATE_EVENT_TEST}
        element={<Navigate to={PATHS.ADMIN_CREATE_EVENT} replace />}
      />
      <Route
        path={PATHS.USER_TICKETS_TEST}
        element={<Navigate to={PATHS.USER_TICKETS} replace />}
      />

      {/* Aliases & Fallback redirects to prevent accidental home page redirection */}
      <Route path="/events/:eventId" element={<RedirectEventsToEvent />} />
      <Route path="/events" element={<Navigate to={PATHS.HOME} replace />} />
      <Route path="/admin/my-events" element={<Navigate to={PATHS.ADMIN_MY_EVENTS} replace />} />
      <Route path="/admin/create-event" element={<Navigate to={PATHS.ADMIN_CREATE_EVENT} replace />} />
      <Route path="/organizer/dashboard" element={<Navigate to={PATHS.ADMIN_MY_EVENTS} replace />} />
      <Route path="/organizer/events" element={<Navigate to={PATHS.ADMIN_MY_EVENTS} replace />} />
      <Route path="/user/account" element={<Navigate to={PATHS.USER_ACCOUNT} replace />} />
      <Route path="/account" element={<Navigate to={PATHS.USER_ACCOUNT} replace />} />
      <Route path="/auth/login" element={<Navigate to={PATHS.LOGIN} replace />} />
      <Route path="/auth/register" element={<Navigate to={PATHS.REGISTER} replace />} />

      {/* Booking & Payment routes */}
      <Route path={PATHS.EVENT_SEATS} element={<RealtimeEventDetailsPage />} />
      <Route path={PATHS.PAYMENT} element={<PaymentPage />} />
      <Route path={PATHS.PAYMENT_DONE} element={<PaymentDonePage />} />
      <Route path={PATHS.PAYMENT_FAIL} element={<PaymentFailPage />} />
      <Route path={PATHS.PAYMENT_RESULT} element={<PaymentResultPage />} />
      <Route path={PATHS.PAYMENT_ERROR} element={<PaymentErr />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  );
};

export default AppRoutes;
