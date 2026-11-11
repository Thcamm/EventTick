import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  ShieldCheck,
  Music,
  Clock,
  Calendar,
  MapPin,
  Armchair,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  Info,
  CreditCard,
  QrCode,
  CheckCircle,
  X,
} from 'lucide-react';
import { EVENTS_DB, SEAT_TIERS, OCCUPIED_SET } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import EventReviews from '../../components/EventReviews';

export default function EventDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();

  const eventId = Number(id) || 26756;
  const detailEvent = EVENTS_DB[eventId] || EVENTS_DB[26756];

  const [selectedSeats, setSelectedSeats] = useState(new Map());
  const [highlightTier, setHighlightTier] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedSeats(new Map());
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && checkoutModalOpen) {
        setCheckoutModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkoutModalOpen]);

  const toggleSeat = (code, row, padNum, tierKey) => {
    if (OCCUPIED_SET.has(code)) return;

    setSelectedSeats((prev) => {
      const next = new Map(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        if (next.size >= 4) {
          showToast('Bạn chỉ có thể chọn tối đa 4 ghế trong một lần đặt.');
          return prev;
        }
        const tier = SEAT_TIERS[tierKey];
        next.set(code, {
          code,
          row,
          num: padNum,
          tierKey,
          tierName: tier.name,
          price: tier.price,
        });
      }
      return next;
    });
  };

  const resetSeats = () => {
    setSelectedSeats(new Map());
    showToast('Đã xóa danh sách ghế đang chọn.');
  };

  const seatSubtotal = useMemo(() => {
    let sum = 0;
    selectedSeats.forEach((s) => (sum += s.price));
    return sum;
  }, [selectedSeats]);

  return (
    <div>
      {/* Detail Top Sub-Header */}
      <div className='bg-white border-b border-[#e4e4e7] py-3'>
        <div className='tb-container flex items-center justify-between'>
          <div className='flex items-center gap-2 text-sm text-[#71717a]'>
            <Link to={PATHS.HOME} className='hover:text-black flex items-center gap-1 font-semibold'>
              <ArrowLeft size={14} />
              <span>Về trang chủ</span>
            </Link>
            <span>/</span>
            <span className='text-[#09090b] font-semibold truncate max-w-xs md:max-w-md'>{detailEvent.name}</span>
          </div>

          <button
            type='button'
            className='tb-btn tb-btn-outline tb-btn-sm'
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Đã sao chép liên kết sự kiện');
            }}>
            <Share2 size={14} />
            <span>Chia sẻ</span>
          </button>
        </div>
      </div>

      {/* Event Hero Overview */}
      <section className='event-hero-section'>
        <div className='tb-container'>
          <div className='event-hero-grid'>
            <div className='event-poster-wrap'>
              <img
                src={detailEvent.image}
                alt={detailEvent.name}
                className='event-poster-img'
                onError={(e) => {
                  e.currentTarget.src = '/assets/banners/hero_0.jpg';
                }}
              />
            </div>

            <div className='event-info-col'>
              <div className='event-badges-row'>
                <span className='badge-tag badge-dark'>
                  <ShieldCheck size={13} />
                  <span>Vé chính thức</span>
                </span>
                <span className='badge-tag badge-light'>
                  <Music size={13} />
                  <span>{detailEvent.category}</span>
                </span>
                <span className='badge-tag badge-light'>
                  <Clock size={13} />
                  <span>Đang mở bán</span>
                </span>
              </div>

              <h1 className='event-detail-title'>{detailEvent.name}</h1>

              <div className='event-meta-cards'>
                <div className='meta-card-item'>
                  <div className='meta-card-icon'>
                    <Calendar size={16} />
                  </div>
                  <div className='meta-card-text'>
                    <span className='meta-card-label'>Thời gian diễn ra</span>
                    <span className='meta-card-value'>{detailEvent.date}</span>
                  </div>
                </div>

                <div className='meta-card-item'>
                  <div className='meta-card-icon'>
                    <MapPin size={16} />
                  </div>
                  <div className='meta-card-text'>
                    <span className='meta-card-label'>Địa điểm tổ chức</span>
                    <span className='meta-card-value'>{detailEvent.venue}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  marginTop: '6px',
                }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11.5px', color: '#71717a', textTransform: 'uppercase', fontWeight: 700 }}>
                    Giá vé niêm yết
                  </span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#09090b', letterSpacing: '-0.5px' }}>
                    {detailEvent.priceRange}
                  </span>
                </div>
                <button
                  type='button'
                  className='tb-btn tb-btn-solid'
                  style={{ height: '44px', padding: '0 22px' }}
                  onClick={() => {
                    document.getElementById('seatingSection')?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                  <Armchair size={16} />
                  <span>Chọn ghế trực quan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEAT MAP & SIDEBAR SECTION */}
      <section style={{ padding: '36px 0 60px' }} id='seatingSection'>
        <div className='tb-container'>
          <div className='layout-split'>
            {/* LEFT: SEAT MAP CONTAINER */}
            <div className='seatmap-section-card'>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #e4e4e7',
                  gap: '12px',
                }}>
                <div>
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                    <LayoutGrid size={20} />
                    <span>Sơ đồ chọn ghế ngồi trực quan</span>
                  </h2>
                  <p style={{ fontSize: '13px', color: '#71717a', marginTop: '2px' }}>
                    Nhấp vào ghế còn trống để chọn chỗ (Tối đa 4 ghế/lần đặt)
                  </p>
                </div>
                <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={resetSeats}>
                  <RotateCcw size={13} />
                  <span>Đặt lại</span>
                </button>
              </div>

              {/* Legend bar */}
              <div className='legend-bar'>
                <div className='legend-item'>
                  <span className='seat-sample sample-available' />
                  <span>Ghế trống</span>
                </div>
                <div className='legend-item'>
                  <span className='seat-sample sample-selected'>✓</span>
                  <span>Đang chọn</span>
                </div>
                <div className='legend-item'>
                  <span className='seat-sample sample-occupied'>✕</span>
                  <span>Đã bán</span>
                </div>
              </div>

              {/* Zone tier pills */}
              <div className='tier-legend-list'>
                {Object.entries(SEAT_TIERS).map(([tierKey, tier]) => (
                  <button
                    key={tierKey}
                    type='button'
                    className={`tier-legend-pill ${highlightTier === tierKey ? 'highlighted' : ''}`}
                    onClick={() => {
                      setHighlightTier((prev) => (prev === tierKey ? null : tierKey));
                      showToast(`Khu vực: ${tier.name} - ${tier.price.toLocaleString('vi-VN')} ₫`);
                    }}>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#09090b' }} />
                      <span>{tier.name}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{tier.price.toLocaleString('vi-VN')} ₫</div>
                  </button>
                ))}
              </div>

              {/* Stage */}
              <div style={{ margin: '0 auto 32px', textAlign: 'center', maxWidth: '500px' }}>
                <div className='stage-board'>
                  <Sparkles size={15} />
                  <span>SÂN KHẤU CHÍNH / MAIN STAGE</span>
                  <Sparkles size={15} />
                </div>
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '10px' }}>▼ Hướng nhìn khán đài ▼</div>
              </div>

              {/* Seating Matrix */}
              <div className='seat-grid-scroll-wrap'>
                <div className='seat-grid-inner'>
                  {[
                    { row: 'A', tierKey: 'VIP-DIAMOND' },
                    { row: 'B', tierKey: 'VIP-DIAMOND' },
                    { row: 'C', tierKey: 'VIP-DIAMOND' },
                    { row: 'D', tierKey: 'VIP-PLATINUM' },
                    { row: 'E', tierKey: 'VIP-PLATINUM' },
                    { row: 'F', tierKey: 'VIP-PLATINUM' },
                    { row: 'G', tierKey: 'CAT-1' },
                    { row: 'H', tierKey: 'CAT-1' },
                    { row: 'J', tierKey: 'CAT-1' },
                    { row: 'K', tierKey: 'CAT-2' },
                    { row: 'L', tierKey: 'CAT-2' },
                    { row: 'M', tierKey: 'CAT-2' },
                  ].map(({ row, tierKey }) => {
                    const isTierHighlighted = !highlightTier || highlightTier === tierKey;

                    return (
                      <div key={row} className='seat-row' style={{ opacity: isTierHighlighted ? 1 : 0.45 }}>
                        <div className='row-label'>{row}</div>

                        <div className='row-seats-group'>
                          {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                            const padNum = num < 10 ? `0${num}` : `${num}`;
                            const code = `${row}-${padNum}`;
                            const isOccupied = OCCUPIED_SET.has(code);
                            const isSelected = selectedSeats.has(code);
                            const tier = SEAT_TIERS[tierKey];

                            return (
                              <button
                                key={code}
                                type='button'
                                disabled={isOccupied}
                                className={`seat-node ${
                                  isOccupied ? 'occupied' : isSelected ? 'selected' : 'available'
                                }`}
                                onClick={() => toggleSeat(code, row, padNum, tierKey)}
                                title={`Ghế ${code} • ${tier.name} • ${tier.price.toLocaleString('vi-VN')} ₫`}>
                                {isOccupied ? '✕' : isSelected ? '✓' : padNum}
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ width: '18px', textAlign: 'center', color: '#a1a1aa', fontSize: '10px' }}>
                          •
                        </div>

                        <div className='row-seats-group'>
                          {[8, 9, 10, 11, 12, 13, 14].map((num) => {
                            const padNum = num < 10 ? `0${num}` : `${num}`;
                            const code = `${row}-${padNum}`;
                            const isOccupied = OCCUPIED_SET.has(code);
                            const isSelected = selectedSeats.has(code);
                            const tier = SEAT_TIERS[tierKey];

                            return (
                              <button
                                key={code}
                                type='button'
                                disabled={isOccupied}
                                className={`seat-node ${
                                  isOccupied ? 'occupied' : isSelected ? 'selected' : 'available'
                                }`}
                                onClick={() => toggleSeat(code, row, padNum, tierKey)}
                                title={`Ghế ${code} • ${tier.name} • ${tier.price.toLocaleString('vi-VN')} ₫`}>
                                {isOccupied ? '✕' : isSelected ? '✓' : padNum}
                              </button>
                            );
                          })}
                        </div>

                        <div className='row-label'>{row}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notice */}
              <div
                style={{
                  background: '#f9f9fb',
                  border: '1px solid #e4e4e7',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  marginTop: '24px',
                }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                  <Info size={17} />
                  <span>Lưu ý khi tham gia sự kiện</span>
                </h3>
                <p style={{ fontSize: '13.5px', color: '#52525b', lineHeight: 1.6 }}>
                  Quý khán giả vui lòng đến trước giờ biểu diễn 60 phút để làm thủ tục check-in qua mã QR trên vé
                  điện tử. Mỗi vé tương ứng với 01 vị trí ghế cố định trên khán đài.
                </p>
              </div>
            </div>

            {/* RIGHT: SIDEBAR SUMMARY */}
            <aside className='booking-summary-sidebar'>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e4e4e7',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                <span>Ghế đã chọn</span>
                <span style={{ fontSize: '13px', color: '#71717a' }}>{selectedSeats.size}/4 ghế</span>
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  minHeight: '120px',
                  marginBottom: '20px',
                }}>
                {selectedSeats.size === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '120px',
                      color: '#71717a',
                      fontSize: '13px',
                      textAlign: 'center',
                      gap: '8px',
                      border: '1.5px dashed #e4e4e7',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                    }}>
                    <Armchair size={24} className='text-[#a1a1aa]' />
                    <span>Bạn chưa chọn ghế nào. Vui lòng bấm chọn ghế trên sơ đồ khán phòng.</span>
                  </div>
                ) : (
                  Array.from(selectedSeats.values()).map((seat) => (
                    <div
                      key={seat.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f9f9fb',
                        border: '1px solid #e4e4e7',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                      }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800 }}>Ghế {seat.code}</div>
                        <div style={{ fontSize: '11.5px', color: '#71717a' }}>{seat.tierName}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800 }}>
                          {seat.price.toLocaleString('vi-VN')} ₫
                        </span>
                        <button
                          type='button'
                          onClick={() => toggleSeat(seat.code, seat.row, seat.num, seat.tierKey)}
                          className='text-[#71717a] hover:text-black p-1'
                          title='Bỏ chọn ghế'>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Calculations */}
              <div
                style={{
                  borderTop: '1px solid #e4e4e7',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '13.5px',
                  marginBottom: '20px',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52525b' }}>
                  <span>Tạm tính vé:</span>
                  <span>{seatSubtotal.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52525b' }}>
                  <span>Phí dịch vụ:</span>
                  <span style={{ fontWeight: 700 }}>Miễn phí</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #e4e4e7',
                    paddingTop: '12px',
                    fontSize: '16px',
                    fontWeight: 800,
                  }}>
                  <span>Tổng cộng:</span>
                  <span style={{ fontSize: '20px' }}>{seatSubtotal.toLocaleString('vi-VN')} ₫</span>
                </div>
              </div>

              <button
                type='button'
                disabled={selectedSeats.size === 0}
                className='tb-btn tb-btn-solid w-full'
                style={{ height: '46px', borderRadius: 'var(--radius-md)', fontSize: '14.5px' }}
                onClick={() => setCheckoutModalOpen(true)}>
                <CreditCard size={16} />
                <span>{selectedSeats.size === 0 ? 'Vui lòng chọn ghế' : `Tiếp tục đặt ${selectedSeats.size} ghế`}</span>
              </button>
            </aside>
          </div>

          {/* Reviews & Ratings Section (UC34) */}
          <EventReviews eventId={id || eventId} />
        </div>
      </section>

      {/* SEAT CHECKOUT MODAL */}
      {checkoutModalOpen && (
        <div
          className='modal-overlay'
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutModalOpen(false);
          }}>
          <div className='modal-box'>
            <div className='modal-header'>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className='modal-title'>Xác nhận đặt ghế</h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#71717a',
                    background: '#f4f4f6',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid #e4e4e7',
                  }}>
                  Mô phỏng
                </span>
              </div>
              <button type='button' className='modal-close-btn' onClick={() => setCheckoutModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className='modal-body'>
              <div
                style={{
                  background: '#f9f9fb',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e4e4e7',
                  marginBottom: '18px',
                }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>{detailEvent.name}</h4>
                <div style={{ fontSize: '12.5px', color: '#71717a', marginBottom: '8px' }}>
                  {detailEvent.date} • {detailEvent.venue}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  Danh sách ghế: <span className='text-black'>{Array.from(selectedSeats.keys()).join(', ')}</span>
                </div>
              </div>

              <h4
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  letterSpacing: '0.5px',
                }}>
                Phương thức thanh toán (Demo)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    border: '1.5px solid #09090b',
                    borderRadius: 'var(--radius-md)',
                    background: '#fafafa',
                    cursor: 'pointer',
                  }}>
                  <input type='radio' name='pay' defaultChecked style={{ accentColor: '#09090b' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Chuyển khoản VietQR / Napas247</div>
                    <div style={{ fontSize: '11.5px', color: '#71717a' }}>
                      Quét mã QR thanh toán tức thì trên mọi App Ngân hàng
                    </div>
                  </div>
                  <QrCode size={18} />
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    border: '1px solid #e4e4e7',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}>
                  <input type='radio' name='pay' style={{ accentColor: '#09090b' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Thẻ ATM nội địa / Internet Banking</div>
                    <div style={{ fontSize: '11.5px', color: '#71717a' }}>Hỗ trợ hơn 40 ngân hàng tại Việt Nam</div>
                  </div>
                  <CreditCard size={18} />
                </label>
              </div>
            </div>

            <div className='modal-footer'>
              <div>
                <div className='modal-total-label'>Tổng thanh toán</div>
                <div className='modal-total-val'>{seatSubtotal.toLocaleString('vi-VN')} ₫</div>
              </div>
              <button
                type='button'
                className='tb-btn tb-btn-solid'
                onClick={() => {
                  setCheckoutModalOpen(false);
                  const seatsList = Array.from(selectedSeats.keys()).join(', ');
                  setSelectedSeats(new Map());
                  showToast(`[Mô phỏng] Đã đặt thành công ${selectedSeats.size} ghế: ${seatsList}!`);
                }}>
                <CheckCircle size={16} />
                <span>Xác nhận đặt vé</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
