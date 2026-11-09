import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { axiosInstance } from "@/services/apiClient";
import { PATHS } from "@/routes/paths";
import "./PaymentDonePage.css";

const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")} ₫`;
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/** Mã QR của vé: mã vé + chữ ký, để nhân viên soát vé quét. */
function TicketQr({ value }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? <img className="done-qr" src={src} alt="Mã QR của vé" /> : <div className="done-qr done-qr-empty" />;
}

/**
 * Trang "Thanh toán thành công": hiện sau khi SePay báo đã nhận tiền (PaymentPage tự chuyển sang đây).
 * Đường dẫn: /payment-done?order=<orderId>. Không có orderId (vào trực tiếp) thì chỉ hiện thông báo chung.
 */
const PaymentDonePage = () => {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data: res } = await axiosInstance.get(`/booking/orders/auth/${orderId}`);
        if (!alive) return;
        if (res.status !== "CONFIRMED") {
          navigate(`/payment/${orderId}`, { replace: true }); // chưa thanh toán: quay lại trang chờ
          return;
        }
        setData(res);
      } catch (err) {
        if (!alive) return;
        if (err.response?.status === 401) navigate("/login");
        else setError(err.response?.data?.message || "Không tải được thông tin đơn hàng.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, navigate]);

  if (loading) return <div className="done-page"><p className="done-muted">Đang tải thông tin vé...</p></div>;

  const order = data?.order;
  const tickets = data?.tickets || [];

  return (
    <div className="done-page">
      <div className="done-hero">
        <div className="done-check" aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="24" />
            <path d="M14 27 l8 8 l16 -17" />
          </svg>
        </div>
        <h1>Thanh toán thành công!</h1>
        <p>
          {tickets.length > 0
            ? <>Bạn đã mua <strong>{tickets.length} vé</strong>. Vé điện tử nằm ngay bên dưới và trong mục “Vé của tôi”.</>
            : "Cảm ơn bạn. Vé điện tử đã được phát hành, xem trong mục “Vé của tôi”."}
        </p>
      </div>

      {error && <div className="done-error">{error}</div>}

      {data && (
        <>
          <section className="done-card">
            <div className="done-event">
              {data.event?.bannerUrl && <img src={data.event.bannerUrl} alt="" />}
              <div>
                <h2>{data.event?.title || "Sự kiện"}</h2>
                {data.session && <p>📅 {data.session.name} · {fmtDateTime(data.session.startTime)}</p>}
                {data.event && <p>📍 {[data.event.venueName, data.event.city].filter(Boolean).join(", ")}</p>}
              </div>
            </div>
            <dl className="done-receipt">
              <div><dt>Mã đơn hàng</dt><dd>{order?.order_code}</dd></div>
              {data.payment?.transactionRef && (
                <div><dt>Mã giao dịch</dt><dd>{data.payment.transactionRef}</dd></div>
              )}
              <div><dt>Thời gian thanh toán</dt><dd>{fmtDateTime(data.payment?.paidAt)}</dd></div>
              <div><dt>Hình thức</dt><dd>Chuyển khoản VietQR (SePay)</dd></div>
              {order?.discount_amount > 0 && <div><dt>Giảm giá</dt><dd>-{money(order.discount_amount)}</dd></div>}
              <div className="done-total"><dt>Đã thanh toán</dt><dd>{money(data.payment?.amount ?? order?.total_amount)}</dd></div>
            </dl>
          </section>

          <h3 className="done-h3">Vé của bạn</h3>
          <div className="done-tickets">
            {tickets.map((t, i) => (
              <article className="done-ticket" key={t._id}>
                <div className="done-ticket-head">
                  <span className="done-badge">Vé {i + 1}/{tickets.length}</span>
                  <strong>{t.tierName}</strong>
                </div>
                {t.seat && (
                  <p className="done-seat">
                    Khu <b>{t.seat.section}</b> · Hàng <b>{t.seat.row}</b> · Ghế <b>{t.seat.number}</b>
                  </p>
                )}
                <TicketQr value={`${t.ticketCode}.${t.qrHash}`} />
                <code className="done-code">{t.ticketCode}</code>
              </article>
            ))}
          </div>
          <p className="done-muted done-note">Đưa mã QR này cho nhân viên soát vé tại cổng. Mỗi mã chỉ dùng được một lần.</p>
        </>
      )}

      <div className="done-actions">
        <Link to={PATHS.USER_TICKETS} className="done-btn done-btn-primary">Xem vé của tôi</Link>
        <Link to={PATHS.HOME} className="done-btn">Về trang chủ</Link>
      </div>
    </div>
  );
};

export default PaymentDonePage;
