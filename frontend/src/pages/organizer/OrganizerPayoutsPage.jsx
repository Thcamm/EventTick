import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const STATUS = {
  REQUESTED: { label: 'Chờ Admin duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Đã duyệt, chờ chuyển khoản', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  PAID: { label: 'Đã giải ngân', cls: 'bg-[#09090b] text-white border-[#09090b]' },
  COMPLETED: { label: 'Đã giải ngân', cls: 'bg-[#09090b] text-white border-[#09090b]' },
  REJECTED: { label: 'Bị từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
};

/** Lịch sử các yêu cầu đối soát & rút tiền (UC34). Yêu cầu mới tạo ở tab Đối soát của từng sự kiện. */
export default function OrganizerPayoutsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/organizer/payouts')
      .then((r) => setItems(r.payouts || []))
      .catch((err) => showToast(err.message || 'Không tải được danh sách đối soát'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const total = items.filter((p) => ['PAID', 'COMPLETED'].includes(p.status)).reduce((s, p) => s + (p.netPayoutAmount || 0), 0);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Doanh thu & Rút tiền</h1>
        <p className='text-sm text-[#71717a] mt-1'>
          Tạo yêu cầu mới trong tab &quot;Đối soát&quot; của từng sự kiện ở{' '}
          <Link to='/organizer/events' className='underline'>
            Sự kiện của tôi
          </Link>
          .
        </p>
      </div>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5 max-w-xs'>
        <div className='text-[11px] uppercase tracking-wider font-semibold text-[#71717a]'>Đã giải ngân</div>
        <div className='text-2xl font-extrabold tracking-tight mt-1'>{money(total)}</div>
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>Chưa có yêu cầu đối soát nào.</div>
      ) : (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Sự kiện</th>
                <th>Doanh thu gộp</th>
                <th>Hoa hồng</th>
                <th>Thực nhận</th>
                <th>Trạng thái</th>
                <th>Giải ngân lúc</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const st = STATUS[p.status] || { label: p.status, cls: 'bg-[#f4f4f6] border-[#e4e4e7]' };
                return (
                  <tr key={p.id} className='border-b border-[#f4f4f6] last:border-0'>
                    <td className='p-4 font-semibold'>{p.eventTitle || '—'}</td>
                    <td>{money(p.grossRevenue)}</td>
                    <td>{money(p.platformCommissionAmt)}</td>
                    <td className='font-semibold'>{money(p.netPayoutAmount)}</td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className='text-xs text-[#52525b]'>{fmt(p.settledAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
