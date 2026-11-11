import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Copy, Clock, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

const POLL_MS = 3000;
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function CopyRow({ label, value }) {
  const { showToast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      showToast(`Đã sao chép ${label.toLowerCase()}`);
    } catch {
      showToast('Trình duyệt chặn sao chép, vui lòng tự chép');
    }
  };
  return (
    <div className='flex items-center justify-between gap-3 py-2.5 border-b border-[#f4f4f6] last:border-0'>
      <div className='min-w-0'>
        <div className='text-[11px] uppercase tracking-wider font-semibold text-[#71717a]'>{label}</div>
        <div className='text-sm font-bold text-[#09090b] break-all'>{value || '—'}</div>
      </div>
      <button type='button' onClick={copy} className='tb-btn tb-btn-outline tb-btn-sm shrink-0' aria-label={`Sao chép ${label}`}>
        <Copy size={13} />
      </button>
    </div>
  );
}

/** Thanh toán chuyển khoản SePay (VietQR): hiện QR, đếm ngược 10 phút, tự hỏi trạng thái đơn mỗi 3 giây. */
export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [info, setInfo] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef(null);

  const goSuccess = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPaid(true);
    timerRef.current = setTimeout(() => navigate(`${PATHS.PAYMENT_DONE}?order=${orderId}`, { replace: true }), 1800);
  }, [navigate, orderId]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ins, ord] = await Promise.all([
          api.get(`/payment/orders/${orderId}/instructions`),
          api.get(`/booking/orders/auth/${orderId}`),
        ]);
        if (!alive) return;
        setInfo(ins);
        setOrder(ord.order);
      } catch (err) {
        if (!alive) return;
        if (err.status === 401) {
          navigate(PATHS.LOGIN);
          return;
        }
        if (err.status === 422 && err.data?.needsForm) {
          navigate(`/checkout/${orderId}`, { replace: true });
          return;
        }
        if (err.status === 409) {
          try {
            const o = await api.get(`/booking/orders/auth/${orderId}`);
            setOrder(o.order);
            if (o.status === 'CONFIRMED') goSuccess();
            else setError(o.status === 'EXPIRED' ? 'Đơn hàng đã hết hạn giữ chỗ. Vui lòng đặt lại.' : 'Đơn hàng đã bị huỷ.');
          } catch {
            setError(err.message || 'Đơn hàng không còn chờ thanh toán.');
          }
        } else {
          setError(err.status === 404 ? 'Không tìm thấy đơn hàng.' : err.message || 'Không tải được thông tin thanh toán.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, navigate, goSuccess]);

  useEffect(() => {
    if (!info?.expiresAt) return undefined;
    const tick = () => setTimeLeft(Math.max(0, Math.round((new Date(info.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [info]);

  const checkStatus = useCallback(
    async (manual = false) => {
      if (doneRef.current) return;
      if (manual) setChecking(true);
      try {
        const o = await api.get(`/booking/orders/auth/${orderId}`);
        if (o.status === 'CONFIRMED') goSuccess();
        else if (o.status === 'EXPIRED' || o.status === 'CANCELLED') {
          doneRef.current = true;
          setError(o.status === 'EXPIRED' ? 'Đơn hàng đã hết hạn giữ chỗ. Vui lòng đặt lại.' : 'Đơn hàng đã bị huỷ.');
        } else if (manual) {
          showToast('Chưa nhận được tiền. Trang vẫn tự kiểm tra mỗi 3 giây.');
        }
      } catch {
        if (manual) showToast('Không kiểm tra được lúc này, đang thử lại tự động.');
      } finally {
        if (manual) setChecking(false);
      }
    },
    [orderId, goSuccess, showToast],
  );

  useEffect(() => {
    if (!info || error) return undefined;
    const t = setInterval(checkStatus, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && checkStatus();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [info, error, checkStatus]);

  useEffect(() => {
    if (timeLeft === 0 && info && !doneRef.current) checkStatus();
  }, [timeLeft, info, checkStatus]);

  const cancelOrder = async () => {
    if (!window.confirm('Huỷ đơn hàng này? Vé đã giữ sẽ được trả lại.')) return;
    setCancelling(true);
    try {
      await api.post(`/booking/orders/${orderId}/cancel`);
      doneRef.current = true;
      showToast('Đã huỷ đơn hàng');
      navigate(order?.event_id ? `/events/${order.event_id}` : PATHS.HOME);
    } catch (err) {
      setError(err.message || 'Không huỷ được đơn hàng.');
    } finally {
      setCancelling(false);
    }
  };

  const expired = timeLeft === 0;
  const backTo = order?.event_id ? `/events/${order.event_id}` : PATHS.HOME;

  return (
    <div className='tb-container py-10'>
      <h1 className='text-2xl font-bold tracking-tight mb-6'>Thanh toán đơn hàng</h1>

      {paid && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' role='status'>
          <div className='bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-3 shadow-xl'>
            <CheckCircle size={48} className='mx-auto text-[#09090b]' />
            <h3 className='text-lg font-bold'>Thanh toán thành công!</h3>
            <p className='text-sm text-[#52525b]'>
              Đã nhận tiền cho đơn <strong>{info?.orderCode}</strong>. Đang chuyển tới vé điện tử của bạn...
            </p>
            <button
              type='button'
              className='tb-btn tb-btn-solid w-full'
              onClick={() => navigate(`${PATHS.PAYMENT_DONE}?order=${orderId}`, { replace: true })}>
              Xem vé điện tử ngay
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải thông tin thanh toán...
        </p>
      )}

      {error && (
        <div className='p-5 bg-red-50 border border-red-200 rounded-xl space-y-3 max-w-xl'>
          <p className='text-sm text-red-700'>{error}</p>
          <button type='button' className='tb-btn tb-btn-solid' onClick={() => navigate(backTo)}>
            Quay lại sự kiện
          </button>
        </div>
      )}

      {!loading && !error && info && (
        <div className='grid gap-6 lg:grid-cols-2'>
          <section className='bg-white border border-[#e4e4e7] rounded-2xl p-6 text-center'>
            <h2 className='font-bold mb-4'>Quét mã để thanh toán</h2>
            {info.qrUrl && !qrFailed ? (
              <img
                src={info.qrUrl}
                alt='Mã QR chuyển khoản'
                className='mx-auto w-64 max-w-full rounded-lg border border-[#e4e4e7]'
                onError={() => setQrFailed(true)}
              />
            ) : (
              <p className='text-sm text-[#71717a]'>
                {info.qrUrl ? 'Không tải được mã QR, hãy chuyển khoản thủ công.' : 'Chưa cấu hình tài khoản nhận tiền.'}
              </p>
            )}
            <p className={`mt-4 flex items-center justify-center gap-2 text-sm ${timeLeft <= 60 ? 'text-red-600' : 'text-[#52525b]'}`}>
              <Clock size={15} /> Còn lại <strong>{fmt(timeLeft ?? 0)}</strong>
            </p>
            {!expired && <p className='text-xs text-[#71717a] mt-1'>Đang chờ nhận tiền, trang tự chuyển khi thanh toán xong.</p>}
            {expired && (
              <p className='text-sm text-red-600 mt-2'>
                Hết thời gian giữ chỗ. Nếu vừa chuyển tiền, hãy chờ vài giây; nếu không, vui lòng đặt lại.
              </p>
            )}
            <button type='button' className='tb-btn tb-btn-solid w-full mt-4' disabled={checking} onClick={() => checkStatus(true)}>
              {checking ? 'Đang kiểm tra...' : 'Tôi đã chuyển khoản, kiểm tra ngay'}
            </button>
          </section>

          <section className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
            <h2 className='font-bold mb-2'>Hoặc chuyển khoản thủ công</h2>
            <CopyRow label='Ngân hàng' value={info.bank} />
            <CopyRow label='Số tài khoản' value={info.account} />
            <CopyRow label='Số tiền' value={String(info.amount)} />
            <CopyRow label='Nội dung' value={info.transferContent} />
            <p className='text-xs text-[#52525b] mt-3 p-3 bg-[#f9f9fb] rounded-lg'>
              Chuyển <strong>đúng số tiền</strong> và <strong>đúng nội dung</strong> ({info.transferContent}). Sai nội dung hoặc thiếu
              tiền thì hệ thống không tự xác nhận được đơn.
            </p>
          </section>

          <section className='bg-white border border-[#e4e4e7] rounded-2xl p-6 lg:col-span-2'>
            <h2 className='font-bold mb-3'>Đơn hàng {info.orderCode}</h2>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                    <th className='py-2'>Loại vé</th>
                    <th>Đơn giá</th>
                    <th>SL</th>
                    <th className='text-right'>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(order?.items_snapshot || []).map((it, i) => (
                    <tr key={`${it.tier_id}-${i}`} className='border-b border-[#f4f4f6]'>
                      <td className='py-2'>{it.tier_name}</td>
                      <td>{money(it.unit_price)}</td>
                      <td>{it.quantity}</td>
                      <td className='text-right'>{money(it.unit_price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order?.discount_amount > 0 && (
              <div className='flex justify-between text-sm mt-3'>
                <span>Giảm giá</span>
                <span>-{money(order.discount_amount)}</span>
              </div>
            )}
            <div className='flex justify-between font-bold text-lg mt-3'>
              <span>Tổng thanh toán</span>
              <span>{money(info.amount)}</span>
            </div>
            <button type='button' className='tb-btn tb-btn-outline mt-4' onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? 'Đang huỷ...' : 'Huỷ đơn hàng'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
