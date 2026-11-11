import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from './paths';

export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#f9f9fb] text-[#52525b] text-sm font-medium'>
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return <Outlet />;
}
