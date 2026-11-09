import React, { useEffect, useState } from "react";
import "./MyTicketPage.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";
import { PATHS } from "@/routes/paths";
import QRCode from "qrcode";

const MyTicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [qrModalTicket, setQrModalTicket] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [resaleModalTicket, setResaleModalTicket] = useState(null);
  const [resalePrice, setResalePrice] = useState("");
  const [resaleSubmitting, setResaleSubmitting] = useState(false);

  const [refundModalTicket, setRefundModalTicket] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const fetchTickets = async () => {
    try {
      const { data } = await axiosInstance.get("/booking/user/tickets");
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleOpenQrModal = async (ticket) => {
    setQrModalTicket(ticket);
    try {
      const qrPayload = JSON.stringify({
        ticketCode: ticket.ticketCode,
        qrHash: ticket.qrHash,
      });
      const url = await QRCode.toDataURL(qrPayload, {
        width: 260,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("Lỗi tạo mã QR:", err);
    }
  };

  const handleOpenResaleModal = (ticket) => {
    setResaleModalTicket(ticket);
    setResalePrice(ticket.ticketPrice || "");
  };

  const handleOpenRefundModal = (ticket) => {
    setRefundModalTicket(ticket);
    setRefundReason("");
  };

  const handleSubmitResale = async (e) => {
    e.preventDefault();
    if (!resalePrice || Number(resalePrice) <= 0) {
      alert("Vui lòng nhập giá bán lại hợp lệ!");
      return;
    }
    const maxPrice = Math.round((resaleModalTicket.ticketPrice || 0) * 1.1);
    if (Number(resalePrice) > maxPrice) {
      alert(`Giá bán lại không được vượt quá 110% giá gốc (${maxPrice.toLocaleString()} ₫) để tuân thủ quy định chống phe vé.`);
      return;
    }

    try {
      setResaleSubmitting(true);
      await axiosInstance.post("/resale/listings", {
        ticketId: resaleModalTicket._id,
        resalePrice: Number(resalePrice),
      });
      alert("Đăng bán lại vé thành công lên Chợ vé!");
      setResaleModalTicket(null);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể đăng bán vé.");
    } finally {
      setResaleSubmitting(false);
    }
  };

  const handleSubmitRefund = async (e) => {
    e.preventDefault();
    if (!refundReason.trim()) {
      alert("Vui lòng nhập lý do hoàn tiền!");
      return;
    }
    try {
      setRefundSubmitting(true);
      await axiosInstance.post(`/booking/orders/${refundModalTicket.orderId}/refund`, {
        ticketId: refundModalTicket._id,
        reason: refundReason,
      });
      alert("Đã gửi yêu cầu hoàn tiền thành công! Quản trị viên sẽ xét duyệt trong thời gian sớm nhất.");
      setRefundModalTicket(null);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể gửi yêu cầu hoàn tiền.");
    } finally {
      setRefundSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Tài khoản</h2>
        <ul>
          <li>Cài đặt tài khoản</li>
          <li>
            <Link
              to={PATHS.USER_ACCOUNT}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Thông tin tài khoản
            </Link>
          </li>
          <li>
            <strong>Vé của tôi</strong>
          </li>
          <li>
            <Link
              to={PATHS.RESALE_MARKET}
              style={{ textDecoration: "none", color: "#a5b4fc" }}
            >
              Chợ vé thứ cấp (Resale)
            </Link>
          </li>
          <li>
            <Link
              to={PATHS.ADMIN_MY_EVENTS}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Sự kiện của tôi
            </Link>
          </li>
        </ul>
      </div>
      <div className="main">
        <h1>Vé của tôi</h1>
        <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
          Hệ thống vé trực tuyến 100%: Xuất trình mã QR trực tiếp tại cổng soát vé trên điện thoại của bạn để nhân viên quét vào sự kiện.
        </p>
        {loading ? (
          <p>Đang tải vé...</p>
        ) : tickets.length > 0 ? (
          <table border="1" cellPadding="8" className="ticket-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#222", textAlign: "left" }}>
                <th>Mã vé</th>
                <th>Sự kiện</th>
                <th>Hạng vé</th>
                <th>Giá vé</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, index) => {
                const isValid = ticket.rawStatus === "VALID";
                return (
                  <tr key={index} style={{ borderBottom: "1px solid #333" }}>
                    <td>
                      <code style={{ background: "#2a2a2a", padding: "4px 8px", borderRadius: "4px", color: "#4ade80", fontWeight: "bold" }}>
                        {ticket.ticketCode || "—"}
                      </code>
                    </td>
                    <td>
                      <Link
                        style={{ textDecoration: "none", color: "#38bdf8", fontWeight: "500" }}
                        to={`/event/${ticket.eventId}`}
                      >
                        {ticket.eventName}
                      </Link>
                    </td>
                    <td>{ticket.ticketName}</td>
                    <td>{Number(ticket.ticketPrice).toLocaleString()} ₫</td>
                    <td>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: isValid ? "#064e3b" : ticket.rawStatus === "USED" ? "#1e293b" : "#451a03",
                        color: isValid ? "#34d399" : ticket.rawStatus === "USED" ? "#94a3b8" : "#fbbf24",
                      }}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => handleOpenQrModal(ticket)}
                          style={{
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          📱 Vé QR
                        </button>

                        {isValid && (
                          <>
                            <button
                              onClick={() => handleOpenResaleModal(ticket)}
                              style={{
                                background: "#d97706",
                                color: "#fff",
                                border: "none",
                                padding: "6px 10px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Bán lại
                            </button>
                            <button
                              onClick={() => handleOpenRefundModal(ticket)}
                              style={{
                                background: "#dc2626",
                                color: "#fff",
                                border: "none",
                                padding: "6px 10px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Hoàn vé
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="content">
            <p>Bạn chưa có vé nào</p>
            <Link to={PATHS.HOME} className="btn">
              Mua vé ngay
            </Link>
          </div>
        )}
      </div>

      {/* MODAL 1: QR CODE TICKET */}
      {qrModalTicket && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "380px",
            width: "90%",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}>
            <h3 style={{ color: "#f4f4f5", marginBottom: "8px" }}>Vé điện tử trực tuyến</h3>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px" }}>{qrModalTicket.eventName}</p>

            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "8px",
              display: "inline-block",
              marginBottom: "16px",
            }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" style={{ width: "220px", height: "220px", display: "block" }} />
              ) : (
                <p style={{ color: "#000" }}>Đang tạo mã QR...</p>
              )}
            </div>

            <div style={{ background: "#27272a", padding: "10px", borderRadius: "6px", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#a1a1aa" }}>MÃ VÉ HỢP LỆ</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ade80", letterSpacing: "1px" }}>
                {qrModalTicket.ticketCode}
              </div>
              <div style={{ fontSize: "13px", color: "#e4e4e7", marginTop: "4px" }}>
                Hạng: <strong>{qrModalTicket.ticketName}</strong>
              </div>
            </div>

            <p style={{ color: "#71717a", fontSize: "11px", marginBottom: "16px" }}>
              * Hệ thống kiểm tra chữ ký số trực tuyến HMAC chống làm giả. Vui lòng không chia sẻ mã này cho người khác.
            </p>

            <button
              onClick={() => setQrModalTicket(null)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#3f3f46",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: BÁN LẠI VÉ (RESALE) */}
      {resaleModalTicket && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "420px",
            width: "90%",
          }}>
            <h3 style={{ color: "#f4f4f5", marginBottom: "8px" }}>Đăng bán lại vé trên Chợ thứ cấp</h3>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px" }}>
              Sự kiện: <strong>{resaleModalTicket.eventName}</strong> ({resaleModalTicket.ticketName})
            </p>
            <p style={{ color: "#d4d4d8", fontSize: "13px" }}>
              Giá vé gốc: <strong>{Number(resaleModalTicket.ticketPrice).toLocaleString()} ₫</strong>
            </p>
            <p style={{ color: "#fbbf24", fontSize: "12px", marginBottom: "16px" }}>
              * Giá bán lại tối đa cho phép: <strong>{Math.round((resaleModalTicket.ticketPrice || 0) * 1.1).toLocaleString()} ₫</strong> (110% giá gốc theo quy định chống phe vé).
            </p>

            <form onSubmit={handleSubmitResale}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#e4e4e7", marginBottom: "6px" }}>
                  Giá bán lại mong muốn (VNĐ):
                </label>
                <input
                  type="number"
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  placeholder="Ví dụ: 250000"
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#27272a",
                    border: "1px solid #52525b",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "15px",
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setResaleModalTicket(null)}
                  style={{
                    padding: "8px 16px",
                    background: "#3f3f46",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={resaleSubmitting}
                  style={{
                    padding: "8px 16px",
                    background: "#d97706",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {resaleSubmitting ? "Đang đăng..." : "Xác nhận đăng bán"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: YÊU CẦU HOÀN VÉ (REFUND) */}
      {refundModalTicket && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "420px",
            width: "90%",
          }}>
            <h3 style={{ color: "#f4f4f5", marginBottom: "8px" }}>Yêu cầu hoàn trả vé</h3>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px" }}>
              Mã vé: <strong>{refundModalTicket.ticketCode}</strong> - {refundModalTicket.eventName}
            </p>

            <form onSubmit={handleSubmitRefund}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#e4e4e7", marginBottom: "6px" }}>
                  Lý do hoàn vé:
                </label>
                <textarea
                  rows="3"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Vui lòng cung cấp lý do chi tiết..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#27272a",
                    border: "1px solid #52525b",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setRefundModalTicket(null)}
                  style={{
                    padding: "8px 16px",
                    background: "#3f3f46",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={refundSubmitting}
                  style={{
                    padding: "8px 16px",
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {refundSubmitting ? "Đang gửi..." : "Gửi yêu cầu hoàn tiền"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTicketPage;
