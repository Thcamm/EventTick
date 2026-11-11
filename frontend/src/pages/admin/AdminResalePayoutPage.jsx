/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import {
  Ticket,
  DollarSign,
  Building2,
  CheckCircle2,
  Clock,
  Send,
  X,
  CreditCard,
  User,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function AdminResalePayoutPage() {
  const [payouts, setPayouts] = useState([]);
  const [statusTab, setStatusTab] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/resale/payouts?status=${statusTab}`);
      setPayouts(res.payouts || []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách chi trả vé bán lại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [statusTab]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedPayout(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleConfirmPaid = async (e) => {
    e.preventDefault();
    if (!selectedPayout) return;
    if (!payoutRef.trim()) {
      showToast('Vui lòng nhập mã tham chiếu giao dịch chuyển khoản');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/admin/resale/payouts/${selectedPayout.id}/paid`, {
        payoutRef: payoutRef.trim(),
      });
      showToast('Đã xác nhận chi trả tiền cho người bán vé!');
      setSelectedPayout(null);
      setPayoutRef('');
      fetchPayouts();
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật trạng thái chi trả');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Chi Trả Tiền Vé Bán Lại (Resale Payouts)</h1>
        <p className='text-sm text-[#71717a] mt-1'>
          Đối soát và chuyển khoản tiền bán vé cho khán giả sau khi vé đã có người mua thành công.
        </p>
      </div>

      {/* Tabs */}
      <div className='inline-flex items-center gap-1.5 bg-[#f4f4f6] p-1 rounded-full overflow-x-auto max-w-full scrollbar-none'>
        <button
          type='button'
          onClick={() => setStatusTab('PENDING')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            statusTab === 'PENDING'
              ? 'bg-[#09090b] text-white shadow-xs'
              : 'text-[#71717a] hover:text-[#09090b]'
          }`}>
          Đang chờ chi trả (PENDING)
        </button>
        <button
          type='button'
          onClick={() => setStatusTab('PAID')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            statusTab === 'PAID'
              ? 'bg-[#09090b] text-white shadow-xs'
              : 'text-[#71717a] hover:text-[#09090b]'
          }`}>
          Đã chi trả hoàn tất (PAID)
        </button>
      </div>

      {/* Payouts Table */}
      <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
        {loading ? (
          <div className='py-16 text-center text-xs text-[#71717a]'>Đang kiểm tra danh sách giải ngân...</div>
        ) : payouts.length === 0 ? (
          <div className='py-16 text-center text-xs text-[#71717a] border border-dashed border-[#e4e4e7] rounded-2xl'>
            Không có khoản chi trả nào trong mục này.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs text-left'>
              <thead>
                <tr className='border-b border-[#e4e4e7] text-[#71717a] uppercase text-[11px]'>
                  <th className='py-3 px-3'>Người bán &amp; Vé</th>
                  <th className='py-3 px-3'>Tài khoản nhận tiền</th>
                  <th className='py-3 px-3 text-right'>Số tiền chi trả</th>
                  <th className='py-3 px-3'>Đơn người mua</th>
                  <th className='py-3 px-3 text-right'>Thao tác</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[#f4f4f6]'>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className='py-4 px-3'>
                      <div className='font-bold text-[#09090b]'>{p.seller?.name || 'Khách bán'}</div>
                      <div className='text-[11px] text-[#71717a]'>{p.seller?.email}</div>
                      <div className='text-xs font-semibold text-[#09090b] mt-1'>
                        {p.eventTitle} • {p.tierName}
                      </div>
                    </td>

                    <td className='py-4 px-3'>
                      {p.bank ? (
                        <div className='space-y-0.5'>
                          <div className='font-bold text-[#09090b]'>{p.bank.bankName}</div>
                          <div className='font-mono font-bold text-[#09090b]'>{p.bank.accountNo}</div>
                          <div className='text-[10px] text-[#71717a] uppercase'>{p.bank.accountHolder}</div>
                        </div>
                      ) : (
                        <span className='text-[#71717a]'>Chưa có thông tin</span>
                      )}
                    </td>

                    <td className='py-4 px-3 text-right'>
                      <div className='text-sm font-extrabold text-[#09090b]'>
                        {(p.payoutAmount || 0).toLocaleString('vi-VN')} ₫
                      </div>
                      <div className='text-[10px] text-[#71717a]'>
                        Giá bán: {(p.resalePrice || 0).toLocaleString('vi-VN')} ₫
                      </div>
                    </td>

                    <td className='py-4 px-3'>
                      <div className='font-mono font-semibold text-[#09090b]'>#{p.buyerOrderCode || '—'}</div>
                      {p.paidOutAt && (
                        <div className='text-[10px] text-[#71717a]'>
                          Đã trả: {new Date(p.paidOutAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                      {p.payoutRef && (
                        <div className='text-[10px] text-[#09090b] font-mono font-bold'>Ref: {p.payoutRef}</div>
                      )}
                    </td>

                    <td className='py-4 px-3 text-right'>
                      {p.payoutStatus === 'PENDING' ? (
                        <button
                          type='button'
                          onClick={() => {
                            setSelectedPayout(p);
                            setPayoutRef('');
                          }}
                          className='inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#09090b] text-white rounded-full text-xs font-semibold hover:bg-[#27272a] transition-colors'>
                          <Send size={12} />
                          <span>Chuyển tiền</span>
                        </button>
                      ) : (
                        <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f4f4f6] border border-[#e4e4e7] text-[#09090b] font-semibold text-[11px]'>
                          <CheckCircle2 size={13} />
                          <span>Đã thanh toán</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Payment Modal */}
      {selectedPayout && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
          onClick={() => setSelectedPayout(null)}>
          <div
            className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl'
            onClick={(e) => e.stopPropagation()}>
            <div className='flex justify-between items-center'>
              <h3 className='text-lg font-bold text-[#09090b]'>Xác nhận chi trả tiền vé bán lại</h3>
              <button
                type='button'
                onClick={() => setSelectedPayout(null)}
                className='text-[#71717a] hover:text-[#09090b]'>
                <X size={18} />
              </button>
            </div>

            <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl space-y-2 text-xs'>
              <div className='flex justify-between items-center'>
                <span className='text-[#71717a]'>Người nhận:</span>
                <strong className='text-[#09090b]'>{selectedPayout.seller?.name}</strong>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-[#71717a]'>Ngân hàng:</span>
                <strong className='text-[#09090b]'>{selectedPayout.bank?.bankName}</strong>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-[#71717a]'>Số tài khoản:</span>
                <strong className='font-mono text-[#09090b]'>{selectedPayout.bank?.accountNo}</strong>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-[#71717a]'>Chủ tài khoản:</span>
                <strong className='text-[#09090b] uppercase'>{selectedPayout.bank?.accountHolder}</strong>
              </div>
              <div className='flex justify-between items-center pt-2 border-t border-[#e4e4e7] text-sm font-bold'>
                <span>Số tiền chuyển khoản:</span>
                <span className='text-base text-[#09090b]'>
                  {(selectedPayout.payoutAmount || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmPaid} className='space-y-4 text-xs'>
              <div className='space-y-1.5'>
                <label className='font-semibold text-[#09090b] block'>
                  Mã tham chiếu ngân hàng (FT/Trace ID) *
                </label>
                <input
                  type='text'
                  required
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder='VD: VCB-9823482394 hoặc Napas Trace...'
                  className='w-full px-3.5 py-2.5 border border-[#e4e4e7] rounded-xl font-mono text-xs outline-none focus:border-[#09090b]'
                />
              </div>

              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setSelectedPayout(null)}
                  className='flex-1 py-2.5 border border-[#e4e4e7] text-[#52525b] font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
                  Hủy
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  className='flex-1 py-2.5 bg-[#09090b] text-white font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
                  {submitting ? 'Đang lưu...' : 'Xác nhận đã chuyển'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
