import { CalendarDays, Ticket, DollarSign, ShieldAlert, PlusCircle, FileSignature } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';

export default function OrganizerDashboardPage() {
  const { user } = useAuth();

  return (
    <div className='space-y-8'>
      {/* Header & Quick CTA */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Cổng Ban Tổ Chức</h1>
          <p className='text-sm text-[#71717a] mt-1'>Quản lý sự kiện, hợp đồng và doanh thu bán vé của bạn.</p>
        </div>
        <Link
          to={PATHS.ORGANIZER_CREATE_EVENT}
          className='inline-flex items-center gap-2 px-4 py-2.5 bg-[#09090b] text-white text-sm font-medium rounded-xl hover:bg-[#27272a] transition-colors'>
          <PlusCircle size={17} />
          <span>Tạo sự kiện mới</span>
        </Link>
      </div>

      {/* KYC Status Alert */}
      <div className='bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <ShieldAlert className='text-amber-600 shrink-0 mt-0.5' size={20} />
          <div>
            <h3 className='text-sm font-bold text-amber-900'>Hoàn tất xác minh danh tính (KYC) &amp; Ký E-Contract</h3>
            <p className='text-xs text-amber-800 mt-0.5'>
              Tài khoản Ban tổ chức {user?.username} cần xác minh giấy phép kinh doanh / CCCD để mở bán vé công khai và
              rút doanh thu.
            </p>
          </div>
        </div>
        <Link
          to={PATHS.ORGANIZER_KYC}
          className='px-4 py-2 bg-amber-900 text-white text-xs font-semibold rounded-lg hover:bg-amber-950 shrink-0 text-center transition-colors'>
          Cập nhật KYC
        </Link>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
          <div className='flex items-center justify-between text-[#71717a] mb-3'>
            <span className='text-xs font-semibold uppercase tracking-wider'>Sự kiện đang chạy</span>
            <CalendarDays size={18} className='text-[#09090b]' />
          </div>
          <div className='text-2xl font-bold text-[#09090b]'>2 sự kiện</div>
          <div className='text-xs text-[#71717a] mt-2'>1 sự kiện đang chờ duyệt</div>
        </div>

        <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
          <div className='flex items-center justify-between text-[#71717a] mb-3'>
            <span className='text-xs font-semibold uppercase tracking-wider'>Tổng vé đã bán</span>
            <Ticket size={18} className='text-[#09090b]' />
          </div>
          <div className='text-2xl font-bold text-[#09090b]'>1,420 vé</div>
          <div className='text-xs text-green-600 font-semibold mt-2'>+84 vé hôm nay</div>
        </div>

        <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
          <div className='flex items-center justify-between text-[#71717a] mb-3'>
            <span className='text-xs font-semibold uppercase tracking-wider'>Doanh thu khả dụng</span>
            <DollarSign size={18} className='text-[#09090b]' />
          </div>
          <div className='text-2xl font-bold text-[#09090b]'>482.000.000 ₫</div>
          <div className='text-xs text-[#71717a] mt-2'>Đã trừ hoa hồng nền tảng</div>
        </div>
      </div>

      {/* Contracts & Events preview */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-base font-bold text-[#09090b] flex items-center gap-2'>
            <FileSignature size={18} />
            <span>Sự kiện gần đây</span>
          </h2>
          <Link to={PATHS.ORGANIZER_EVENTS} className='text-xs font-semibold text-[#09090b] hover:underline'>
            Xem tất cả
          </Link>
        </div>
        <div className='text-sm text-[#71717a] py-8 text-center border border-dashed border-[#e4e4e7] rounded-xl'>
          Kết nối dữ liệu API sự kiện của bạn tại đây.
        </div>
      </div>
    </div>
  );
}
