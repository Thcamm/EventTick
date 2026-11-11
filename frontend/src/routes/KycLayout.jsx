import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';

/** Trang KYC: khách thường xem trong giao diện công khai (không thấy khu quản trị); nhà tổ chức / admin xem trong dashboard. */
export default function KycLayout() {
  const { user } = useAuth();
  return user?.role === 'CUSTOMER' ? <MainLayout /> : <DashboardLayout />;
}
