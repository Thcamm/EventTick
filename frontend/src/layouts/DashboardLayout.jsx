import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Ticket,
  LayoutDashboard,
  Users,
  ShieldCheck,
  CalendarDays,
  FolderTree,
  DollarSign,
  PlusCircle,
  FileCheck2,
  QrCode,
  BarChart3,
  LogOut,
  ArrowLeft,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PATHS } from '../routes/paths';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Đã đăng xuất tài khoản');
      navigate(PATHS.HOME);
    } catch {
      showToast('Đăng xuất thành công');
    }
  };

  const getNavItems = () => {
    switch (user?.role) {
      case 'ADMIN':
        return [
          { label: 'Tổng quan hệ thống', path: PATHS.ADMIN_DASHBOARD, icon: LayoutDashboard },
          { label: 'Quản lý người dùng', path: PATHS.ADMIN_USERS, icon: Users },
          { label: 'Duyệt hồ sơ KYC', path: PATHS.ADMIN_KYC, icon: ShieldCheck },
          { label: 'Duyệt sự kiện & Phí', path: PATHS.ADMIN_EVENTS, icon: CalendarDays },
          { label: 'Danh mục CMS', path: PATHS.ADMIN_CATEGORIES, icon: FolderTree },
          { label: 'Quyết toán Payout', path: PATHS.ADMIN_PAYOUTS, icon: DollarSign },
        ];
      case 'ORGANIZER':
        return [
          { label: 'Bảng điều khiển', path: PATHS.ORGANIZER_DASHBOARD, icon: LayoutDashboard },
          { label: 'Sự kiện của tôi', path: PATHS.ORGANIZER_EVENTS, icon: CalendarDays },
          { label: 'Tạo sự kiện mới', path: PATHS.ORGANIZER_CREATE_EVENT, icon: PlusCircle },
          { label: 'Xác minh KYC', path: PATHS.ORGANIZER_KYC, icon: ShieldCheck },
          { label: 'Hợp đồng điện tử', path: PATHS.ORGANIZER_CONTRACTS, icon: FileCheck2 },
          { label: 'Doanh thu & Rút tiền', path: PATHS.ORGANIZER_PAYOUTS, icon: DollarSign },
        ];
      case 'STAFF':
        return [
          { label: 'Soát vé QR / Mã code', path: PATHS.STAFF_CHECKIN, icon: QrCode },
          { label: 'Thống kê lượt vào', path: PATHS.STAFF_STATS, icon: BarChart3 },
        ];
      default:
        return [
          { label: 'Vé của tôi', path: PATHS.MY_TICKETS, icon: Ticket },
          { label: 'Hồ sơ cá nhân', path: PATHS.PROFILE, icon: User },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className='min-h-screen flex bg-[#f8f9fa] text-[#09090b]'>
      {/* Sidebar N3 */}
      <aside className='w-64 bg-[#09090b] text-white flex flex-col justify-between shrink-0 border-r border-[#27272a]'>
        <div>
          {/* Logo & Role Badge */}
          <div className='p-6 border-b border-[#27272a]'>
            <Link to={PATHS.HOME} className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold'>
                <Ticket size={18} />
              </div>
              <div>
                <div className='font-bold text-base tracking-tight leading-none'>EventTick</div>
                <div className='text-[10px] text-[#a1a1aa] mt-1 font-semibold uppercase tracking-wider'>
                  PORTAL • {user?.role || 'USER'}
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className='p-4 space-y-1.5'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  }`}>
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom profile & Back */}
        <div className='p-4 border-t border-[#27272a] space-y-2'>
          <Link
            to={PATHS.HOME}
            className='flex items-center gap-2 px-3 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-[#18181b] rounded-lg transition-colors'>
            <ArrowLeft size={14} />
            <span>Về cổng công cộng</span>
          </Link>
          <div className='flex items-center justify-between pt-2 px-1'>
            <div className='truncate pr-2'>
              <div className='text-xs font-semibold truncate'>{user?.full_name || user?.username}</div>
              <div className='text-[11px] text-[#71717a] truncate'>{user?.email}</div>
            </div>
            <button
              type='button'
              onClick={handleLogout}
              className='p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded-lg transition-colors'
              title='Đăng xuất'>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Top bar */}
        <header className='h-16 bg-white border-b border-[#e4e4e7] px-8 flex items-center justify-between'>
          <div className='text-sm font-semibold text-[#09090b]'>
            Hệ thống quản trị EventTick • {user?.role}
          </div>
          <div className='flex items-center gap-3 text-xs text-[#71717a]'>
            <span>Phiên làm việc: <strong className='text-[#09090b]'>{user?.username}</strong></span>
          </div>
        </header>

        {/* Content body */}
        <main className='flex-1 p-8 overflow-y-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
