import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import "./PaymentPage.css";

const POLL_MS = 3000;

const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")} ₫`;

const formatTime = (seconds) => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trình duyệt chặn clipboard: người dùng tự copy */
    }
  };
  return (
    <div className="pay-row">
      <span className="pay-label">{label}</span>
      <span className="pay-value">{value}</span>
      <button type="button" className="pay-copy" onClick={copy}>
        {copied ? "Đã chép" : "Sao chép"}
      </button>
    </div>
  );
}

/**
 * Thanh toán chuyển khoản qua SePay (VietQR).
 * Luồng: lấy hướng dẫn -> hiển thị QR + nội dung chuyển khoản -> mỗi 3s hỏi trạng thái đơn
 * -> SePay gọi webhook về backend -> đơn PAID -> chuyển sang trang thành công.
 */
const PaymentPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [checkHint, setCheckHint] = useState("");
  const doneRef = useRef(false);
  const redirectTimerRef = useRef(null);

  const goSuccess = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPaidSuccess(true);
    redirectTimerRef.current = setTimeout(
      () => navigate(`/payment-done?order=${orderId}`, { replace: true }),
      1800
    );
  }, [navigate, orderId]);

  useEffect(() => () => clearTimeout(redirectTimerRef.current), []);

  // 1. Lấy hướng dẫn chuyển khoản + thông tin đơn
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ins, ord] = await Promise.all([
          axiosInstance.get(`/payment/orders/${orderId}/instructions`),
          axiosInstance.get(`/booking/orders/auth/${orderId}`),
        ]);
        if (!alive) return;
        setInfo(ins.data);
        setOrder(ord.data.order);
        setTimeLeft(Math.max(0, Math.round((new Date(ins.data.expiresAt) - Date.now()) / 1000)));
      } catch (err) {
        if (!alive) return;
        const status = err.response?.status;
        const msg = err.response?.data?.message;
        if (status === 401) {
          navigate("/login");
        } else if (status === 409) {
          // Đơn không còn ở trạng thái chờ thanh toán (đã trả / hết hạn / huỷ)
          try {
            const { data } = await axiosInstance.get(`/booking/orders/auth/${orderId}`);
            setOrder(data.order);
            if (data.status === "CONFIRMED") goSuccess();
            else setError(data.status === "EXPIRED" ? "Đơn hàng đã hết hạn giữ chỗ. Vui lòng đặt lại." : "Đơn hàng đã bị huỷ.");
          } catch {
            setError(msg || "Đơn hàng không còn chờ thanh toán.");
          }
        } else if (status === 404) {
          setError("Không tìm thấy đơn hàng.");
        } else {
          setError(msg || "Không tải được thông tin thanh toán. Vui lòng thử lại.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, navigate, goSuccess]);

  // 2. Đếm ngược theo hạn thật của đơn (tính theo đồng hồ, không trôi khi tab ngủ)
  useEffect(() => {
    if (!info?.expiresAt) return;
    const tick = () => setTimeLeft(Math.max(0, Math.round((new Date(info.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [info]);

  // 3. Hỏi trạng thái đơn mỗi 3 giây cho tới khi PAID / hết hạn / huỷ
  const checkStatus = useCallback(async (manual = false) => {
    if (doneRef.current) return;
    if (manual) {
      setCheckingNow(true);
      setCheckHint("");
    }
    try {
      const { data } = await axiosInstance.get(`/booking/orders/auth/${orderId}`);
      if (data.status === "CONFIRMED") {
        goSuccess();
      } else if (data.status === "EXPIRED" || data.status === "CANCELLED") {
        doneRef.current = true;
        setError(data.status === "EXPIRED" ? "Đơn hàng đã hết hạn giữ chỗ. Vui lòng đặt lại." : "Đơn hàng đã bị huỷ.");
      } else if (manual) {
        setCheckHint("Hệ thống chưa nhận được thông báo từ ngân hàng/SePay. Trang vẫn tự động kiểm tra mỗi 3 giây...");
      }
    } catch {
      if (manual) setCheckHint("Không thể kiểm tra ngay lúc này, đang thử lại tự động...");
    } finally {
      if (manual) setCheckingNow(false);
    }
  }, [orderId, goSuccess]);

  useEffect(() => {
    if (!info || error) return;
    const t = setInterval(checkStatus, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && checkStatus();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [info, error, checkStatus]);

  // 4. Hết giờ: kiểm tra lại lần cuối (phòng khách vừa chuyển tiền) rồi báo hết hạn
  useEffect(() => {
    if (timeLeft === 0 && info && !doneRef.current) checkStatus();
  }, [timeLeft, info, checkStatus]);

  const cancelOrder = async () => {
    if (!window.confirm("Huỷ đơn hàng này? Vé đã giữ sẽ được trả lại.")) return;
    setCancelling(true);
    try {
      await axiosInstance.post(`/booking/orders/${orderId}/cancel`);
      doneRef.current = true;
      navigate(order?.event_id ? `/event/${order.event_id}` : "/");
    } catch (err) {
      setError(err.response?.data?.message || "Không huỷ được đơn hàng.");
    } finally {
      setCancelling(false);
    }
  };

  const expired = timeLeft === 0;

  return (
    <div className="payment-page">
      {paidSuccess && (
        <div className="pay-modal-backdrop" role="status" aria-live="polite">
          <div className="pay-modal">
            <div className="pay-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" />
                <path d="M14 27 l8 8 l16 -17" />
              </svg>
            </div>
            <h3>Chuyển khoản thành công!</h3>
            <p>
              Đã nhận thanh toán cho đơn <strong>{info?.orderCode || order?.order_code}</strong>. Mua vé thành công — đang chuyển tới vé điện tử của bạn...
            </p>
            <button
              type="button"
              className="pay-btn"
              onClick={() => navigate(`/payment-done?order=${orderId}`, { replace: true })}
            >
              Xem vé điện tử ngay
            </button>
          </div>
        </div>
      )}
      <button type="button" className="pay-close" onClick={() => navigate("/")} aria-label="Đóng">
        ×
      </button>
      <h2 className="pay-title">Thanh toán đơn hàng</h2>

      {loading && <p className="pay-muted">Đang tải thông tin thanh toán...</p>}

      {error && (
        <div className="pay-alert pay-alert-error">
          <p>{error}</p>
          <button type="button" className="pay-btn" onClick={() => navigate(order?.event_id ? `/event/${order.event_id}` : "/")}>
            Quay lại sự kiện
          </button>
        </div>
      )}

      {!loading && !error && info && (
        <div className="pay-layout">
          <section className="pay-card">
            <h3>Quét mã để thanh toán</h3>
            {info.qrUrl && !qrFailed ? (
              <img className="pay-qr" src={info.qrUrl} alt="Mã QR chuyển khoản" onError={() => setQrFailed(true)} />
            ) : (
              <p className="pay-muted">
                {info.qrUrl ? "Không tải được mã QR, vui lòng chuyển khoản thủ công theo thông tin bên cạnh." : "Chưa cấu hình tài khoản nhận tiền, vui lòng liên hệ ban tổ chức."}
              </p>
            )}
            <p className={`pay-timer ${timeLeft <= 60 ? "pay-timer-warn" : ""}`}>
              ⏳ Thời gian còn lại: <strong>{formatTime(timeLeft ?? 0)}</strong>
            </p>
            {!expired && <p className="pay-muted pay-waiting">Đang chờ nhận tiền... trang sẽ tự chuyển khi thanh toán thành công.</p>}
            {expired && <p className="pay-expired">Đã hết thời gian giữ chỗ. Nếu bạn vừa chuyển tiền, vui lòng chờ vài giây; nếu không, hãy đặt lại.</p>}
            <div className="pay-check-wrap">
              <button
                type="button"
                className="pay-btn pay-btn-check"
                onClick={() => checkStatus(true)}
                disabled={checkingNow}
              >
                {checkingNow ? "Đang kiểm tra giao dịch..." : "Tôi đã chuyển khoản — Kiểm tra ngay"}
              </button>
              {checkHint && <p className="pay-check-hint">{checkHint}</p>}
            </div>
          </section>

          <section className="pay-card">
            <h3>Hoặc chuyển khoản thủ công</h3>
            <CopyField label="Ngân hàng" value={info.bank || "—"} />
            <CopyField label="Số tài khoản" value={info.account || "—"} />
            <CopyField label="Số tiền" value={String(info.amount)} />
            <CopyField label="Nội dung" value={info.transferContent} />
            <p className="pay-note">
              ⚠️ Chuyển <strong>đúng số tiền</strong> và <strong>đúng nội dung</strong> ({info.transferContent}). Sai nội dung hoặc thiếu tiền thì hệ thống không tự xác nhận được đơn.
            </p>
          </section>

          <section className="pay-card pay-wide">
            <h3>Đơn hàng {info.orderCode}</h3>
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Loại vé</th>
                  <th>Đơn giá</th>
                  <th>SL</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(order?.items_snapshot || []).map((it, i) => (
                  <tr key={`${it.tier_id}-${i}`}>
                    <td>{it.tier_name}</td>
                    <td>{money(it.unit_price)}</td>
                    <td>{it.quantity}</td>
                    <td>{money(it.unit_price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {order?.discount_amount > 0 && (
                  <tr>
                    <td colSpan="3">Giảm giá</td>
                    <td>-{money(order.discount_amount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan="3">
                    <strong>Tổng thanh toán</strong>
                  </td>
                  <td>
                    <strong>{money(info.amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
            <button type="button" className="pay-btn pay-btn-ghost" onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? "Đang huỷ..." : "Huỷ đơn hàng"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;
