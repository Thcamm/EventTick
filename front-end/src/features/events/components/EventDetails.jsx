import "./EventDetails.css";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import DOMPurify from "dompurify";

const FALLBACK_ZONE_COLORS = [
  "#ec4899",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#22c55e",
];

const EventDetails = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [openSessions, setOpenSessions] = useState({});

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await axiosInstance.get(`/events/${eventId}`, {
          withCredentials: true,
        });
        if (res.data.success) {
          const ev = res.data.event;
          setEvent(ev);
          if (ev?.sessions?.length) {
            const initialOpen = {};
            ev.sessions.forEach((s, idx) => {
              initialOpen[s._id || idx] = true;
            });
            setOpenSessions(initialOpen);
          }
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      }
    };
    fetchEvent();
  }, [eventId]);

  const toggleText = () => setIsExpanded((prev) => !prev);

  const toggleSession = (key) => {
    setOpenSessions((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const firstActiveSession = useMemo(() => {
    if (!event?.sessions?.length) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
      event.sessions.find((s) => new Date(s.eventDate || s.startTime) >= today) ||
      event.sessions[0]
    );
  }, [event]);

  if (!event) return <p className="ed-loading">Đang tải thông tin sự kiện...</p>;

  const eventName = event.title || event.eventName;
  const backgroundImage = event.bannerUrl || event.backgroundImage;
  const priceFrom = event.lowestPrice ?? 0;
  const venue = event.location || event.venueName;
  const fullText = event.description || event.eventDesc || "";

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatLongDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day} Tháng ${month}, ${year}`;
  };

  const formatSessionRange = (session) => {
    if (!session) return "";
    const start = new Date(session.startTime || session.eventDate);
    const end = session.endTime
      ? new Date(session.endTime)
      : new Date(start.getTime() + 3 * 60 * 60 * 1000);
    return `${formatTime(start)} - ${formatTime(end)}, ${formatLongDate(
      session.eventDate || session.startTime,
    )}`;
  };

  const formatPriceVnd = (val) =>
    `${Number(val || 0).toLocaleString("vi-VN")} đ`;

  const isTicketSoldOut = (ticket) => {
    if (ticket.numberOfTicketLeft !== undefined) {
      return Number(ticket.numberOfTicketLeft) <= 0;
    }
    if (ticket.remaining !== undefined) {
      return Number(ticket.remaining) <= 0;
    }
    return String(ticket.soldOut) === "true";
  };

  const seatMapBgUrl =
    firstActiveSession?.seatMap?.background_url ||
    event?.seatMapUrl ||
    null;

  const previewTiers = firstActiveSession?.tickets || [];
  const isSeatedEvent = Boolean(
    event.has_seat_map ||
      event.hasSeatMap ||
      previewTiers.some((t) => t.zoneType === "SEATED"),
  );

  return (
    <div className="ed-page-wrapper">
      {/* HERO TICKET BANNER */}
      <div className="ticket">
        <div className="ticket-left">
          <div className="ticket-left-top">
            <h2>{eventName}</h2>
            {firstActiveSession && (
              <p className="ticket-meta-row">
                <span className="ticket-meta-icon">📅</span>
                <span>{formatSessionRange(firstActiveSession)}</span>
              </p>
            )}
            <p className="ticket-meta-row">
              <span className="ticket-meta-icon">📍</span>
              <span>{venue}</span>
            </p>
          </div>

          <div className="ticket-left-bottom">
            <div className="ticket-price-from-row">
              <span>Giá từ</span>
              <strong className="ticket-price-from-value">
                {formatPriceVnd(priceFrom)}
              </strong>
            </div>
            {firstActiveSession && (
              <Link
                to={`/event/seats/${eventId}?sessionId=${firstActiveSession._id}`}
                className="ticket-hero-buy-btn"
              >
                Mua vé ngay
              </Link>
            )}
          </div>
        </div>
        <div className="ticket-right">
          <img src={backgroundImage} alt={eventName} />
        </div>
      </div>

      {/* GIỚI THIỆU + SƠ ĐỒ SÂN KHẤU / KHU VỰC (MẪU IMAGE 4) */}
      <div className="event-details-intro-container ed-light-card">
        <div className="ed-section-title-row">
          <h3>Giới thiệu</h3>
        </div>
        <div
          className={`ed-intro-collapsible ${isExpanded ? "expanded" : "collapsed"}`}
        >
          {/* Sơ đồ khu vực / sân khấu trực quan */}
          <div className="ed-stage-map-preview">
            <div className="ed-stage-map-title">
              SƠ ĐỒ KHU VỰC • {eventName}
            </div>
            {seatMapBgUrl ? (
              <img
                src={seatMapBgUrl}
                alt="Sơ đồ khu vực"
                className="ed-custom-seatmap-img"
              />
            ) : (
              <div className="ed-concert-diagram">
                <div className="ed-concert-stage">STAGE</div>
                <div className="ed-concert-runway" />
                <div className="ed-concert-zones-wrap">
                  {previewTiers.map((tier, idx) => {
                    const color =
                      tier.zoneColor ||
                      FALLBACK_ZONE_COLORS[idx % FALLBACK_ZONE_COLORS.length];
                    const soldOut = isTicketSoldOut(tier);
                    return (
                      <div
                        key={tier._id || idx}
                        className={`ed-concert-zone-block ${soldOut ? "sold-out" : ""}`}
                        style={{ "--zone-bg": color }}
                      >
                        <span className="ed-zone-block-name">{tier.name}</span>
                        <span className="ed-zone-block-price">
                          {formatPriceVnd(tier.price)}
                        </span>
                        <span className="ed-zone-block-type">
                          {tier.zoneType === "SEATED" || isSeatedEvent
                            ? "Khu ghế ngồi"
                            : "Khu vé đứng (GA)"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="ed-concert-foh">FOH</div>
              </div>
            )}
          </div>

          <div
            id="event-intro-text"
            className="ed-intro-html"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(fullText),
            }}
          />
          {!isExpanded && <div className="ed-intro-fade" />}
        </div>
        <button
          type="button"
          className="event-intro-expand-btn"
          onClick={toggleText}
          aria-label={isExpanded ? "Thu gọn" : "Xem thêm"}
        >
          {isExpanded ? "⌃" : "⌄"}
        </button>
      </div>

      {/* THÔNG TIN VÉ (ACCORDION DARK THEO MẪU TICKETBOX IMAGE 5) */}
      <div className="event-details-intro-container ed-ticket-section" id="ticket-info-section">
        <div className="ed-ticket-box">
          <div className="ed-ticket-box-header">
            <h3>Thông tin vé</h3>
          </div>

          <div className="ed-sessions-accordion">
            {event.sessions?.map((session, idx) => {
              const sessionKey = session._id || idx;
              const isOpen =
                openSessions[sessionKey] === undefined
                  ? true
                  : openSessions[sessionKey];

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const sessionDate = new Date(session.eventDate || session.startTime);
              sessionDate.setHours(0, 0, 0, 0);
              const hasEnded = sessionDate < today;

              const allSoldOut =
                session.tickets?.length > 0 &&
                session.tickets.every((t) => isTicketSoldOut(t));

              return (
                <div className="ed-session-group" key={sessionKey}>
                  <div
                    className="ed-session-bar"
                    onClick={() => toggleSession(sessionKey)}
                  >
                    <div className="ed-session-bar-left">
                      <span className={`ed-chevron ${isOpen ? "open" : ""}`}>
                        ⌄
                      </span>
                      <span className="ed-session-datetime">
                        {formatSessionRange(session)}
                      </span>
                      {hasEnded && (
                        <span className="session-ended-tag">
                          Suất diễn đã diễn ra
                        </span>
                      )}
                    </div>

                    <div
                      className="ed-session-bar-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasEnded ? (
                        <button
                          type="button"
                          className="ticket-details-buy-button disabled"
                          disabled
                        >
                          Đã kết thúc
                        </button>
                      ) : allSoldOut ? (
                        <span className="ed-soldout-pill">Hết vé</span>
                      ) : (
                        <Link
                          to={
                            session._id
                              ? `/event/seats/${eventId}?sessionId=${session._id}`
                              : `/event/seats/${eventId}`
                          }
                          className="ticket-details-buy-button"
                        >
                          Mua vé ngay
                        </Link>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="ed-tier-list">
                      {session.tickets?.map((ticket, tIdx) => {
                        const soldOut = isTicketSoldOut(ticket);
                        return (
                          <div
                            className={`ed-tier-row ${tIdx % 2 === 1 ? "alt" : ""}`}
                            key={ticket._id || tIdx}
                          >
                            <div className="ed-tier-row-left">
                              <span className="ed-tier-name">{ticket.name}</span>
                              {ticket.desc && (
                                <span className="ed-tier-desc">{ticket.desc}</span>
                              )}
                            </div>

                            <div className="ed-tier-row-right">
                              <span className="ed-tier-price">
                                {formatPriceVnd(ticket.price)}
                              </span>
                              {soldOut && (
                                <span className="ed-soldout-pill">Hết vé</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BAN TỔ CHỨC */}
      {event.organizerInfo && (
        <div className="event-details-intro-container ed-light-card">
          <div className="ed-section-title-row">
            <h3>Ban tổ chức</h3>
          </div>
          <div className="ed-organizer-body">
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(event.organizerInfo || ""),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;
