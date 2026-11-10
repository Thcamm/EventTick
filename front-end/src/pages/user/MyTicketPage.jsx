import React, { useEffect, useState } from 'react';
import { axiosInstance } from '@/services/apiClient';
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import QRCode from 'qrcode';

const MyTicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & filter tab state
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'valid' | 'resale' | 'past'
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [qrModalTicket, setQrModalTicket] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Resale modal states
  const [resaleModalTicket, setResaleModalTicket] = useState(null);
  const [resalePrice, setResalePrice] = useState('');
  const [resaleSubmitting, setResaleSubmitting] = useState(false);
  const [payoutBank, setPayoutBank] = useState({ bankName: '', accountNo: '', accountHolder: '' });
  const [bundleIds, setBundleIds] = useState([]);
  const [allowPartial, setAllowPartial] = useState(true);
  const [, setTick] = useState(0);

  // Auto-refresh countdown for tickets currently reserved in resale
  useEffect(() => {
    if (!tickets.some((t) => t.resale?.status === 'RESERVED')) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tickets]);

  const fetchTickets = async () => {
    try {
      const { data } = await axiosInstance.get('/booking/user/tickets');
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
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
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Lỗi tạo mã QR:', err);
    }
  };

  const sameGroupTickets = (ticket) =>
    tickets.filter(
      (t) =>
        t.rawStatus === 'VALID' &&
        t.validity === 'UPCOMING' &&
        t.eventId === ticket.eventId &&
        t.ticketName === ticket.ticketName &&
        String(t.sessionStart) === String(ticket.sessionStart),
    );

  const handleOpenResaleModal = (ticket) => {
    setResaleModalTicket(ticket);
    setResalePrice(ticket.ticketPrice || '');
    setBundleIds([ticket._id]);
    setAllowPartial(true);
  };

  const toggleBundleTicket = (id) =>
    setBundleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const formatCountdown = (until) => {
    const s = Math.max(0, Math.round((new Date(until) - Date.now()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const fmtDateTime = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDayAndMonth = (d) => {
    if (!d) return { day: '—', month: 'Sự kiện' };
    const date = new Date(d);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('vi-VN', { month: 'short' });
    return { day, month };
  };

  const getStatusBadge = (ticket) => {
    const r = ticket.resale;
    if (ticket.rawStatus === 'RESOLD_INVALID') {
      return r?.payoutStatus === 'PAID'
        ? {
            text: 'Đã bán lại · Đã nhận tiền',
            className: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
            icon: 'check_circle',
          }
        : {
            text: 'Đã bán lại · Chờ nhận tiền',
            className: 'bg-blue-950/80 text-blue-300 border border-blue-500/30',
            icon: 'schedule',
          };
    }
    if (ticket.rawStatus === 'LISTED_RESALE') {
      if (r?.status === 'RESERVED') {
        return {
          text: `Có người đang thanh toán (${formatCountdown(r.reservedUntil)})`,
          className: 'bg-rose-950/80 text-rose-300 border border-rose-500/40 animate-pulse',
          icon: 'hourglass_top',
        };
      }
      if (ticket.validity === 'EXPIRED' || ticket.validity === 'ONGOING' || ticket.validity === 'CANCELLED') {
        return {
          text: 'Đang bán lại · Quá hạn',
          className: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
          icon: 'warning',
        };
      }
      return {
        text: 'Đang bán lại',
        className: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
        icon: 'storefront',
      };
    }
    if (ticket.rawStatus === 'USED') {
      return {
        text: 'Đã check-in',
        className: 'bg-slate-800 text-slate-300 border border-slate-700',
        icon: 'verified',
      };
    }
    if (ticket.rawStatus === 'REFUNDED') {
      return {
        text: 'Đã hoàn tiền',
        className: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
        icon: 'currency_exchange',
      };
    }
    if (ticket.validity === 'CANCELLED') {
      return {
        text: 'Sự kiện bị huỷ',
        className: 'bg-rose-950/80 text-rose-300 border border-rose-500/30',
        icon: 'cancel',
      };
    }
    if (ticket.validity === 'EXPIRED') {
      return {
        text: 'Đã hết hạn',
        className: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
        icon: 'event_busy',
      };
    }
    if (ticket.validity === 'ONGOING') {
      return {
        text: 'Đang diễn ra',
        className: 'bg-sky-950/80 text-sky-300 border border-sky-500/40 animate-pulse',
        icon: 'play_circle',
      };
    }
    return {
      text: 'Chưa sử dụng',
      className: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
      icon: 'check_circle',
    };
  };

  const cancelListing = async (ticket) => {
    if (!ticket.resale?.listingId) return;
    if (!window.confirm('Huỷ đăng bán vé này? Vé sẽ trở về trạng thái chưa sử dụng.')) return;
    try {
      await axiosInstance.delete(`/resale/listings/${ticket.resale.listingId}`);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || 'Không huỷ được tin bán.');
    }
  };

  const handleSubmitResale = async (e) => {
    e.preventDefault();
    if (!resalePrice || Number(resalePrice) <= 0) {
      alert('Vui lòng nhập giá bán lại hợp lệ!');
      return;
    }
    const maxPrice = Math.round((resaleModalTicket.ticketPrice || 0) * 1.1);
    if (Number(resalePrice) > maxPrice) {
      alert(
        `Giá bán lại không được vượt quá 110% giá gốc (${maxPrice.toLocaleString()} ₫) để tuân thủ quy định chống phe vé.`,
      );
      return;
    }
    if (
      !payoutBank.bankName.trim() ||
      !payoutBank.accountHolder.trim() ||
      !/^[0-9]{6,20}$/.test(payoutBank.accountNo.trim())
    ) {
      alert('Vui lòng nhập đủ tài khoản nhận tiền (số tài khoản gồm 6–20 chữ số).');
      return;
    }

    try {
      setResaleSubmitting(true);
      if (!bundleIds.length) {
        alert('Vui lòng chọn ít nhất 1 vé để đăng bán.');
        return;
      }
      await axiosInstance.post('/resale/listings', {
        ticketIds: bundleIds,
        allowPartial,
        resalePrice: Number(resalePrice),
        bankName: payoutBank.bankName.trim(),
        accountNo: payoutBank.accountNo.trim(),
        accountHolder: payoutBank.accountHolder.trim(),
      });
      alert(
        'Đăng bán lại vé thành công lên Chợ vé! Khi có người mua, EventTick sẽ chuyển tiền vào tài khoản bạn đã khai báo.',
      );
      setResaleModalTicket(null);
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể đăng bán vé.');
    } finally {
      setResaleSubmitting(false);
    }
  };

  // Filter logic
  const filteredTickets = tickets.filter((ticket) => {
    // 1. Search term
    const term = searchTerm.trim().toLowerCase();
    const matchSearch =
      !term ||
      ticket.eventName?.toLowerCase().includes(term) ||
      ticket.ticketCode?.toLowerCase().includes(term) ||
      ticket.venueName?.toLowerCase().includes(term);

    if (!matchSearch) return false;

    // 2. Active Tab
    if (activeTab === 'valid') {
      return ticket.rawStatus === 'VALID' && ticket.validity === 'UPCOMING';
    }
    if (activeTab === 'resale') {
      return ticket.rawStatus === 'LISTED_RESALE';
    }
    if (activeTab === 'past') {
      return (
        ticket.rawStatus === 'USED' ||
        ticket.rawStatus === 'RESOLD_INVALID' ||
        ticket.rawStatus === 'REFUNDED' ||
        ticket.validity === 'EXPIRED' ||
        ticket.validity === 'CANCELLED'
      );
    }
    return true;
  });

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
            <Link
              to={PATHS.ADMIN_MY_EVENTS}
              className='text-slate-400 hover:text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors'>
              <span className='material-symbols-outlined text-base'>event</span>
              Sự kiện của tôi
            </Link>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 2. FILTER TABS & SEARCH TOOLBAR                                   */}
        {/* ================================================================== */}
        <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#141822] p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-md mb-8'>
          <div className='flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0'>
            {[
              { id: 'all', label: 'Tất cả', count: tickets.length },
              {
                id: 'valid',
                label: 'Sắp diễn',
                count: tickets.filter((t) => t.rawStatus === 'VALID' && t.validity === 'UPCOMING').length,
              },
              {
                id: 'resale',
                label: 'Đang bán lại',
                count: tickets.filter((t) => t.rawStatus === 'LISTED_RESALE').length,
              },
              {
                id: 'past',
                label: 'Đã qua / Hết hạn',
                count: tickets.filter(
                  (t) =>
                    t.rawStatus === 'USED' ||
                    t.rawStatus === 'RESOLD_INVALID' ||
                    t.rawStatus === 'REFUNDED' ||
                    t.validity === 'EXPIRED' ||
                    t.validity === 'CANCELLED',
                ).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}>
                {tab.label}
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className='relative flex-1 sm:max-w-xs'>
            <span className='material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg'>
              search
            </span>
            <input
              type='text'
              placeholder='Tìm theo sự kiện, mã vé, địa điểm...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='w-full bg-[#0d1017] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors'
            />
          </div>
        </div>

        {/* ================================================================== */}
        {/* 3. TICKET LIST / LOADING / EMPTY STATE                             */}
        {/* ================================================================== */}
        {loading ? (
          <div className='flex flex-col items-center justify-center py-20 gap-4 text-slate-400'>
            <div className='w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin'></div>
            <p className='text-sm font-medium'>Đang tải danh sách vé điện tử...</p>
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className='space-y-6'>
            {filteredTickets.map((ticket, index) => {
              const { day, month } = getDayAndMonth(ticket.sessionStart);
              const badge = getStatusBadge(ticket);
              const canResale = ticket.rawStatus === 'VALID' && ticket.validity === 'UPCOMING';
              const canCancelListing = ticket.rawStatus === 'LISTED_RESALE' && ticket.resale?.status === 'ACTIVE';

              return (
                /* Ticket Card with Perforated Stub Effect */
                <div
                  key={ticket._id || index}
                  className='relative flex flex-col md:flex-row bg-[#181d28] border border-slate-700/60 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-blue-500/40 transition-all duration-300 group'>
                  {/* --- LEFT STUB (item-right in template: Date + QR Preview + Code + Cutouts) --- */}
                  <div
                    onClick={() => handleOpenQrModal(ticket)}
                    className='md:w-64 min-w-55 bg-linear-to-br from-[#1f2636] to-[#141924] p-6 flex flex-col items-center justify-center text-center relative border-b-2 md:border-b-0 md:border-r-2 border-dashed border-slate-700/80 cursor-pointer select-none'>
                    {/* Top Punch Hole Cutout */}
                    <span className='hidden md:block absolute -top-4 -right-4 w-8 h-8 rounded-full bg-[#0b0e14] border border-slate-800/80 shadow-inner z-10'></span>
                    {/* Bottom Punch Hole Cutout */}
                    <span className='hidden md:block absolute -bottom-4 -right-4 w-8 h-8 rounded-full bg-[#0b0e14] border border-slate-800/80 shadow-inner z-10'></span>

                    <span className='text-4xl sm:text-5xl font-black text-white leading-none tracking-tight'>
                      {day}
                    </span>
                    <span className='text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-widest mt-1 mb-3'>
                      {month}
                    </span>

                    {/* Mini QR Box */}
                    <div className='w-24 h-24 bg-white p-2 rounded-xl shadow-md group-hover:scale-105 transition-transform duration-200 flex items-center justify-center mb-3'>
                      <span className='material-symbols-outlined text-slate-800 text-6xl'>qr_code_2</span>
                    </div>

                    <strong className='font-mono text-xs font-bold tracking-widest text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-md'>
                      {ticket.ticketCode || 'TK-UNKNOWN'}
                    </strong>

                    <span className='text-[11px] text-slate-400 mt-2 flex items-center gap-1'>
                      <span className='material-symbols-outlined text-xs'>zoom_in</span> Bấm xem mã QR
                    </span>
                  </div>

                  {/* --- RIGHT CONTENT (item-left in template: Event Details + Meta Grid + Actions) --- */}
                  <div className='flex-1 p-6 sm:p-7 flex flex-col justify-between gap-5'>
                    {/* Header Row: Title & Status Badge */}
                    <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-3'>
                      <div>
                        <h3 className='text-lg sm:text-xl font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1'>
                          <Link to={`/event/${ticket.eventId}`} className='hover:underline'>
                            {ticket.eventName || 'Sự kiện âm nhạc / biểu diễn'}
                          </Link>
                        </h3>
                        <div className='inline-block mt-1'>
                          <span className='text-xs font-semibold text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2.5 py-0.5 rounded-md'>
                            {ticket.ticketName || 'Hạng vé tiêu chuẩn'}
                          </span>
                        </div>
                      </div>

                      <div className='flex items-center gap-2'>
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-sm ${badge.className}`}>
                          <span className='material-symbols-outlined text-sm'>{badge.icon}</span>
                          {badge.text}
                        </span>
                      </div>
                    </div>

                    {/* Meta Grid (Session Time, Venue, Seat) */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#131722]/60 p-3.5 rounded-xl border border-slate-800/80 text-sm text-slate-300'>
                      <div className='flex items-center gap-2'>
                        <span className='material-symbols-outlined text-blue-400 text-lg'>event</span>
                        <div>
                          <div className='text-[11px] text-slate-400 uppercase font-medium'>Thời gian</div>
                          <div className='font-medium text-xs sm:text-sm'>{fmtDateTime(ticket.sessionStart)}</div>
                        </div>
                      </div>

                      <div className='flex items-center gap-2'>
                        <span className='material-symbols-outlined text-blue-400 text-lg'>apartment</span>
                        <div>
                          <div className='text-[11px] text-slate-400 uppercase font-medium'>Địa điểm</div>
                          <div className='font-medium text-xs sm:text-sm line-clamp-1'>
                            {ticket.venueName || 'Đang cập nhật'}
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center gap-2'>
                        <span className='material-symbols-outlined text-purple-400 text-lg'>chair</span>
                        <div>
                          <div className='text-[11px] text-slate-400 uppercase font-medium'>Chỗ ngồi / Ghế</div>
                          <div className='font-bold text-xs sm:text-sm text-white'>
                            {ticket.seat ? `Ghế ${ticket.seat}` : 'Khu đứng (GA)'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Price Tag & Action Buttons */}
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800'>
                      <div className='flex items-baseline gap-2'>
                        <span className='text-xs uppercase tracking-wider text-slate-400 font-medium'>Giá vé:</span>
                        <span className='text-xl font-black text-emerald-400'>
                          {Number(ticket.ticketPrice).toLocaleString('vi-VN')} ₫
                        </span>
                        {ticket.resale?.resalePrice &&
                          ['LISTED_RESALE', 'RESOLD_INVALID'].includes(ticket.rawStatus) && (
                            <span className='text-xs text-amber-400 font-medium ml-2'>
                              (Bán lại: {Number(ticket.resale.resalePrice).toLocaleString('vi-VN')} ₫)
                            </span>
                          )}
                      </div>

                      <div className='flex items-center gap-2.5 flex-wrap'>
                        {/* 📱 Button 1: Xem vé & QR */}
                        <button
                          onClick={() => handleOpenQrModal(ticket)}
                          className='bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer'>
                          <span className='material-symbols-outlined text-base'>qr_code_scanner</span>
                          Xem vé & QR
                        </button>

                        {/* 📥 Button 2: Tải / In vé */}
                        <button
                          onClick={() => handleOpenQrModal(ticket)}
                          className='bg-[#222938] hover:bg-[#2b3345] text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer'
                          title='Tải hoặc in vé điện tử'>
                          <span className='material-symbols-outlined text-base'>print</span>
                          In vé / PDF
                        </button>

                        {/* 🔄 Button 3: Bán lại (Resale) */}
                        {canResale && (
                          <button
                            onClick={() => handleOpenResaleModal(ticket)}
                            className='bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-all cursor-pointer'>
                            <span className='material-symbols-outlined text-base'>sell</span>
                            Đăng bán lại
                          </button>
                        )}

                        {/* ❌ Button 4: Huỷ bán lại */}
                        {canCancelListing && (
                          <button
                            onClick={() => cancelListing(ticket)}
                            className='bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer'>
                            <span className='material-symbols-outlined text-base'>cancel</span>
                            Huỷ bán
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className='text-center py-20 px-6 bg-[#141822] rounded-3xl border border-dashed border-slate-700/80 max-w-md mx-auto'>
            <div className='w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4'>
              <span className='material-symbols-outlined text-3xl'>confirmation_number</span>
            </div>
            <h3 className='text-lg font-bold text-white mb-2'>Không tìm thấy vé nào</h3>
            <p className='text-sm text-slate-400 mb-6 leading-relaxed'>
              Bạn chưa có vé nào trong danh mục này hoặc không khớp với từ khóa tìm kiếm.
            </p>
            <Link
              to={PATHS.HOME}
              className='inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all'>
              <span className='material-symbols-outlined text-base'>explore</span>
              Khám phá sự kiện ngay
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
    </div>
  );
};

export default MyTicketPage;
