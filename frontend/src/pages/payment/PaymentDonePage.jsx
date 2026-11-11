import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Calendar, MapPin, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import TicketQr from '../../components/TicketQr';
import { PATHS } from '../../routes/paths';

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) =>
  d
    ? new Date(d).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

/** /payment-done?order=<orderId>: biên lai + vé điện tử có QR (nội dung QR = mã vé + chữ ký HMAC). */
export default function PaymentDonePage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    api
      .get(`/booking/orders/auth/${orderId}`)
      .then((res) => {
        if (!alive) return;
        if (res.status !== 'CONFIRMED') navigate(`/payment/${orderId}`, { replace: true });
        else setData(res);
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 401) navigate(PATHS.LOGIN);
        else setError(err.message || 'Không tải được thông tin đơn hàng.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId, navigate]);

  if (loading)
    return (
      <div className='tb-container py-16 text-[#71717a] flex items-center gap-2'>
        <Loader2 size={16} className='animate-spin' /> Đang tải thông tin vé...
      </div>
    );

  const order = data?.order;
  const tickets = data?.tickets || [];

  return (
    <div className='tb-container py-10 max-w-3xl'>
      <div className='text-center mb-8'>
        <CheckCircle size={52} className='mx-auto mb-3' />
        <h1 className='text-2xl font-bold tracking-tight'>Thanh toán thành công!</h1>
        <p className='text-sm text-[#52525b] mt-1'>
          {tickets.length > 0
            ? `Bạn đã mua ${tickets.length} vé. Vé cũng được gửi qua email và lưu trong mục "Vé của tôi".`
            : 'Vé điện tử đã được phát hành, xem trong mục "Vé của tôi".'}
        </p>
      </div>

      {error && <div className='p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>}

      {data && (
        <>
          <section className='bg-white border border-[#e4e4e7] rounded-2xl p-6 mb-6'>
            <div className='flex gap-4 mb-4'>
              {data.event?.bannerUrl && (
                <img src={data.event.bannerUrl} alt='' className='w-24 h-24 rounded-lg object-cover shrink-0' />
              )}
              <div className='min-w-0'>
                <h2 className='font-bold'>{data.event?.title || 'Sự kiện'}</h2>
                {data.session && (
                  <p className='text-sm text-[#52525b] flex items-center gap-1.5 mt-1'>
                    <Calendar size={13} /> {data.session.name} · {fmt(data.session.startTime)}
                  </p>
                )}
                {data.event && (
                  <p className='text-sm text-[#52525b] flex items-center gap-1.5'>
                    <MapPin size={13} /> {[data.event.venueName, data.event.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <dl className='text-sm divide-y divide-[#f4f4f6]'>
              <div className='flex justify-between py-2'>
                <dt className='text-[#71717a]'>Mã đơn hàng</dt>
                <dd className='font-semibold'>{order?.order_code}</dd>
              </div>
              {data.payment?.transactionRef && (
                <div className='flex justify-between py-2'>
                  <dt className='text-[#71717a]'>Mã giao dịch</dt>
                  <dd className='font-semibold break-all'>{data.payment.transactionRef}</dd>
                </div>
              )}
              <div className='flex justify-between py-2'>
                <dt className='text-[#71717a]'>Thời gian thanh toán</dt>
                <dd className='font-semibold'>{fmt(data.payment?.paidAt)}</dd>
              </div>
              <div className='flex justify-between py-2'>
                <dt className='text-[#71717a]'>Hình thức</dt>
                <dd className='font-semibold'>Chuyển khoản VietQR (SePay)</dd>
              </div>
              {order?.discount_amount > 0 && (
                <div className='flex justify-between py-2'>
                  <dt className='text-[#71717a]'>Giảm giá</dt>
                  <dd className='font-semibold'>-{money(order.discount_amount)}</dd>
                </div>
              )}
              <div className='flex justify-between py-2 text-base'>
                <dt className='font-bold'>Đã thanh toán</dt>
                <dd className='font-bold'>{money(data.payment?.amount ?? order?.total_amount)}</dd>
              </div>
            </dl>
          </section>

          <h3 className='font-bold mb-3'>Vé của bạn</h3>
          <div className='grid gap-4 sm:grid-cols-2'>
            {tickets.map((t, i) => (
              <article key={t._id} className='bg-white border border-[#e4e4e7] rounded-2xl p-5 text-center'>
                <div className='flex items-center justify-between mb-3 text-left'>
                  <span className='text-[11px] font-bold uppercase tracking-wider text-[#71717a]'>
                    Vé {i + 1}/{tickets.length}
                  </span>
                  <strong className='text-sm'>{t.tierName}</strong>
                </div>
                {t.seat && (
                  <p className='text-sm mb-3 text-left'>
                    Khu <b>{t.seat.section}</b> · Hàng <b>{t.seat.row}</b> · Ghế <b>{t.seat.number}</b>
                  </p>
                )}
                <TicketQr value={`${t.ticketCode}.${t.qrHash}`} className='mx-auto' />
                <div className='mt-3 text-sm font-mono font-bold'>#{t.ticketCode}</div>
                <div className='text-[11px] text-[#71717a]'>Đưa mã này cho nhân viên tại cổng soát vé</div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className='flex flex-wrap justify-center gap-3 mt-8'>
        <Link to={PATHS.MY_TICKETS} className='tb-btn tb-btn-solid'>
          Xem Vé của tôi
        </Link>
        <Link to={PATHS.HOME} className='tb-btn tb-btn-outline'>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
