import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Banknote, X } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const TABS = [
  { k: 'REQUESTED', t: 'Chờ duyệt' },
  { k: 'APPROVED', t: 'Chờ chuyển khoản' },
  { k: 'SETTLED', t: 'Đã giải ngân' },
  { k: 'REJECTED', t: 'Đã từ chối' },
];
const REFUND_STATUS = { PROCESSING: 'Đang xử lý', COMPLETED: 'Đã hoàn tất', REJECTED: 'Từ chối' };

/** UC42: duyệt & giải ngân đối soát cho nhà tổ chức; UC43: theo dõi các khoản hoàn tiền do huỷ sự kiện. */
export default function AdminPayoutsPage() {
  const { showToast } = useToast();
  const [view, setView] = useState('REQUESTED');
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'REFUNDS') {
        const r = await api.get('/admin/refunds?limit=100');
        setRefunds(r.refunds || []);
      } else {
        const r = await api.get(`/admin/payouts?status=${view}&limit=100`);
        setPayouts(r.payouts || []);
      }
    } catch (err) {
      showToast(err.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [view, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const reject = async (p) => {
    const reason = window.prompt(`Lý do từ chối yêu cầu đối soát của "${p.event.title}" (nhà tổ chức sẽ thấy):`);
    if (reason === null) return;
    if (!reason.trim()) return showToast('Vui lòng nhập lý do từ chối');
    setBusy(`reject:${p.id}`);
    try {
      await api.put(`/admin/payouts/${p.id}/reject`, { reason: reason.trim() });
      showToast('Đã từ chối, nhà tổ chức có thể gửi lại');
      load();
    } catch (err) {
      showToast(err.message || 'Không từ chối được');
    } finally {
      setBusy('');
    }
  };

  const act = async (p, action) => {
    const msg = action === 'approve' ? `Duyệt đối soát ${money(p.netPayoutAmount)} cho "${p.event.title}"?` : `Xác nhận ĐÃ CHUYỂN KHOẢN ${money(p.netPayoutAmount)} cho ${p.organizer.name}? Hệ thống không tự chuyển tiền.`;
    if (!window.confirm(msg)) return;
    setBusy(`${action}:${p.id}`);
    try {
      await api.put(`/admin/payouts/${p.id}/${action === 'approve' ? 'approve' : 'settle'}`, {});
      showToast(action === 'approve' ? 'Đã duyệt yêu cầu' : 'Đã ghi nhận giải ngân');
      load();
    } catch (err) {
      showToast(err.message || 'Không thực hiện được');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Đối soát & Hoàn tiền</h1>
        <p className='text-sm text-[#71717a] mt-1'>Hệ thống chưa chuyển tiền tự động: Admin chuyển khoản thủ công rồi ghi nhận tại đây.</p>
      </div>

      <div className='flex flex-wrap gap-2'>
        {[...TABS, { k: 'REFUNDS', t: 'Hoàn tiền huỷ sự kiện' }].map(({ k, t }) => (
          <button key={k} type='button' onClick={() => setView(k)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${view === k ? 'bg-[#09090b] text-white border-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#52525b] hover:border-[#09090b]'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : view === 'REFUNDS' ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Khách hàng</th>
                <th>Sự kiện / Đơn</th>
                <th>Số tiền</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={6} className='p-8 text-center text-[#71717a]'>Chưa có khoản hoàn tiền nào.</td>
                </tr>
              )}
              {refunds.map((r) => (
                <tr key={r.id} className='border-b border-[#f4f4f6] last:border-0 align-top'>
                  <td className='p-4'>
                    <div className='font-semibold'>{r.user.name}</div>
                    <div className='text-xs text-[#71717a]'>{r.user.email}</div>
                  </td>
                  <td>
                    <div>{r.eventName}</div>
                    <div className='font-mono text-xs text-[#71717a]'>{r.orderCode}</div>
                  </td>
                  <td className='font-semibold'>{money(r.refundAmount)}</td>
                  <td className='text-xs max-w-xs'>{r.reason}</td>
                  <td>{REFUND_STATUS[r.status] || r.status}</td>
                  <td className='text-xs text-[#52525b]'>{fmt(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : payouts.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>Không có yêu cầu nào.</div>
      ) : (
        <div className='grid gap-4'>
          {payouts.map((p) => (
            <div key={p.id} className='bg-white border border-[#e4e4e7] rounded-2xl p-5 space-y-3'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='font-bold'>{p.event.title}</h2>
                  <p className='text-xs text-[#71717a]'>
                    {p.organizer.name} · {p.organizer.email} · yêu cầu lúc {fmt(p.createdAt)}
                  </p>
                </div>
                <div className='flex gap-2'>
                  {['REQUESTED', 'APPROVED'].includes(p.status) && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' disabled={busy === `reject:${p.id}`} onClick={() => reject(p)}>
                      <X size={13} /> Từ chối
                    </button>
                  )}
                  {p.status === 'REQUESTED' && (
                    <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' disabled={busy === `approve:${p.id}`} onClick={() => act(p, 'approve')}>
                      <Check size={13} /> Duyệt
                    </button>
                  )}
                  {p.status === 'APPROVED' && (
                    <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' disabled={busy === `settle:${p.id}`} onClick={() => act(p, 'settle')}>
                      <Banknote size={13} /> Đã chuyển khoản
                    </button>
                  )}
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-3 text-sm'>
                {[
                  ['Doanh thu gộp', money(p.grossRevenue)],
                  ['Hoa hồng nền tảng', money(p.platformCommissionAmt)],
                  ['Thực chuyển cho nhà tổ chức', money(p.netPayoutAmount)],
                ].map(([k, v]) => (
                  <div key={k} className='bg-[#f9f9fb] rounded-lg p-3'>
                    <div className='text-[11px] uppercase tracking-wider text-[#71717a]'>{k}</div>
                    <div className='font-bold'>{v}</div>
                  </div>
                ))}
              </div>
              {p.organizer.bankAccount && (
                <p className='text-xs text-[#52525b]'>
                  Tài khoản nhận: <strong>{typeof p.organizer.bankAccount === 'string' ? p.organizer.bankAccount : JSON.stringify(p.organizer.bankAccount)}</strong>
                </p>
              )}
              {p.status === 'REJECTED' && p.rejectionReason && (
                <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>Đã từ chối: {p.rejectionReason}</p>
              )}
              {p.settledAt && (
                <p className='text-xs text-[#52525b]'>
                  Giải ngân lúc {fmt(p.settledAt)} {p.settledByAdmin && `bởi ${p.settledByAdmin}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
