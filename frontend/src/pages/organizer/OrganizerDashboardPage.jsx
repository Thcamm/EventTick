/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Ticket,
  DollarSign,
  ShieldAlert,
  PlusCircle,
  FileSignature,
  TrendingUp,
  Tag,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function OrganizerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await api.get('/organizer/dashboard');
        setDashboardData(res);
      } catch (err) {
        showToast(err.message || 'Không thể tải số liệu bảng điều khiển Ban Tổ Chức');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = dashboardData?.stats;
  const eventCounts = stats?.eventCounts || {};
  const upcomingEvents = dashboardData?.upcomingEvents || [];
  const recentOrders = dashboardData?.recentOrders || [];

  return (
    <div className='space-y-8'>
      {/* Header & Quick CTA */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Cổng Quản Trị Ban Tổ Chức</h1>
          <p className='text-sm text-[#71717a] mt-1'>
            Chào mừng trở lại, {user?.full_name || user?.username}. Tổng quan hoạt động phân phối vé sự kiện.
          </p>
        </div>
        <Link
          to={PATHS.ORGANIZER_CREATE_EVENT}
          className='inline-flex items-center gap-2 px-5 py-2.5 bg-[#09090b] text-white text-sm font-semibold rounded-full hover:bg-[#27272a] transition-colors shrink-0'>
          <PlusCircle size={16} />
          <span>Tạo sự kiện mới</span>
        </Link>
      </div>

      {/* Quick Nav Pills */}
      <div className='flex items-center gap-2 overflow-x-auto max-w-full scrollbar-none pb-1'>
        {[
          { label: 'Sự kiện của tôi', path: PATHS.ORGANIZER_EVENTS },
          { label: 'Hợp đồng điện tử', path: PATHS.ORGANIZER_CONTRACTS },
          { label: 'Xác thực KYC', path: PATHS.ORGANIZER_KYC },
          { label: 'Doanh thu & Rút tiền', path: PATHS.ORGANIZER_PAYOUTS },
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className='px-4 py-1.5 bg-white border border-[#e4e4e7] rounded-full text-xs font-semibold text-[#52525b] hover:text-[#09090b] hover:border-[#09090b] whitespace-nowrap transition-all'>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className='py-20 text-center text-sm text-[#71717a]'>Đang nạp dữ liệu thống kê sự kiện...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
              <div className='flex items-center justify-between text-[#71717a] mb-2'>
                <span className='text-xs font-bold uppercase tracking-wider'>Tổng doanh thu bán vé</span>
                <DollarSign size={18} className='text-[#09090b]' />
              </div>
              <div className='text-2xl font-extrabold text-[#09090b]'>
                {(stats?.totalGrossRevenue || 0).toLocaleString('vi-VN')} ₫
              </div>
              <div className='text-[11px] text-[#71717a] mt-1'>Doanh thu gộp từ các đơn hàng PAID</div>
            </div>

            <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
              <div className='flex items-center justify-between text-[#71717a] mb-2'>
                <span className='text-xs font-bold uppercase tracking-wider'>Tổng vé đã bán</span>
                <Ticket size={18} className='text-[#09090b]' />
              </div>
              <div className='text-2xl font-extrabold text-[#09090b]'>{stats?.totalTicketsSold || 0} vé</div>
              <div className='text-[11px] text-[#52525b] font-semibold mt-1'>
                Đã check-in: {stats?.checkedInTickets || 0} vé ({stats?.checkInRatePct || 0}%)
              </div>
            </div>

            <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
              <div className='flex items-center justify-between text-[#71717a] mb-2'>
                <span className='text-xs font-bold uppercase tracking-wider'>Tổng số sự kiện</span>
                <CalendarDays size={18} className='text-[#09090b]' />
              </div>
              <div className='text-2xl font-extrabold text-[#09090b]'>{stats?.totalEvents || 0}</div>
              <div className='text-[11px] text-[#71717a] mt-1'>
                {eventCounts.published || 0} đang mở bán • {eventCounts.pending || 0} chờ duyệt
              </div>
            </div>

            <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
              <div className='flex items-center justify-between text-[#71717a] mb-2'>
                <span className='text-xs font-bold uppercase tracking-wider'>Trạng thái KYC</span>
                <ShieldAlert size={18} className='text-[#09090b]' />
              </div>
              <div className='text-base font-bold text-[#09090b]'>Hồ sơ doanh nghiệp</div>
              <Link
                to={PATHS.ORGANIZER_KYC}
                className='text-xs font-semibold text-[#09090b] hover:underline mt-1 inline-block'>
                Kiểm tra xác minh →
              </Link>
            </div>
          </div>

          {/* Two-column layout: Upcoming Events + Status Breakdown */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            {/* Left 2 cols: Upcoming Events */}
            <div className='lg:col-span-2 bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
              <div className='flex items-center justify-between'>
                <h2 className='text-base font-bold text-[#09090b]'>Sự kiện sắp diễn ra &amp; Khuyến mãi</h2>
                <Link to={PATHS.ORGANIZER_EVENTS} className='text-xs font-semibold text-[#09090b] hover:underline'>
                  Xem tất cả
                </Link>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className='py-10 text-center text-xs text-[#71717a] border border-dashed border-[#e4e4e7] rounded-2xl'>
                  Chưa có sự kiện nào sắp diễn ra. Tạo sự kiện mới để bắt đầu bán vé.
                </div>
              ) : (
                <div className='space-y-3'>
                  {upcomingEvents.map((e) => (
                    <div
                      key={e.id}
                      className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                      <div className='space-y-1 min-w-0'>
                        <h3 className='text-sm font-bold text-[#09090b] truncate'>{e.title}</h3>
                        <div className='text-xs text-[#71717a] flex items-center gap-2'>
                          <Clock size={13} />
                          <span>
                            {e.startTime
                              ? new Date(e.startTime).toLocaleDateString('vi-VN')
                              : 'Chưa cập nhật ngày'}
                          </span>
                          <span>•</span>
                          <span className='font-semibold text-[#09090b]'>{e.status}</span>
                        </div>
                      </div>

                      <div className='flex items-center gap-2 shrink-0'>
                        {/* Manage Vouchers */}
                        <Link
                          to={`/organizer/events/${e.id}/vouchers`}
                          className='inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#e4e4e7] text-xs font-semibold text-[#09090b] hover:border-[#09090b] rounded-full transition-colors'>
                          <Tag size={13} />
                          <span>Voucher &amp; ROI</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right 1 col: Event Status Breakdown */}
            <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
              <h2 className='text-base font-bold text-[#09090b]'>Phân bố trạng thái sự kiện</h2>
              <div className='space-y-2.5 text-xs'>
                {[
                  { label: 'Đang mở bán (PUBLISHED)', count: eventCounts.published || 0 },
                  { label: 'Đã được duyệt (APPROVED)', count: eventCounts.approved || 0 },
                  { label: 'Đang chờ admin duyệt (PENDING)', count: eventCounts.pending || 0 },
                  { label: 'Bản nháp (DRAFT)', count: eventCounts.draft || 0 },
                  { label: 'Đã kết thúc (ENDED)', count: eventCounts.ended || 0 },
                ].map((row, i) => (
                  <div
                    key={i}
                    className='flex justify-between items-center p-3 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl'>
                    <span className='text-[#52525b]'>{row.label}</span>
                    <strong className='text-[#09090b]'>{row.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders Feed */}
          <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
            <h2 className='text-base font-bold text-[#09090b]'>Đơn đặt vé gần đây</h2>
            {recentOrders.length === 0 ? (
              <div className='py-8 text-center text-xs text-[#71717a] border border-dashed border-[#e4e4e7] rounded-2xl'>
                Chưa có giao dịch mua vé nào phát sinh.
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-xs text-left'>
                  <thead>
                    <tr className='border-b border-[#e4e4e7] text-[#71717a] uppercase text-[11px]'>
                      <th className='py-2.5 px-3'>Mã đơn</th>
                      <th className='py-2.5 px-3'>Sự kiện</th>
                      <th className='py-2.5 px-3 text-right'>Số tiền</th>
                      <th className='py-2.5 px-3 text-center'>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-[#f4f4f6]'>
                    {recentOrders.map((o) => (
                      <tr key={o.orderId}>
                        <td className='py-3 px-3 font-mono font-bold text-[#09090b]'>
                          #{String(o.orderId).slice(-6).toUpperCase()}
                        </td>
                        <td className='py-3 px-3 text-[#52525b] truncate max-w-xs'>
                          {o.eventTitle || 'Sự kiện EventTick'}
                        </td>
                        <td className='py-3 px-3 text-right font-bold text-[#09090b]'>
                          {(o.totalAmount || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className='py-3 px-3 text-center'>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              o.status === 'PAID'
                                ? 'bg-[#09090b] text-white shadow-xs'
                                : 'bg-[#f4f4f6] text-[#52525b] border border-[#e4e4e7]'
                            }`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
