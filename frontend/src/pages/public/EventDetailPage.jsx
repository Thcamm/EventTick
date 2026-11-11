import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  ShieldCheck,
  Clock,
  Calendar,
  MapPin,
  Armchair,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  Info,
  Minus,
  Plus,
  Ticket,
  Tag,
  X,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../../api/client';
import { eventsService } from '../../services/events.service';
import SeatMapView from '../../features/seatmap/SeatMapView';
import SectionTickets from '../../features/seatmap/SectionTickets';
import { colorSections } from '../../features/seatmap/colors';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';

const MAX_SEATS = 6;
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [seatData, setSeatData] = useState({ seats: [], tiers: [] });
  const [selectedSeats, setSelectedSeats] = useState(new Map());
  const [gaQty, setGaQty] = useState({});
  const [mapInfo, setMapInfo] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [highlightTier, setHighlightTier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState(null); // { code, discount, total } đã được server xác nhận
  const [voucherBusy, setVoucherBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    window.scrollTo({ top: 0 });
    setLoading(true);
    setError('');
    eventsService
      .detail(id)
      .then((r) => {
        if (!alive) return;
        setEvent(r.event);
        setSessionId(r.event?.sessions?.[0]?.id || null);
      })
      .catch((e) => alive && setError(e.message || 'Không tải được sự kiện'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const session = useMemo(() => event?.sessions?.find((s) => s.id === sessionId) || null, [event, sessionId]);
  const zones = useMemo(() => session?.zones || [], [session]);
  const gaZones = zones.filter((z) => z.zoneType !== 'SEATED');
  const hasSeated = zones.some((z) => z.zoneType === 'SEATED');

  const loadSeats = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [seatsRes, mapRes] = await Promise.allSettled([
        api.get(`/events/sessions/${sessionId}/seats`),
        api.get(`/events/sessions/${sessionId}/seat-map`),
      ]);
      const r = seatsRes.status === 'fulfilled' ? seatsRes.value : {};
      setSeatData({ seats: r.seats || [], tiers: r.tiers || [] });
      setMapInfo(mapRes.status === 'fulfilled' && mapRes.value?.hasMap ? mapRes.value : null);
    } catch {
      setSeatData({ seats: [], tiers: [] });
      setMapInfo(null);
    }
  }, [sessionId]);

  useEffect(() => {
    setSelectedSeats(new Map());
    setGaQty({});
    setHighlightTier(null);
    setActiveSectionId(null);
    if (hasSeated || event?.has_seat_map) loadSeats();
    else {
      setSeatData({ seats: [], tiers: [] });
      setMapInfo(null);
    }
  }, [sessionId, hasSeated, event?.has_seat_map, loadSeats]);

  const hasMapView = !!(mapInfo?.hasMap && mapInfo.svgContent);
  // Sơ đồ chỉ có khu đứng (không có ghế đánh số): dùng chữ "khu / chỗ đứng" thay vì "ghế"
  const onlyStanding = hasMapView && !(mapInfo.sections || []).some((m) => m.type === 'SEATED');
  const mapSections = useMemo(() => (hasMapView ? colorSections(mapInfo.sections || []) : []), [hasMapView, mapInfo]);
  const activeSection = mapSections.find((m) => m.sectionId === activeSectionId) || null;
  const selectedSeatIds = useMemo(() => new Set([...selectedSeats.keys()].map(String)), [selectedSeats]);
  const selectedCountBySection = useMemo(() => {
    const out = {};
    selectedSeats.forEach((st) => {
      out[st.section] = (out[st.section] || 0) + 1;
    });
    mapSections.forEach((m) => {
      if (m.type === 'GA' && gaQty[m.tierId]) out[m.sectionId] = (out[m.sectionId] || 0) + gaQty[m.tierId];
    });
    return out;
  }, [selectedSeats, mapSections, gaQty]);

  const tierById = useMemo(() => Object.fromEntries(seatData.tiers.map((t) => [String(t._id), t])), [seatData.tiers]);

  // Nhóm ghế theo khu + hàng
  const rows = useMemo(() => {
    const m = new Map();
    for (const s of seatData.seats) {
      const key = `${s.section || ''}||${s.row}`;
      if (!m.has(key)) m.set(key, { section: s.section, row: s.row, seats: [] });
      m.get(key).seats.push(s);
    }
    const list = [...m.values()];
    list.forEach((r) => r.seats.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true })));
    return list.sort((a, b) => `${a.section}${a.row}`.localeCompare(`${b.section}${b.row}`, undefined, { numeric: true }));
  }, [seatData.seats]);

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return;
    setSelectedSeats((prev) => {
      const next = new Map(prev);
      if (next.has(seat._id)) next.delete(seat._id);
      else {
        if (next.size >= MAX_SEATS) {
          showToast(`Bạn chỉ có thể chọn tối đa ${MAX_SEATS} ghế trong một lần đặt.`);
          return prev;
        }
        const tier = tierById[String(seat.tierId)];
        next.set(seat._id, {
          id: seat._id,
          label: `${seat.section ? seat.section + ' · ' : ''}${seat.row}-${seat.number}`,
          tierId: seat.tierId,
          section: seat.section,
          tierName: tier?.name || 'Ghế',
          price: tier?.price || 0,
        });
      }
      return next;
    });
  };

  const setQty = (zone, delta) => {
    setGaQty((prev) => {
      const cur = prev[zone.id] || 0;
      const max = Math.min(zone.maxPerOrder || 10, zone.remaining ?? 10);
      const next = Math.max(0, Math.min(max, cur + delta));
      if (delta > 0 && next === cur) showToast(`Tối đa ${max} vé cho hạng "${zone.name}"`);
      return { ...prev, [zone.id]: next };
    });
  };

  const gaItems = gaZones.filter((z) => (gaQty[z.id] || 0) > 0).map((z) => ({ zone: z, quantity: gaQty[z.id] }));
  const seatList = [...selectedSeats.values()];
  const total = seatList.reduce((s, x) => s + x.price, 0) + gaItems.reduce((s, x) => s + x.zone.price * x.quantity, 0);
  const count = seatList.length + gaItems.reduce((s, x) => s + x.quantity, 0);
  const discount = voucher ? Math.min(voucher.discount, total) : 0;
  const payable = Math.max(0, total - discount);

  // Đổi vé / ghế thì mã đã áp có thể không còn đúng (đơn tối thiểu, mức giảm): bỏ xác nhận cũ để khách áp lại
  useEffect(() => {
    setVoucher(null);
  }, [total, sessionId]);

  const applyVoucher = async () => {
    const code = voucherInput.trim();
    if (!user) {
      showToast('Vui lòng đăng nhập để dùng mã giảm giá');
      navigate(PATHS.LOGIN);
      return;
    }
    if (!code) return showToast('Nhập mã giảm giá');
    if (total <= 0) return showToast('Hãy chọn vé trước khi áp dụng mã');
    setVoucherBusy(true);
    try {
      const r = await api.post('/booking/voucher-preview', { eventId: event.id, code, subtotal: total });
      setVoucher({ code: r.code, discount: r.discount, total: r.total });
      showToast(`Đã áp dụng mã ${r.code}: giảm ${money(r.discount)}`);
    } catch (e) {
      setVoucher(null);
      showToast(e.message || 'Mã giảm giá không hợp lệ');
    } finally {
      setVoucherBusy(false);
    }
  };

  const resetAll = () => {
    setSelectedSeats(new Map());
    setGaQty({});
    setVoucher(null);
    showToast('Đã xóa lựa chọn.');
  };

  const handleBook = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để đặt vé');
      navigate(PATHS.LOGIN);
      return;
    }
    if (count === 0) return;
    const items = [
      ...gaItems.map((x) => ({ tierId: x.zone.id, quantity: x.quantity })),
      ...(seatList.length ? [{ seatIds: seatList.map((s) => s.id) }] : []),
    ];
    setSubmitting(true);
    try {
      const r = await api.post('/booking', { eventId: event.id, sessionId, items, ...(voucher ? { voucherCode: voucher.code } : {}) });
      showToast('Đã giữ chỗ 10 phút. Vui lòng hoàn tất thông tin đặt vé.');
      navigate(`/checkout/${r.orderId}`);
    } catch (e) {
      showToast(e.message || 'Không thể đặt vé');
      if (hasSeated) loadSeats();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className='tb-container' style={{ padding: '60px 0', color: '#71717a' }}>Đang tải sự kiện...</div>;
  if (error || !event)
    return (
      <div className='tb-container' style={{ padding: '60px 0' }}>
        <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error || 'Không tìm thấy sự kiện'}</p>
        <Link to={PATHS.HOME} className='tb-btn tb-btn-outline'>
          Về trang chủ
        </Link>
      </div>
    );

  const lowest = event.lowestPrice || 0;

  return (
    <div>
      <div className='bg-white border-b border-[#e4e4e7] py-3'>
        <div className='tb-container flex items-center justify-between'>
          <div className='flex items-center gap-2 text-sm text-[#71717a]'>
            <Link to={PATHS.HOME} className='hover:text-black flex items-center gap-1 font-semibold'>
              <ArrowLeft size={14} />
              <span>Về trang chủ</span>
            </Link>
            <span>/</span>
            <span className='text-[#09090b] font-semibold truncate max-w-xs md:max-w-md'>{event.title}</span>
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

      <section className='event-hero-section'>
        <div className='tb-container'>
          <div className='event-hero-grid'>
            <div className='event-poster-wrap'>
              <img
                src={event.thumbnail_url || event.banner_url}
                alt={event.title}
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
                  <Clock size={13} />
                  <span>Đang mở bán</span>
                </span>
              </div>
              <h1 className='event-detail-title'>{event.title}</h1>
              <div className='event-meta-cards'>
                <div className='meta-card-item'>
                  <div className='meta-card-icon'>
                    <Calendar size={16} />
                  </div>
                  <div className='meta-card-text'>
                    <span className='meta-card-label'>Thời gian diễn ra</span>
                    <span className='meta-card-value'>{fmtTime(session?.startTime || event.start_time)}</span>
                  </div>
                </div>
                <div className='meta-card-item'>
                  <div className='meta-card-icon'>
                    <MapPin size={16} />
                  </div>
                  <div className='meta-card-text'>
                    <span className='meta-card-label'>Địa điểm tổ chức</span>
                    <span className='meta-card-value'>{event.eventAddress}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11.5, color: '#71717a', textTransform: 'uppercase', fontWeight: 700 }}>
                    Giá vé niêm yết
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                    {lowest > 0 ? `Từ ${money(lowest)}` : 'Miễn phí'}
                  </span>
                </div>
                <button
                  type='button'
                  className='tb-btn tb-btn-solid'
                  style={{ height: 44, padding: '0 22px' }}
                  onClick={() => document.getElementById('seatingSection')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Ticket size={16} />
                  <span>Chọn vé</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '36px 0 60px' }} id='seatingSection'>
        <div className='tb-container'>
          {event.sessions?.length > 1 && (
            <div className='tier-legend-list' style={{ marginBottom: 20 }}>
              {event.sessions.map((s) => (
                <button
                  key={s.id}
                  type='button'
                  className={`tier-legend-pill ${s.id === sessionId ? 'highlighted' : ''}`}
                  onClick={() => setSessionId(s.id)}>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>{s.name}</div>
                  <div style={{ fontSize: 12 }}>{fmtTime(s.startTime)}</div>
                </button>
              ))}
            </div>
          )}

          <div className='layout-split'>
            <div className='seatmap-section-card'>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: '1px solid #e4e4e7',
                  gap: 12,
                }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LayoutGrid size={20} />
                    <span>{onlyStanding ? 'Sơ đồ khu vực chỗ đứng' : hasSeated || hasMapView ? 'Sơ đồ chọn ghế ngồi trực quan' : 'Chọn hạng vé'}</span>
                  </h2>
                  <p style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>
                    {!session
                      ? 'Chưa có suất diễn'
                      : onlyStanding
                        ? 'Bấm vào khu bạn muốn đứng để chọn số lượng vé'
                        : hasSeated || hasMapView
                        ? `Nhấp vào vị trí ghế còn trống để chọn chỗ (Tối đa ${MAX_SEATS} ghế/lần đặt)`
                        : `${session.name} · ${fmtTime(session.startTime)}`}
                  </p>
                </div>
                <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={resetAll}>
                  <RotateCcw size={13} />
                  <span>Đặt lại</span>
                </button>
              </div>

              {!session && <p style={{ color: '#71717a' }}>Sự kiện chưa có suất diễn nào mở bán.</p>}

              {(hasSeated || hasMapView) && (
                <>
                  {!onlyStanding && (
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
                      <span>Đã bán / đang giữ</span>
                    </div>
                  </div>
                  )}

                  <div className='tier-legend-list'>
                    {seatData.tiers.map((t) => (
                      <button
                        key={t._id}
                        type='button'
                        className={`tier-legend-pill ${highlightTier === t._id ? 'highlighted' : ''}`}
                        onClick={() => setHighlightTier((p) => (p === t._id ? null : t._id))}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.zoneColor || '#09090b' }} />
                          <span>{t.name}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{money(t.price)}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {gaZones.length > 0 && !hasMapView && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {gaZones.map((z) => {
                    const qty = gaQty[z.id] || 0;
                    const soldOut = (z.remaining ?? 0) <= 0;
                    return (
                      <div
                        key={z.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          border: '1px solid #e4e4e7',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px',
                          opacity: soldOut ? 0.55 : 1,
                        }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{z.name}</div>
                          <div style={{ fontSize: 12, color: '#71717a' }}>
                            {soldOut ? 'Hết vé' : `Còn ${z.remaining} vé`}
                            {z.desc && z.desc !== `Vé hạng ${z.name}` ? ` · ${z.desc}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <strong>{money(z.price)}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type='button'
                              className='tb-btn tb-btn-outline tb-btn-sm'
                              disabled={qty === 0}
                              onClick={() => setQty(z, -1)}
                              aria-label='Giảm'>
                              <Minus size={13} />
                            </button>
                            <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 800 }}>{qty}</span>
                            <button
                              type='button'
                              className='tb-btn tb-btn-outline tb-btn-sm'
                              disabled={soldOut}
                              onClick={() => setQty(z, 1)}
                              aria-label='Tăng'>
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasMapView && (
                <div style={{ position: 'relative' }}>
                  <SeatMapView
                    svgContent={mapInfo.svgContent}
                    sections={mapSections}
                    seats={seatData.seats}
                    selectedSeatIds={selectedSeatIds}
                    selectedCount={selectedCountBySection}
                    highlightTierId={highlightTier}
                    onToggleSeat={toggleSeat}
                    onSelectSection={(sec) => setActiveSectionId(sec.sectionId)}
                  />
                  {activeSection && activeSection.type === 'GA' && (
                    <div className='sm-ga-overlay' onClick={() => setActiveSectionId(null)}>
                      <div onClick={(e) => e.stopPropagation()}>
                        <SectionTickets
                          section={activeSection}
                          quantity={gaQty[activeSection.tierId] || 0}
                          onChange={(delta) => {
                            const zone = gaZones.find((z) => String(z.id) === String(activeSection.tierId));
                            if (zone) setQty(zone, delta);
                          }}
                          onBack={() => setActiveSectionId(null)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasSeated && !hasMapView && (
                <>

                  <div style={{ margin: '0 auto 32px', textAlign: 'center', maxWidth: 500 }}>
                    <div className='stage-board'>
                      <Sparkles size={15} />
                      <span>SÂN KHẤU / STAGE</span>
                      <Sparkles size={15} />
                    </div>
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 10 }}>▼ Hướng nhìn khán đài ▼</div>
                  </div>

                  <div className='seat-grid-scroll-wrap'>
                    <div className='seat-grid-inner'>
                      {rows.length === 0 && (
                        <p style={{ color: '#71717a', textAlign: 'center' }}>Suất này chưa có sơ đồ ghế.</p>
                      )}
                      {rows.map((r) => {
                        const dim = highlightTier && String(r.seats[0]?.tierId) !== String(highlightTier);
                        return (
                          <div key={`${r.section}-${r.row}`} className='seat-row' style={{ opacity: dim ? 0.45 : 1 }}>
                            <div className='row-label' title={r.section}>
                              {r.row}
                            </div>
                            <div className='row-seats-group'>
                              {r.seats.map((s) => {
                                const taken = s.status !== 'AVAILABLE';
                                const picked = selectedSeats.has(s._id);
                                const tier = tierById[String(s.tierId)];
                                return (
                                  <button
                                    key={s._id}
                                    type='button'
                                    disabled={taken}
                                    className={`seat-node ${taken ? 'occupied' : picked ? 'selected' : 'available'}`}
                                    onClick={() => toggleSeat(s)}
                                    title={`${s.section || ''} ${s.row}-${s.number} • ${tier?.name || ''} • ${money(tier?.price)}`}>
                                    {taken ? '✕' : picked ? '✓' : s.number}
                                  </button>
                                );
                              })}
                            </div>
                            <div className='row-label'>{r.row}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div
                style={{
                  background: '#f9f9fb',
                  border: '1px solid #e4e4e7',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  marginTop: 24,
                }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={17} />
                  <span>Giới thiệu & lưu ý</span>
                </h3>
                <div
                  style={{ fontSize: 13.5, color: '#52525b', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description || '') }}
                />
                <p style={{ fontSize: 13.5, color: '#52525b', lineHeight: 1.6, marginTop: 10 }}>
                  Vé điện tử có mã QR sẽ được gửi qua email và lưu trong mục &quot;Vé của tôi&quot;. Chỗ được giữ trong 10
                  phút kể từ lúc đặt.
                </p>
              </div>
            </div>

            <aside className='booking-summary-sidebar'>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid #e4e4e7',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                <span>Vé đã chọn</span>
                <span style={{ fontSize: 13, color: '#71717a' }}>{count} vé</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120, marginBottom: 20 }}>
                {count === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 120,
                      color: '#71717a',
                      fontSize: 13,
                      textAlign: 'center',
                      gap: 8,
                      border: '1.5px dashed #e4e4e7',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                    }}>
                    <Armchair size={24} className='text-[#a1a1aa]' />
                    <span>Bạn chưa chọn vé nào.</span>
                  </div>
                ) : (
                  <>
                    {gaItems.map((x) => (
                      <div
                        key={x.zone.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          background: '#f9f9fb',
                          border: '1px solid #e4e4e7',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                        }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{x.zone.name}</div>
                          <div style={{ fontSize: 11.5, color: '#71717a' }}>
                            {x.quantity} × {money(x.zone.price)}
                          </div>
                        </div>
                        <strong>{money(x.zone.price * x.quantity)}</strong>
                      </div>
                    ))}
                    {seatList.map((s) => (
                      <div
                        key={s.id}
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
                          <div style={{ fontSize: 13.5, fontWeight: 800 }}>Ghế {s.label}</div>
                          <div style={{ fontSize: 11.5, color: '#71717a' }}>{s.tierName}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong>{money(s.price)}</strong>
                          <button
                            type='button'
                            onClick={() =>
                              setSelectedSeats((p) => {
                                const n = new Map(p);
                                n.delete(s.id);
                                return n;
                              })
                            }
                            className='text-[#71717a] hover:text-black p-1'
                            title='Bỏ chọn'>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 14, marginBottom: 14 }}>
                <label
                  htmlFor='voucher-code'
                  style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#52525b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Tag size={13} /> Mã giảm giá
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id='voucher-code'
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyVoucher())}
                    placeholder='Nhập mã'
                    maxLength={30}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', background: '#f4f4f6', border: '1px solid transparent', borderRadius: 8, fontSize: 13.5, outline: 'none', textTransform: 'uppercase' }}
                  />
                  <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={voucherBusy || count === 0} onClick={applyVoucher}>
                    {voucherBusy ? '...' : 'Áp dụng'}
                  </button>
                </div>
                {voucher && (
                  <div style={{ marginTop: 8, fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Đã áp dụng <strong>{voucher.code}</strong>
                    </span>
                    <button type='button' onClick={() => setVoucher(null)} style={{ textDecoration: 'underline', color: '#71717a' }}>
                      Bỏ mã
                    </button>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 14, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {voucher && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#52525b' }}>
                      <span>Tạm tính:</span>
                      <span>{money(total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#52525b' }}>
                      <span>Giảm giá:</span>
                      <span>-{money(discount)}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                  <span>Tổng cộng:</span>
                  <span style={{ fontSize: 20 }}>{money(payable)}</span>
                </div>
              </div>

              <button
                type='button'
                disabled={count === 0 || submitting}
                className='tb-btn tb-btn-solid w-full'
                style={{ height: 46, borderRadius: 'var(--radius-md)', fontSize: 14.5 }}
                onClick={handleBook}>
                {submitting ? 'Đang giữ chỗ...' : user ? 'Đặt vé & thanh toán' : 'Đăng nhập để đặt vé'}
              </button>
              <p style={{ fontSize: 11.5, color: '#71717a', marginTop: 10, textAlign: 'center' }}>
                Chỗ được giữ trong 10 phút sau khi đặt.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
