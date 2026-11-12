import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Users, CalendarDays, ShieldCheck, Wallet, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const STATUS_LABEL = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Chờ ký HĐ', PUBLISHED: 'Đang mở bán', CANCELLED: 'Đã huỷ', ENDED: 'Đã kết thúc' };
const ROLE_LABEL = { CUSTOMER: 'Khách hàng', ORGANIZER: 'Nhà tổ chức', STAFF: 'Nhân viên', ADMIN: 'Quản trị viên' };

function Stat({ icon: Icon, label, value, sub, to, alert }) {
  const body = (
    <div className={`bg-white border rounded-2xl p-5 h-full ${alert ? 'border-[#09090b]' : 'border-[#e4e4e7]'} ${to ? 'hover:shadow-md transition-shadow' : ''}`}>
      <div className='flex items-center justify-between text-[#71717a] mb-3'>
        <span className='text-[11px] font-semibold uppercase tracking-wider'>{label}</span>
        <Icon size={17} className='text-[#09090b]' />
      </div>
      <div className='text-2xl font-extrabold tracking-tight'>{value}</div>
      {sub && <div className='text-xs text-[#71717a] mt-1.5'>{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** UC44: tổng quan hệ thống + doanh thu theo tháng. Mọi số liệu lấy từ /v1/admin/analytics. */
export default function AdminDashboardPage() {
  const { showToast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/analytics/overview')
      .then((r) => setOverview(r.overview))
      .catch((err) => showToast(err.message || 'Không tải được số liệu tổng quan'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    api
      .get(`/admin/analytics/revenue?year=${year}`)
      .then(setRevenue)
      .catch((err) => showToast(err.message || 'Không tải được doanh thu'));
  }, [year, showToast]);

  if (loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2'>
        <Loader2 size={16} className='animate-spin' /> Đang tải...
      </div>
    );

  const pa = overview?.pendingActions || {};
  const od = overview?.overdue || {};
  const overdueRows = [
    [od.contractsWaitingSign3d, 'hợp đồng chờ Organizer ký quá 3 ngày', PATHS.ADMIN_EVENTS],
    [od.eventsPending2d, 'sự kiện chờ duyệt quá 2 ngày', PATHS.ADMIN_EVENTS],
    [od.kycPending2d, 'hồ sơ KYC chờ duyệt quá 2 ngày', PATHS.ADMIN_KYC],
  ].filter(([n]) => n > 0);
  const months = revenue?.monthlyStats || [];
  const maxGmv = Math.max(1, ...months.map((m) => m.grossMerchandiseValue || 0));
  const thisYear = new Date().getFullYear();

  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Tổng quan hệ thống</h1>
        <p className='text-sm text-[#71717a] mt-1'>Số liệu thật từ hệ thống, cập nhật mỗi lần mở trang.</p>
      </div>

      {overdueRows.length > 0 && (
        <div className='bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1'>
          <div className='text-sm font-bold text-amber-900'>Cần xử lý gấp</div>
          {overdueRows.map(([n, text, to]) => (
            <Link key={text} to={to} className='block text-sm text-amber-900 hover:underline'>
              {n} {text}
            </Link>
          ))}
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Stat icon={Users} label='Người dùng' value={overview?.users?.total ?? 0} sub={Object.entries(overview?.users?.byRole || {}).map(([k, v]) => `${ROLE_LABEL[k] || k}: ${v}`).join(' · ')} to={PATHS.ADMIN_USERS} />
        <Stat icon={CalendarDays} label='Sự kiện chờ duyệt' value={pa.pendingEvents ?? 0} sub={`Tổng ${overview?.events?.total ?? 0} sự kiện`} to={PATHS.ADMIN_EVENTS} alert={pa.pendingEvents > 0} />
        <Stat icon={ShieldCheck} label='Hồ sơ KYC chờ duyệt' value={pa.kycProfiles ?? 0} to={PATHS.ADMIN_KYC} alert={pa.kycProfiles > 0} />
        <Stat icon={Wallet} label='Yêu cầu đối soát' value={pa.payoutRequests ?? 0} to={PATHS.ADMIN_PAYOUTS} alert={pa.payoutRequests > 0} />
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Stat icon={Wallet} label='Tổng giao dịch (GMV)' value={money(overview?.financials?.totalGMV)} sub={`${overview?.financials?.paidOrdersCount ?? 0} đơn đã thanh toán`} />
        <Stat icon={Wallet} label='Hoa hồng ước tính' value={money(overview?.financials?.estimatedCommission)} sub='Tính theo 10% (số chính xác theo từng hợp đồng ở bảng doanh thu)' />
        <Stat icon={RotateCcw} label='Yêu cầu hoàn tiền đang xử lý' value={pa.refundRequests ?? 0} />
      </div>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
          <h2 className='font-bold'>Doanh thu theo tháng</h2>
          <select aria-label='Năm' className='px-3 py-1.5 bg-[#f4f4f6] rounded-lg text-sm' value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className='grid gap-3 sm:grid-cols-4 mb-6 text-sm'>
          {[
            ['GMV', revenue?.summary?.yearlyGross],
            ['Hoàn tiền', revenue?.summary?.yearlyRefund],
            ['GMV thuần', revenue?.summary?.yearlyNetGMV],
            ['Hoa hồng', revenue?.summary?.yearlyCommissionRevenue],
          ].map(([k, v]) => (
            <div key={k} className='bg-[#f9f9fb] rounded-lg p-3'>
              <div className='text-[11px] uppercase tracking-wider text-[#71717a]'>{k}</div>
              <div className='font-bold'>{money(v)}</div>
            </div>
          ))}
        </div>
        <div className='flex items-end gap-2 h-44' role='img' aria-label='Biểu đồ GMV theo tháng'>
          {months.map((m, i) => (
            <div key={i} className='flex-1 flex flex-col items-center justify-end h-full gap-1' title={`${MONTHS[i]}: ${money(m.grossMerchandiseValue)} · ${m.ordersCount} đơn`}>
              <div className='w-full bg-[#09090b] rounded-t' style={{ height: `${Math.max(2, ((m.grossMerchandiseValue || 0) / maxGmv) * 100)}%`, opacity: m.grossMerchandiseValue ? 1 : 0.15 }} />
              <span className='text-[10px] text-[#71717a]'>{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <h2 className='font-bold mb-3'>Sự kiện theo trạng thái</h2>
        <div className='flex flex-wrap gap-2'>
          {Object.entries(overview?.events?.byStatus || {}).map(([k, v]) => (
            <span key={k} className='px-3 py-1.5 bg-[#f4f4f6] border border-[#e4e4e7] rounded-full text-xs font-semibold'>
              {STATUS_LABEL[k] || k}: {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
