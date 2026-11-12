import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Banknote, X, QrCode, AlertTriangle } from 'lucide-react';
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
const REFUND_STATUS = { PROCESSING: 'Đang xử lý', COMPLETED: 'Đã hoàn tất', REJECTED: 'Lỗi' };
const BANK_CODES = {
  vietcombank: 'VCB',
  vcb: 'VCB',
  vietinbank: 'CTG',
  'ngân hàng công thương': 'CTG',
  bidv: 'BIDV',
  'techcombank': 'TCB',
  tcb: 'TCB',
  mbbank: 'MB',
  'mb bank': 'MB',
  mb: 'MB',
  acb: 'ACB',
  sacombank: 'STB',
  'tpbank': 'TPB',
  'tp bank': 'TPB',
  vpbank: 'VPB',
  shb: 'SHB',
  hdbank: 'HDB',
  'ocb': 'OCB',
  seabank: 'SEAB',
  msb: 'MSB',
  vib: 'VIB',
  eximbank: 'EIB',
  eib: 'EIB',
  lpbank: 'LPB',
  lpb: 'LPB',
  agribank: 'AGRI',
};

const bankCode = (name) => {
  const normalized = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return BANK_CODES[normalized] || null;
};

const refundQrUrl = (refund) => {
  const info = refund.refundBankInfo;
  const code = bankCode(info?.bank_name);
  if (!code || !info?.account_no) return null;
  const params = new URLSearchParams({
    amount: String(Math.round(Number(refund.refundAmount || 0))),
    addInfo: `REFUND-${refund.id}`,
    accountName: info.account_holder || '',
  });
  return `https://img.vietqr.io/image/${code}-${encodeURIComponent(info.account_no)}-compact2.png?${params.toString()}`;
};

/** UC42: duyệt & giải ngân đối soát cho nhà tổ chức; UC43: theo dõi các khoản hoàn tiền do huỷ sự kiện. */
export default function AdminPayoutsPage() {
  const { showToast } = useToast();
  const [view, setView] = useState('REQUESTED');
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [qrRefund, setQrRefund] = useState(null);

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

  useEffect(() => {
    if (!qrRefund) return undefined;
    let active = true;
    const checkStatus = async () => {
      try {
        const result = await api.get(`/admin/refunds/${qrRefund.id}`);
        if (active && result.refund?.status === 'COMPLETED') {
          setQrRefund(null);
          showToast('SePay đã xác nhận chuyển khoản hoàn tiền');
          load();
        }
      } catch {
        // The manual confirmation button remains available if polling is interrupted.
      }
    };
    checkStatus();
    const timer = setInterval(checkStatus, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, qrRefund, showToast]);

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

  const completeRefund = async (refund) => {
    setBusy(`refund:${refund.id}`);
    try {
      await api.put(`/admin/refunds/${refund.id}/complete`, {});
      setQrRefund(null);
      showToast('Đã ghi nhận chuyển khoản hoàn tiền');
      load();
    } catch (err) {
      showToast(err.message || 'Không thể ghi nhận hoàn tiền');
    } finally {
      setBusy('');
    }
  };

  const rejectRefund = async (refund) => {
    const reason = window.prompt(`Nhập lý do báo lỗi cho ${refund.orderCode}:`, 'Thông tin tài khoản nhận tiền không hợp lệ');
    if (reason === null) return;
    if (!reason.trim()) return showToast('Vui lòng nhập lý do báo lỗi');
    setBusy(`reject-refund:${refund.id}`);
    try {
      await api.put(`/admin/refunds/${refund.id}/reject`, { reason: reason.trim() });
      setQrRefund(null);
      showToast('Đã đánh dấu yêu cầu hoàn tiền bị lỗi');
      load();
    } catch (err) {
      showToast(err.message || 'Không thể báo lỗi yêu cầu hoàn tiền');
    } finally {
      setBusy('');
    }
  };

  const showRefundQr = (refund) => {
    const url = refundQrUrl(refund);
    if (!url) {
      showToast(`Chưa nhận diện được ngân hàng "${refund.refundBankInfo?.bank_name || ''}". Vui lòng dùng tên ngân hàng chuẩn VietQR.`);
      return;
    }
    setQrRefund({ ...refund, qrUrl: url });
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
                <th>Tài khoản nhận</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th></th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={8} className='p-8 text-center text-[#71717a]'>Chưa có khoản hoàn tiền nào.</td>
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
                  <td className='text-xs'>
                    {r.refundBankInfo ? (
                      <>
                        <div className='font-semibold'>{r.refundBankInfo.bank_name}</div>
                        <div className='font-mono'>{r.refundBankInfo.account_no}</div>
                        <div className='uppercase'>{r.refundBankInfo.account_holder}</div>
                      </>
                    ) : 'Chưa có'}
                  </td>
                  <td className='text-xs max-w-xs'>{r.reason}</td>
                  <td>{REFUND_STATUS[r.status] || r.status}</td>
                  <td>
                    {r.status === 'PROCESSING' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => showRefundQr(r)}>
                        <QrCode size={13} /> Tạo QR
                      </button>
                    )}
                    {r.status === 'PROCESSING' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' disabled={busy === `reject-refund:${r.id}`} onClick={() => rejectRefund(r)}>
                        <AlertTriangle size={13} /> Báo lỗi
                      </button>
                    )}
                  </td>
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
      {qrRefund && (
        <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4' onClick={() => setQrRefund(null)}>
          <div className='bg-white rounded-2xl p-6 w-full max-w-sm space-y-4' onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between'>
              <h2 className='font-bold'>QR chuyển tiền hoàn</h2>
              <button type='button' onClick={() => setQrRefund(null)} className='p-1 text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
                <X size={18} />
              </button>
            </div>
            <img src={qrRefund.qrUrl} alt='Mã QR chuyển khoản hoàn tiền' className='w-64 h-64 mx-auto' />
            <div className='text-sm space-y-1'>
              <div><strong>Ngân hàng:</strong> {qrRefund.refundBankInfo.bank_name}</div>
              <div><strong>Số tài khoản:</strong> {qrRefund.refundBankInfo.account_no}</div>
              <div><strong>Chủ tài khoản:</strong> {qrRefund.refundBankInfo.account_holder}</div>
              <div><strong>Số tiền:</strong> {money(qrRefund.refundAmount)}</div>
              <div><strong>Nội dung:</strong> REFUND-{qrRefund.id}</div>
            </div>
            <p className='text-xs text-[#71717a]'>Mở ứng dụng ngân hàng của EventTick và quét mã này. Kiểm tra lại tên người nhận và số tiền trước khi xác nhận.</p>
            <div className='flex gap-2'>
              <button type='button' className='tb-btn tb-btn-solid flex-1' disabled={busy === `refund:${qrRefund.id}`} onClick={() => completeRefund(qrRefund)}>
                <Banknote size={14} /> Đã chuyển khoản
              </button>
              <button type='button' className='tb-btn tb-btn-outline text-red-700' disabled={busy === `reject-refund:${qrRefund.id}`} onClick={() => rejectRefund(qrRefund)}>
                <AlertTriangle size={14} /> Báo lỗi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
