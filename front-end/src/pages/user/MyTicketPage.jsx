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
  const [payoutBank, setPayoutBank] = useState({ bankName: "", accountNo: "", accountHolder: "" });
  const [bundleIds, setBundleIds] = useState([]); // các vé cùng hạng/suất được đăng chung 1 gói
  const [allowPartial, setAllowPartial] = useState(true); // true = người mua được mua lẻ
  const [, setTick] = useState(0); // đếm ngược giữ chỗ

  // Cập nhật mỗi giây khi có vé đang được người khác giữ chỗ thanh toán
  useEffect(() => {
    if (!tickets.some((t) => t.resale?.status === "RESERVED")) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tickets]);

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

  // Vé còn dùng được, cùng sự kiện + hạng vé + suất diễn với vé đang chọn (có thể đăng chung 1 gói)
  const sameGroupTickets = (ticket) =>
    tickets.filter(
      (t) =>
        t.rawStatus === "VALID" &&
        t.validity === "UPCOMING" &&
        t.eventId === ticket.eventId &&
        t.ticketName === ticket.ticketName &&
        String(t.sessionStart) === String(ticket.sessionStart),
    );

  const handleOpenResaleModal = (ticket) => {
    setResaleModalTicket(ticket);
    setResalePrice(ticket.ticketPrice || "");
    setBundleIds([ticket._id]);
    setAllowPartial(true);
  };

  const toggleBundleTicket = (id) =>
    setBundleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const formatCountdown = (until) => {
    const s = Math.max(0, Math.round((new Date(until) - Date.now()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const fmtDateTime = (d) =>
    d
      ? new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";

  // Trạng thái hiển thị: ưu tiên hạn vé và trạng thái bán lại
  const getStatusBadge = (ticket) => {
    const r = ticket.resale;
    if (ticket.rawStatus === "RESOLD_INVALID") {
      return r?.payoutStatus === "PAID"
        ? { text: "Đã bán lại · Đã nhận tiền", bg: "#064e3b", color: "#34d399" }
        : { text: "Đã bán lại · Chờ nhận tiền", bg: "#1e3a8a", color: "#93c5fd" };
    }
    if (ticket.rawStatus === "LISTED_RESALE") {
      if (r?.status === "RESERVED") {
        return { text: `Có người đang thanh toán (${formatCountdown(r.reservedUntil)})`, bg: "#7f1d1d", color: "#fca5a5" };
      }
      if (ticket.validity === "EXPIRED" || ticket.validity === "ONGOING" || ticket.validity === "CANCELLED") {
        return { text: "Đang bán lại · Quá hạn", bg: "#451a03", color: "#fbbf24" };
      }
      return { text: "Đang bán lại", bg: "#451a03", color: "#fbbf24" };
    }
    if (ticket.rawStatus === "USED") return { text: "Đã check-in", bg: "#1e293b", color: "#94a3b8" };
    if (ticket.rawStatus === "REFUNDED") return { text: "Đã hoàn tiền", bg: "#451a03", color: "#fbbf24" };
    if (ticket.validity === "CANCELLED") return { text: "Sự kiện bị huỷ", bg: "#7f1d1d", color: "#fca5a5" };
    if (ticket.validity === "EXPIRED") return { text: "Đã hết hạn", bg: "#27272a", color: "#a1a1aa" };
    if (ticket.validity === "ONGOING") return { text: "Đang diễn ra", bg: "#0c4a6e", color: "#7dd3fc" };
    return { text: "Chưa sử dụng", bg: "#064e3b", color: "#34d399" };
  };

  const cancelListing = async (ticket) => {
    if (!ticket.resale?.listingId) return;
    if (!window.confirm("Huỷ đăng bán vé này? Vé sẽ trở về trạng thái chưa sử dụng.")) return;
    try {
      await axiosInstance.delete(`/resale/listings/${ticket.resale.listingId}`);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || "Không huỷ được tin bán.");
    }
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
    if (!payoutBank.bankName.trim() || !payoutBank.accountHolder.trim() || !/^[0-9]{6,20}$/.test(payoutBank.accountNo.trim())) {
      alert("Vui lòng nhập đủ tài khoản nhận tiền (số tài khoản gồm 6–20 chữ số).");
      return;
    }

    try {
      setResaleSubmitting(true);
      if (!bundleIds.length) {
        alert("Vui lòng chọn ít nhất 1 vé để đăng bán.");
        return;
      }
      await axiosInstance.post("/resale/listings", {
        ticketIds: bundleIds,
        allowPartial,
        resalePrice: Number(resalePrice),
        bankName: payoutBank.bankName.trim(),
        accountNo: payoutBank.accountNo.trim(),
        accountHolder: payoutBank.accountHolder.trim(),
      });
      alert("Đăng bán lại vé thành công lên Chợ vé! Khi có người mua, EventTick sẽ chuyển tiền vào tài khoản bạn đã khai báo.");
      setResaleModalTicket(null);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể đăng bán vé.");
    } finally {
      setResaleSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-[#0b0e14] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans'>
      <div className='max-w-6xl mx-auto'>
        {/* ================================================================== */}
        {/* 1. HEADER & NAVIGATION BUTTON GROUP (from template)               */}
        {/* ================================================================== */}
        <div className='text-center mb-8'>
          <h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-3'>
            <span className='material-symbols-outlined text-blue-500 text-3xl sm:text-4xl'>confirmation_number</span>
            Vé của tôi
          </h1>
          <p className='text-slate-400 text-sm sm:text-base max-w-2xl mx-auto mt-2 leading-relaxed'>
            Hệ thống vé trực tuyến 100%: Quản lý, tải vé PDF và xuất trình mã QR định danh bảo mật HMAC-SHA256 trực tiếp
            tại cổng soát vé trên thiết bị của bạn.
          </p>

          {/* Button Group (Template Signature Navigation Bar) */}
          <div className='inline-flex bg-[#161b24] p-1.5 rounded-full border border-slate-700/60 shadow-lg gap-1.5 mt-5'>
            <Link
              to={PATHS.USER_TICKETS}
              className='bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30 px-6 py-2 rounded-full text-sm flex items-center gap-2 transition-all'>
              <span className='material-symbols-outlined text-base'>local_activity</span>
              Vé của tôi
            </Link>
            <Link
              to={PATHS.USER_ACCOUNT}
              className='text-slate-400 hover:text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors'>
              <span className='material-symbols-outlined text-base'>person</span>
              Tài khoản
            </Link>
            <Link
              to={PATHS.RESALE_MARKET}
              className='text-slate-400 hover:text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors'>
              <span className='material-symbols-outlined text-base'>storefront</span>
              Chợ vé Resale
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
              className='text-slate-400 hover:text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors'>
              <span className='material-symbols-outlined text-base'>event</span>
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
                <th>Suất diễn</th>
                <th>Giá vé</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, index) => {
                const canResale = ticket.rawStatus === "VALID" && ticket.validity === "UPCOMING";
                const badge = getStatusBadge(ticket);
                const canCancelListing = ticket.rawStatus === "LISTED_RESALE" && ticket.resale?.status === "ACTIVE";
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
                    <td style={{ fontSize: "13px" }}>
                      {ticket.sessionStart ? (
                        <>
                          <div>{fmtDateTime(ticket.sessionStart)}</div>
                          {ticket.sessionEnd && (
                            <div style={{ color: "#a1a1aa", fontSize: "12px" }}>Kết thúc: {fmtDateTime(ticket.sessionEnd)}</div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{Number(ticket.ticketPrice).toLocaleString()} ₫</td>
                    <td>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.color,
                      }}>
                        {badge.text}
                      </span>
                      {ticket.resale?.resalePrice && ["LISTED_RESALE", "RESOLD_INVALID"].includes(ticket.rawStatus) && (
                        <div style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "4px" }}>
                          Giá bán: {Number(ticket.resale.resalePrice).toLocaleString()} ₫
                        </div>
                      )}
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

                        {canResale && (
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
                        )}
                        {canCancelListing && (
                          <button
                            onClick={() => cancelListing(ticket)}
                            style={{
                              background: "#3f3f46",
                              color: "#fff",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Huỷ bán
                          </button>
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

        {/* ================================================================== */}
        {/* 4. MODAL 1: HIGH-FIDELITY BOARDING PASS / DIGITAL PASS (QR MODAL) */}
        {/* ================================================================== */}
        {qrModalTicket && (
          <div className='fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200'>
            <div className='bg-[#181d28] border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative'>
              {/* Pass Header */}
              <div className='bg-linear-to-r from-blue-900 to-indigo-900 p-6 relative border-b-2 border-dashed border-slate-600/80'>
                <button
                  onClick={() => setQrModalTicket(null)}
                  className='absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors cursor-pointer'>
                  <span className='material-symbols-outlined text-lg'>close</span>
                </button>
                <div className='text-xs uppercase tracking-widest text-blue-300 font-semibold mb-1'>
                  Vé vào cổng điện tử
                </div>
                <h3 className='text-xl font-bold text-white line-clamp-1'>{qrModalTicket.eventName}</h3>
                <div className='text-xs text-blue-200 mt-1 flex items-center gap-1'>
                  <span className='material-symbols-outlined text-xs'>apartment</span>
                  {qrModalTicket.venueName || 'Sân khấu chính'}
                </div>
              </div>

              {/* QR Code Body */}
              <div className='p-6 text-center bg-[#131722]'>
                <div className='inline-block bg-white p-3.5 rounded-2xl shadow-xl mb-4'>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt='Mã QR Vé' className='w-56 h-56 block mx-auto object-contain' />
                  ) : (
                    <div className='w-56 h-56 flex items-center justify-center text-slate-500 text-sm'>
                      Đang sinh mã QR...
                    </div>
                  )}
                </div>

                {/* Ticket Code Tag */}
                <div className='mb-4'>
                  <div className='font-mono text-xl font-black tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 inline-block px-4 py-1.5 rounded-xl shadow-inner'>
                    {qrModalTicket.ticketCode}
                  </div>
                </div>

                {/* Security Seal */}
                <div className='flex items-center justify-center gap-1.5 text-xs text-blue-400 mb-5'>
                  <span className='material-symbols-outlined text-base'>verified_user</span>
                  Bảo mật HMAC-SHA256 • Chống vé giả mạo
                </div>

                {/* Details Table */}
                <div className='bg-[#1a202d] rounded-xl border border-slate-800 p-3.5 text-xs text-slate-300 space-y-2 mb-5 text-left'>
                  <div className='flex justify-between border-b border-slate-800/80 pb-1.5'>
                    <span className='text-slate-400'>Hạng vé:</span>
                    <strong className='text-white'>{qrModalTicket.ticketName}</strong>
                  </div>
                  <div className='flex justify-between border-b border-slate-800/80 pb-1.5'>
                    <span className='text-slate-400'>Chỗ ngồi:</span>
                    <strong className='text-emerald-400'>
                      {qrModalTicket.seat ? `Ghế ${qrModalTicket.seat}` : 'Khu đứng (GA)'}
                    </strong>
                  </div>
                  <div className='flex justify-between border-b border-slate-800/80 pb-1.5'>
                    <span className='text-slate-400'>Thời gian:</span>
                    <strong className='text-white'>{fmtDateTime(qrModalTicket.sessionStart)}</strong>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-slate-400'>Trạng thái:</span>
                    <strong className='text-blue-300'>{qrModalTicket.status || 'Hợp lệ'}</strong>
                  </div>
                </div>

                <p className='text-[11px] text-slate-500 mb-5 leading-normal'>
                  * Xuất trình mã QR trực tiếp trên màn hình này tại cổng kiểm soát. Hệ thống sẽ quét và xác minh vé tức
                  thì.
                </p>

                {/* Modal Actions */}
                <div className='flex gap-3'>
                  <button
                    onClick={() => window.print()}
                    className='flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer'>
                    <span className='material-symbols-outlined text-base'>print</span>
                    In vé / Lưu PDF
                  </button>
                  <button
                    onClick={() => setQrModalTicket(null)}
                    className='bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer'>
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 5. MODAL 2: BÁN LẠI VÉ TRÊN CHỢ RESALE (UC30 Integration)          */}
        {/* ================================================================== */}
        {resaleModalTicket && (
          <div className='fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4'>
            <div className='bg-[#181d28] border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl'>
              <div className='bg-linear-to-r from-amber-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between'>
                <h3 className='text-lg font-bold text-amber-400 flex items-center gap-2'>
                  <span className='material-symbols-outlined text-xl'>sell</span>
                  Đăng bán lại vé trên Chợ thứ cấp
                </h3>
                <button
                  onClick={() => setResaleModalTicket(null)}
                  className='w-8 h-8 rounded-full bg-black/30 hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors cursor-pointer'>
                  <span className='material-symbols-outlined text-lg'>close</span>
                </button>
              </div>

              <form onSubmit={handleSubmitResale} className='p-6 space-y-4 max-h-[80vh] overflow-y-auto'>
                <div className='bg-[#131722] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5'>
                  <div>
                    Sự kiện: <strong className='text-white'>{resaleModalTicket.eventName}</strong> (
                    {resaleModalTicket.ticketName})
                  </div>
                  <div>
                    Giá gốc:{' '}
                    <strong className='text-white'>
                      {Number(resaleModalTicket.ticketPrice).toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                  <div className='text-amber-400 font-medium pt-1'>
                    * Giá bán tối đa:{' '}
                    <strong>{Math.round((resaleModalTicket.ticketPrice || 0) * 1.1).toLocaleString('vi-VN')} ₫</strong>{' '}
                    (110% giá gốc theo quy định chống phe vé).
                  </div>
                </div>

                {/* Bundle Selection */}
                {(() => {
                  const group = sameGroupTickets(resaleModalTicket);
                  return (
                    <div className='bg-[#131722] p-4 rounded-xl border border-slate-800'>
                      <div className='text-xs font-semibold text-slate-300 mb-2'>
                        Chọn vé đăng bán cùng gói ({bundleIds.length}/{group.length}):
                      </div>
                      <div className='space-y-1.5 max-h-32 overflow-y-auto pr-1'>
                        {group.map((t) => (
                          <label
                            key={t._id}
                            className='flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white'>
                            <input
                              type='checkbox'
                              checked={bundleIds.includes(t._id)}
                              onChange={() => toggleBundleTicket(t._id)}
                              className='rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0'
                            />
                            <code className='text-emerald-400 font-mono'>{t.ticketCode}</code>
                          </label>
                        ))}
                      </div>

                      {bundleIds.length > 1 && (
                        <div className='mt-3 pt-3 border-t border-slate-800'>
                          <label className='flex items-center gap-2 text-xs text-slate-300 cursor-pointer'>
                            <input
                              type='checkbox'
                              checked={!allowPartial}
                              onChange={(e) => setAllowPartial(!e.target.checked)}
                              className='rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0'
                            />
                            Không bán lẻ (người mua phải mua nguyên gói {bundleIds.length} vé)
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Resale Price Input */}
                <div>
                  <label className='block text-xs font-semibold text-slate-300 mb-1.5'>Giá bán lại mỗi vé (VNĐ):</label>
                  <input
                    type='number'
                    value={resalePrice}
                    onChange={(e) => setResalePrice(e.target.value)}
                    placeholder='Nhập giá bán lại...'
                    className='w-full bg-[#131722] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500'
                    required
                  />
                </div>

                {/* Bank Account Info */}
                <div className='bg-[#131722] p-4 rounded-xl border border-slate-800 space-y-3'>
                  <div className='text-xs font-semibold text-slate-300'>
                    Tài khoản nhận tiền (Sau khi vé được bán thành công):
                  </div>
                  {[
                    { key: 'bankName', label: 'Tên ngân hàng', placeholder: 'VD: Vietcombank, Techcombank...' },
                    { key: 'accountNo', label: 'Số tài khoản', placeholder: 'Chỉ gồm chữ số' },
                    { key: 'accountHolder', label: 'Tên chủ tài khoản', placeholder: 'VD: NGUYEN VAN A' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className='block text-[11px] text-slate-400 mb-1'>{f.label}</label>
                      <input
                        type='text'
                        value={payoutBank[f.key]}
                        onChange={(e) =>
                          setPayoutBank((b) => ({
                            ...b,
                            [f.key]: f.key === 'accountHolder' ? e.target.value.toUpperCase() : e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                        required
                        className='w-full bg-[#0d1017] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500'
                      />
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className='flex gap-3 justify-end pt-2'>
                  <button
                    type='button'
                    onClick={() => setResaleModalTicket(null)}
                    className='bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer'>
                    Huỷ
                  </button>
                  <button
                    type='submit'
                    disabled={resaleSubmitting}
                    className='bg-amber-600 hover:bg-amber-500 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-md shadow-amber-600/30 transition-all cursor-pointer disabled:opacity-50'>
                    {resaleSubmitting ? 'Đang xử lý...' : 'Xác nhận đăng bán'}
                  </button>
                </div>
              </form>
            </div>
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
              {(() => {
                const group = sameGroupTickets(resaleModalTicket);
                return (
                  <div style={{ marginBottom: "16px", padding: "12px", background: "#27272a", borderRadius: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#e4e4e7", fontWeight: 600, marginBottom: "8px" }}>
                      Chọn vé đăng bán ({bundleIds.length}/{group.length})
                    </div>
                    {group.map((t) => (
                      <label key={t._id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#d4d4d8", marginBottom: "4px", cursor: "pointer" }}>
                        <input type="checkbox" checked={bundleIds.includes(t._id)} onChange={() => toggleBundleTicket(t._id)} />
                        <code style={{ color: "#4ade80" }}>{t.ticketCode}</code>
                      </label>
                    ))}
                    {bundleIds.length > 1 && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #3f3f46" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#e4e4e7", cursor: "pointer" }}>
                          <input type="checkbox" checked={!allowPartial} onChange={(e) => setAllowPartial(!e.target.checked)} />
                          Không bán lẻ (người mua phải mua hết {bundleIds.length} vé)
                        </label>
                        <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
                          {allowPartial ? "Người mua có thể mua từng vé trong gói." : "Gói sẽ chỉ bán nguyên cả gói."}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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

              <div style={{ marginBottom: "16px", padding: "12px", background: "#27272a", borderRadius: "8px" }}>
                <div style={{ fontSize: "13px", color: "#e4e4e7", fontWeight: 600, marginBottom: "4px" }}>
                  Tài khoản nhận tiền khi bán thành công
                </div>
                <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "10px" }}>
                  Người mua thanh toán cho EventTick, sau đó quản trị viên chuyển tiền vào tài khoản này.
                </div>
                {[
                  { key: "bankName", label: "Ngân hàng", placeholder: "VD: Vietcombank", mode: "text" },
                  { key: "accountNo", label: "Số tài khoản", placeholder: "Chỉ gồm chữ số", mode: "numeric" },
                  { key: "accountHolder", label: "Chủ tài khoản", placeholder: "VD: NGUYEN VAN A", mode: "text" },
                ].map((f) => (
                  <div key={f.key} style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "#d4d4d8", marginBottom: "4px" }}>{f.label}</label>
                    <input
                      type="text"
                      inputMode={f.mode}
                      value={payoutBank[f.key]}
                      onChange={(e) =>
                        setPayoutBank((b) => ({
                          ...b,
                          [f.key]: f.key === "accountHolder" ? e.target.value.toUpperCase() : e.target.value,
                        }))
                      }
                      placeholder={f.placeholder}
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#18181b",
                        border: "1px solid #52525b",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                ))}
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

    </div>
  );
};

export default MyTicketPage;
