import { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Sparkles,
  Music,
  Film,
  Trophy,
  Presentation,
  Compass,
  Layers,
  Calendar,
  MapPin,
  Armchair,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Flame,
  Star,
  ArrowRight,
  Palette,
  Award,
  Briefcase,
  Download,
  X,
  CheckCircle,
} from 'lucide-react';
import { SITE_DATA, getCategoryName } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function HomePage() {
  const { selectedCity = 'TP. Hồ Chí Minh' } = useOutletContext() || {};
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState('all');
  const [timeTab, setTimeTab] = useState('weekend');
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const [bookingEvent, setBookingEvent] = useState(null);
  const [ticketTierMultiplier, setTicketTierMultiplier] = useState(1);
  const [ticketQty, setTicketQty] = useState(1);

  const trendingSliderRef = useRef(null);

  useEffect(() => {
    if (isHeroHovered || bookingEvent) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % SITE_DATA.heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHeroHovered, bookingEvent]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && bookingEvent) setBookingEvent(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingEvent]);

  const matchesFilter = (ev) => {
    const matchesCategory = activeCategory === 'all' || ev.category === activeCategory;
    const matchesCity =
      selectedCity === 'Toàn quốc' ||
      !ev.city ||
      ev.city.includes(selectedCity) ||
      (selectedCity === 'TP. Hồ Chí Minh' && (ev.city.includes('TP.HCM') || ev.city.includes('TP. Hồ Chí Minh')));
    return matchesCategory && matchesCity;
  };

  const openBookingModal = (ev) => {
    setBookingEvent(ev);
    setTicketTierMultiplier(1);
    setTicketQty(1);
  };

  const confirmDemoBooking = () => {
    const count = ticketQty;
    setBookingEvent(null);
    showToast(`[Mô phỏng] Đã ghi nhận đặt ${count} vé (Demo). Không trừ phí thực tế.`);
  };

  const renderCard = (event, isRanked = false) => {
    if (!matchesFilter(event)) return null;

    return (
      <div key={event.id} className='event-card'>
        <button
          type='button'
          onClick={() => navigate(`/events/${event.id}`)}
          className='card-thumb-wrap'
          title={`Xem chi tiết ${event.name || event.title}`}>
          <img
            src={event.image}
            alt={event.name || event.title}
            className='card-thumb'
            loading='lazy'
            onError={(e) => {
              e.currentTarget.src = '/assets/banners/hero_0.jpg';
            }}
          />
          {isRanked && <div className={`rank-badge ${event.rank <= 3 ? 'top-3' : ''}`}>#{event.rank}</div>}
          <div className='card-tag'>{getCategoryName(event.category)}</div>
        </button>

        <div className='card-body'>
          <div className='card-date-row'>
            <Calendar size={13} />
            <span>{event.date}</span>
          </div>

          <h3 className='card-title'>
            <button
              type='button'
              onClick={() => navigate(`/events/${event.id}`)}
              className='hover:underline text-left'
              title={event.name || event.title}>
              {event.name || event.title}
            </button>
          </h3>

          <div className='card-footer-row'>
            <div className='card-price-group'>
              <span className='card-price-label'>Giá từ</span>
              <span className='card-price-val'>{event.price}</span>
            </div>
            <div className='card-city'>
              <MapPin size={12} />
              <span>{event.city}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type='button' className='card-book-btn' onClick={() => openBookingModal(event)}>
              <Ticket size={14} />
              <span>Đặt vé</span>
            </button>
            <button
              type='button'
              className='tb-btn tb-btn-outline tb-btn-sm'
              style={{ height: '38px', borderRadius: 'var(--radius-md)', padding: '0 12px' }}
              title='Xem sơ đồ chọn ghế ngồi'
              onClick={() => navigate(`/events/${event.id}`)}>
              <Armchair size={15} />
              <span className='hidden sm:inline'>Chọn ghế</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* CATEGORY FILTER STRIP */}
      <div className='category-strip'>
        <div className='tb-container'>
          <div className='category-list'>
            {[
              { key: 'all', label: 'Tất cả sự kiện', icon: Sparkles },
              { key: 'music', label: 'Nhạc sống', icon: Music },
              { key: 'theatersandart', label: 'Sân khấu & Nghệ thuật', icon: Film },
              { key: 'sport', label: 'Thể thao', icon: Trophy },
              { key: 'seminarsworkshops', label: 'Hội thảo & Workshop', icon: Presentation },
              { key: 'attractionsexperiences', label: 'Tham quan & Trải nghiệm', icon: Compass },
              { key: 'others', label: 'Khác', icon: Layers },
            ].map((cat) => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.key}
                  type='button'
                  className={`category-pill ${activeCategory === cat.key ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    showToast(`Đang lọc: ${cat.label}`);
                  }}>
                  <CatIcon size={15} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HERO CAROUSEL */}
      <section className='hero-section'>
        <div className='tb-container'>
          <div
            className='hero-carousel-container'
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}>
            <div className='hero-slides'>
              {SITE_DATA.heroBanners.map((banner, idx) => (
                <div key={banner.id} className={`hero-slide ${idx === heroIndex ? 'active' : ''}`}>
                  <div className='hero-content'>
                    <div className='hero-badge'>
                      <Sparkles size={12} />
                      <span>{banner.badge}</span>
                    </div>
                    <h1 className='hero-title'>{banner.title}</h1>
                    <p className='hero-desc'>{banner.subtitle}</p>
                    <div className='hero-meta-row'>
                      <div className='hero-meta-item'>
                        <Calendar size={15} />
                        <span>{banner.date}</span>
                      </div>
                      <div className='hero-meta-item'>
                        <MapPin size={15} />
                        <span>{banner.venue}</span>
                      </div>
                      <div className='hero-meta-item'>
                        <span style={{ color: '#a1a1aa' }}>Giá:</span>
                        <span className='hero-price'>{banner.price}</span>
                      </div>
                    </div>
                    <div className='hero-actions'>
                      <button
                        type='button'
                        className='hero-btn-primary'
                        onClick={() => navigate(`/events/${banner.id}`)}>
                        <Armchair size={16} />
                        <span>Chọn ghế &amp; Đặt vé</span>
                      </button>
                      <button
                        type='button'
                        className='hero-btn-secondary'
                        onClick={() => openBookingModal(banner)}>
                        <Ticket size={16} />
                        <span>Đặt nhanh</span>
                      </button>
                    </div>
                  </div>
                  <div className='hero-media'>
                    <img
                      src={banner.image}
                      alt={banner.title}
                      onError={(e) => {
                        e.currentTarget.src = '/assets/banners/hero_0.jpg';
                      }}
                    />
                    <div className='hero-media-gradient' />
                  </div>
                </div>
              ))}
            </div>

            <button
              type='button'
              className='hero-nav-btn prev'
              onClick={() =>
                setHeroIndex((prev) => (prev - 1 + SITE_DATA.heroBanners.length) % SITE_DATA.heroBanners.length)
              }
              aria-label='Slide trước'>
              <ChevronLeft size={18} />
            </button>
            <button
              type='button'
              className='hero-nav-btn next'
              onClick={() => setHeroIndex((prev) => (prev + 1) % SITE_DATA.heroBanners.length)}
              aria-label='Slide tiếp theo'>
              <ChevronRight size={18} />
            </button>

            <div className='hero-indicators'>
              {SITE_DATA.heroBanners.map((_, idx) => (
                <button
                  key={idx}
                  type='button'
                  className={`hero-dot ${idx === heroIndex ? 'active' : ''}`}
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Chuyển đến slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRENDING TOP 10 */}
      <section className='section-wrap' id='trending'>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Flame size={20} />
                <span>Sự kiện xu hướng</span>
              </h2>
              <p className='section-subtitle'>Top các sự kiện đang được săn vé nhiều nhất trong tuần</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type='button'
                className='tb-btn tb-btn-outline tb-btn-sm'
                onClick={() => trendingSliderRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                aria-label='Cuộn sang trái'>
                <ChevronLeft size={15} />
              </button>
              <button
                type='button'
                className='tb-btn tb-btn-outline tb-btn-sm'
                onClick={() => trendingSliderRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                aria-label='Cuộn sang phải'>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className='horizontal-slider' ref={trendingSliderRef}>
            {SITE_DATA.trendingEvents.map((event) => {
              const card = renderCard(event, true);
              if (!card) return null;
              return (
                <div key={event.id} className='slider-card-item'>
                  {card}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KHÁM PHÁ THEO THỜI GIAN */}
      <section className='section-wrap' id='weekend' style={{ background: 'var(--bg-surface)', padding: '48px 0' }}>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Calendar size={20} />
                <span>Khám phá theo thời gian</span>
              </h2>
              <p className='section-subtitle'>Lên lịch trải nghiệm cùng bạn bè và gia đình</p>
            </div>
            <div className='filter-tabs'>
              <button
                type='button'
                className={`filter-tab-btn ${timeTab === 'weekend' ? 'active' : ''}`}
                onClick={() => setTimeTab('weekend')}>
                Cuối tuần này
              </button>
              <button
                type='button'
                className={`filter-tab-btn ${timeTab === 'month' ? 'active' : ''}`}
                onClick={() => setTimeTab('month')}>
                Tháng này
              </button>
            </div>
          </div>

          <div className='events-grid'>
            {(timeTab === 'weekend' ? SITE_DATA.weekendEvents : [...SITE_DATA.weekendEvents].reverse()).map(
              (event) => renderCard(event),
            )}
          </div>
        </div>
      </section>

      {/* DUY NHẤT TRÊN EventTick */}
      <section className='section-wrap' id='special'>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Star size={20} />
                <span>Duy nhất trên EventTick</span>
              </h2>
              <p className='section-subtitle'>Đặc quyền đặt chỗ sớm và ưu đãi độc quyền từ ban tổ chức</p>
            </div>
            <button
              type='button'
              className='section-more-link'
              onClick={() => {
                setActiveCategory('all');
                showToast('Hiển thị tất cả sự kiện');
              }}>
              <span>Xem tất cả</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className='events-grid'>{SITE_DATA.trendingEvents.slice(2, 6).map((event) => renderCard(event))}</div>
        </div>
      </section>

      {/* NHẠC SỐNG */}
      <section className='section-wrap' id='musicSection'>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Music size={20} />
                <span>Nhạc sống sôi động</span>
              </h2>
              <p className='section-subtitle'>Hòa mình vào không gian âm nhạc từ ca sĩ và ban nhạc yêu thích</p>
            </div>
            <button
              type='button'
              className='section-more-link'
              onClick={() => {
                setActiveCategory('music');
                showToast('Đang lọc danh mục: Nhạc sống');
              }}>
              <span>Xem thêm nhạc sống</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className='events-grid'>
            {[
              SITE_DATA.trendingEvents[0],
              SITE_DATA.trendingEvents[1],
              SITE_DATA.trendingEvents[4],
              SITE_DATA.weekendEvents[2],
            ].map((event) => renderCard(event))}
          </div>
        </div>
      </section>

      {/* SÂN KHẤU, KỊCH & WORKSHOP */}
      <section className='section-wrap' style={{ background: 'var(--bg-surface)', padding: '48px 0' }}>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Palette size={20} />
                <span>Sân khấu, Kịch &amp; Trải nghiệm</span>
              </h2>
              <p className='section-subtitle'>Thưởng thức nghệ thuật biểu diễn và những buổi học trải nghiệm thú vị</p>
            </div>
          </div>

          <div className='events-grid'>
            {[
              SITE_DATA.weekendEvents[0],
              SITE_DATA.weekendEvents[1],
              SITE_DATA.weekendEvents[4],
              SITE_DATA.weekendEvents[6],
            ].map((event) => renderCard(event))}
          </div>
        </div>
      </section>

      {/* ORGANIZER BANNER */}
      <section className='tb-container' id='organizer'>
        <div className='organizer-banner'>
          <div className='organizer-content'>
            <div className='organizer-tag'>
              <Award size={14} />
              <span>Giải pháp bán vé toàn diện</span>
            </div>
            <h2 className='organizer-title'>Tổ chức sự kiện cùng EventTick</h2>
            <p className='organizer-desc'>
              Tiếp cận hơn 3.000.000 khán giả yêu giải trí tại Việt Nam. Nền tảng bán vé ổn định, soát vé mã QR thông
              minh với tỉ lệ xử lý 1000 vé/phút và báo cáo thời gian thực.
            </p>
          </div>
          <div className='organizer-actions'>
            <Link to={PATHS.REGISTER} className='tb-btn tb-btn-white'>
              <Briefcase size={15} />
              <span>Đăng ký đối tác</span>
            </Link>
            <button
              type='button'
              className='tb-btn tb-btn-outline'
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'transparent' }}
              onClick={() => showToast('Tải tài liệu giới thiệu giải pháp EventTick Business')}>
              <Download size={15} />
              <span>Tải tài liệu</span>
            </button>
          </div>
        </div>
      </section>

      {/* QUICK BOOKING MODAL */}
      {bookingEvent && (
        <div
          className='modal-overlay'
          onClick={(e) => {
            if (e.target === e.currentTarget) setBookingEvent(null);
          }}>
          <div className='modal-box'>
            <div className='modal-header'>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className='modal-title'>Đặt vé sự kiện</h3>
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
                  Demo
                </span>
              </div>
              <button type='button' className='modal-close-btn' onClick={() => setBookingEvent(null)} title='Đóng'>
                <X size={16} />
              </button>
            </div>

            <div className='modal-body'>
              <div className='modal-event-preview'>
                <img
                  src={bookingEvent.image}
                  alt={bookingEvent.name || bookingEvent.title}
                  className='modal-thumb'
                  onError={(e) => {
                    e.currentTarget.src = '/assets/banners/hero_0.jpg';
                  }}
                />
                <div className='modal-event-info'>
                  <h4 className='modal-event-name'>{bookingEvent.name || bookingEvent.title}</h4>
                  <div className='modal-event-date'>
                    <Calendar size={13} />
                    <span>{bookingEvent.date}</span>
                  </div>
                  <div className='modal-event-date'>
                    <MapPin size={13} />
                    <span>{bookingEvent.city || bookingEvent.venue || 'TP.HCM'}</span>
                  </div>
                </div>
              </div>

              <h5
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                Chọn hạng vé
              </h5>

              <button
                type='button'
                className={`modal-ticket-type ${ticketTierMultiplier === 1 ? 'selected' : ''}`}
                onClick={() => setTicketTierMultiplier(1)}>
                <div>
                  <div className='modal-ticket-name'>Hạng Phổ Thông (Standard)</div>
                  <div className='modal-ticket-desc'>Vị trí xem tiêu chuẩn, bao gồm nước suối</div>
                </div>
                <div className='modal-ticket-price'>{(bookingEvent.basePrice || 385000).toLocaleString('vi-VN')} ₫</div>
              </button>

              <button
                type='button'
                className={`modal-ticket-type ${ticketTierMultiplier === 1.6 ? 'selected' : ''}`}
                onClick={() => setTicketTierMultiplier(1.6)}>
                <div>
                  <div className='modal-ticket-name'>Hạng VIP Trải Nghiệm</div>
                  <div className='modal-ticket-desc'>Lối đi riêng, vị trí trung tâm, quà tặng kỷ niệm</div>
                </div>
                <div className='modal-ticket-price'>
                  {Math.round((bookingEvent.basePrice || 385000) * 1.6).toLocaleString('vi-VN')} ₫
                </div>
              </button>

              <div className='modal-qty-row'>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Số lượng vé</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Tối đa 6 vé/giao dịch</div>
                </div>
                <div className='modal-qty-control'>
                  <button type='button' className='qty-btn' onClick={() => setTicketQty((q) => Math.max(1, q - 1))}>
                    -
                  </button>
                  <span className='qty-val'>{ticketQty}</span>
                  <button type='button' className='qty-btn' onClick={() => setTicketQty((q) => Math.min(6, q + 1))}>
                    +
                  </button>
                </div>
              </div>

              <button
                type='button'
                className='tb-btn tb-btn-outline w-full'
                style={{ height: '42px', marginTop: '16px', borderRadius: 'var(--radius-md)' }}
                onClick={() => {
                  const evId = bookingEvent.id;
                  setBookingEvent(null);
                  navigate(`/events/${evId}`);
                }}>
                <Armchair size={16} />
                <span>Xem chi tiết &amp; sơ đồ chọn ghế ngồi</span>
              </button>
            </div>

            <div className='modal-footer'>
              <div>
                <div className='modal-total-label'>Tổng tạm tính</div>
                <div className='modal-total-val'>
                  {Math.round((bookingEvent.basePrice || 385000) * ticketTierMultiplier * ticketQty).toLocaleString(
                    'vi-VN',
                  )}{' '}
                  ₫
                </div>
              </div>
              <button type='button' className='tb-btn tb-btn-solid' onClick={confirmDemoBooking}>
                <CheckCircle size={16} />
                <span>Đặt vé (Mô phỏng)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
