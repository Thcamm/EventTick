import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { io } from "socket.io-client";
import SeatMapView from "@/features/seatmap/SeatMapView";
import { colorSections } from "@/features/seatmap/colors";
import SectionTickets from "@/features/seatmap/SectionTickets";
import "./RealtimeEventDetailsPage.css";

const ZONE_PALETTE = [
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#a855f7", // Purple
  "#eab308", // Yellow
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#84cc16", // Lime
];

function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`;
}

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatSessionDateTime = (session) => {
  if (!session) return "";
  const start = new Date(session.startTime || session.eventDate);
  const end = session.endTime
    ? new Date(session.endTime)
    : new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmtTime = (d) =>
    d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const day = String(start.getDate()).padStart(2, "0");
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const year = start.getFullYear();
  return `${fmtTime(start)} - ${fmtTime(end)}, ${day} Tháng ${month}, ${year}`;
};

const RealtimeEventDetails = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");

  const [orderKey] = useState(generateOrderId());
  const [event, setEvent] = useState(null);
  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const [sessionSeats, setSessionSeats] = useState([]);
  const [seatMapInfo, setSeatMapInfo] = useState(null);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [activeTierFilter, setActiveTierFilter] = useState("ALL");
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const [cartItems, setCartItems] = useState([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [note, setNote] = useState("");
  const [isErrorNote, setIsErrorNote] = useState(false);
  const [notification, setNotification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Event & Socket stock updates
  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        const res = await axiosInstance.get(`/seats/${eventId}`);
        const ev = res.data.event;
        setEvent(ev);

        if (ev?.sessions?.length && requestedSessionId) {
          const foundIdx = ev.sessions.findIndex(
            (s) => String(s._id) === String(requestedSessionId),
          );
          if (foundIdx >= 0) setSelectedSessionIdx(foundIdx);
        }
      } catch (err) {
        if (
          err.response &&
          err.response.status >= 400 &&
          err.response.status < 500
        ) {
          window.location.href = `/login?returnTo=/event/seats/${eventId}`;
        } else {
          console.error("Error fetching event:", err);
        }
      }
    };
    fetchEvent();

    const socket = io("http://localhost:3000", {
      withCredentials: true,
      reconnectionAttempts: 1,
      timeout: 2000,
    });
    socket.on("connect_error", () => {
      socket.disconnect();
    });
    socket.emit("join_event_room", eventId);

    socket.on("event_stock_update", (payload) => {
      setEvent((prev) => {
        if (!prev) return prev;
        const nextSessions = prev.sessions.map((session) => {
          const updatedTickets = session.tickets.map((ticket) => {
            const update = payload.items?.find(
              (u) => String(u.ticketId) === String(ticket._id),
            );
            if (update) {
              return {
                ...ticket,
                numberOfTicketLeft: update.numberOfTicketLeft,
              };
            }
            return ticket;
          });
          return { ...session, tickets: updatedTickets };
        });
        return { ...prev, sessions: nextSessions };
      });
    });

    return () => {
      socket.emit("leave_event_room", eventId);
      socket.off("event_stock_update");
      socket.disconnect();
    };
  }, [eventId, requestedSessionId]);

  const activeSession = useMemo(() => {
    if (!event?.sessions?.length) return null;
    return event.sessions[selectedSessionIdx] || event.sessions[0];
  }, [event, selectedSessionIdx]);

  // 2. Fetch Seats & SeatMap for active session
  useEffect(() => {
    if (!activeSession?._id) {
      setSessionSeats([]);
      setSeatMapInfo(null);
      return;
    }

    let alive = true;
    const fetchSessionSeatData = async () => {
      setLoadingSeats(true);
      try {
        const [seatsRes, mapRes] = await Promise.allSettled([
          axiosInstance.get(`/events/sessions/${activeSession._id}/seats`),
          axiosInstance.get(`/events/sessions/${activeSession._id}/seat-map`),
        ]);
        if (!alive) return;

        if (seatsRes.status === "fulfilled" && seatsRes.value?.data?.seats) {
          setSessionSeats(seatsRes.value.data.seats);
        } else {
          setSessionSeats([]);
        }

        if (mapRes.status === "fulfilled" && mapRes.value?.data) {
          setSeatMapInfo(mapRes.value.data);
        } else {
          setSeatMapInfo(null);
        }
      } catch {
        if (alive) {
          setSessionSeats([]);
          setSeatMapInfo(null);
        }
      } finally {
        if (alive) setLoadingSeats(false);
      }
    };

    fetchSessionSeatData();
    return () => {
      alive = false;
    };
  }, [activeSession?._id]);

  // Determine Seated vs Standing mode
  const isSeatedMode = useMemo(() => {
    if (sessionSeats.length > 0) return true;
    if (activeSession?.tickets?.some((t) => t.zoneType === "SEATED"))
      return true;
    if (event?.has_seat_map || event?.hasSeatMap) return true;
    return false;
  }, [sessionSeats, activeSession, event]);

  // Map tiers by _id with vivid Ticketbox colors
  const tierById = useMemo(() => {
    const map = {};
    (activeSession?.tickets || []).forEach((t, idx) => {
      map[String(t._id)] = {
        ...t,
        color: t.zoneColor || ZONE_PALETTE[idx % ZONE_PALETTE.length],
      };
    });
    return map;
  }, [activeSession]);

  // Selected seat IDs set
  const selectedSeatIds = useMemo(() => {
    const set = new Set();
    cartItems.forEach((item) => {
      (item.seatIds || []).forEach((id) => set.add(String(id)));
    });
    return set;
  }, [cartItems]);

  // Group seats by section -> row
  const groupedSections = useMemo(() => {
    if (!sessionSeats.length) return [];
    const sectionsMap = new Map();

    sessionSeats.forEach((seat) => {
      if (
        activeTierFilter !== "ALL" &&
        String(seat.tierId) !== String(activeTierFilter)
      ) {
        return;
      }
      const tier = tierById[String(seat.tierId)] || null;
      const secName = seat.section || tier?.name || "KHU VỰC CHÍNH";
      if (!sectionsMap.has(secName)) {
        sectionsMap.set(secName, {
          name: secName,
          tier,
          rowsMap: new Map(),
        });
      }
      const secObj = sectionsMap.get(secName);
      const rowKey = seat.row || "A";
      if (!secObj.rowsMap.has(rowKey)) {
        secObj.rowsMap.set(rowKey, []);
      }
      secObj.rowsMap.get(rowKey).push(seat);
    });

    return Array.from(sectionsMap.values()).map((sec, idx) => ({
      name: sec.name,
      tier: sec.tier,
      color:
        sec.tier?.color || ZONE_PALETTE[idx % ZONE_PALETTE.length],
      rows: Array.from(sec.rowsMap.entries())
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([rowLabel, seats]) => ({
          rowLabel,
          seats: [...seats].sort((a, b) =>
            String(a.number).localeCompare(String(b.number), undefined, {
              numeric: true,
            }),
          ),
        })),
    }));
  }, [sessionSeats, activeTierFilter, tierById]);

  // Sơ đồ SVG do Admin dựng (nếu có): khu + màu theo hạng vé, số vé đang chọn theo khu
  const mapSections = useMemo(
    () => (seatMapInfo?.hasMap ? colorSections(seatMapInfo.sections || []) : []),
    [seatMapInfo],
  );
  const activeSection = useMemo(
    () => mapSections.find((s) => s.sectionId === activeSectionId) || null,
    [mapSections, activeSectionId],
  );
  const selectedCountBySection = useMemo(() => {
    const out = {};
    cartItems.forEach((item) => {
      if (item.seatIds?.length) {
        (item.seats || []).forEach((st) => {
          out[st.section] = (out[st.section] || 0) + 1;
        });
      } else {
        const sec = mapSections.find(
          (m) => m.type === "GA" && String(m.tierId) === String(item.ticketId),
        );
        if (sec) out[sec.sectionId] = (out[sec.sectionId] || 0) + item.quantity;
      }
    });
    return out;
  }, [cartItems, mapSections]);

  const handleSelectSession = (idx) => {
    if (idx === selectedSessionIdx) return;
    if (cartItems.length > 0) {
      const ok = window.confirm(
        "Chuyển suất diễn sẽ làm mới danh sách vé đang chọn. Bạn có muốn tiếp tục?",
      );
      if (!ok) return;
    }
    setCartItems([]);
    setActiveSectionId(null);
    setActiveTierFilter("ALL");
    setSelectedSessionIdx(idx);
    setIsErrorNote(false);
    setNote("");
  };

  const getRemainingTickets = (ticket) => {
    if (ticket.numberOfTicketLeft !== undefined)
      return Number(ticket.numberOfTicketLeft);
    return Math.max(0, (Number(ticket.stock) || 0) - (Number(ticket.sold) || 0));
  };

  const getTierSelectedQty = (ticketId) => {
    if (!activeSession) return 0;
    const found = cartItems.find(
      (item) =>
        String(item.sessionId) === String(activeSession._id) &&
        String(item.ticketId) === String(ticketId) &&
        !item.seatIds?.length,
    );
    return found ? found.quantity : 0;
  };

  const handleStandingQtyChange = (ticket, delta) => {
    if (!activeSession) return;
    const remaining = getRemainingTickets(ticket);
    const maxPerOrder = Number(ticket.maxPerOrder) || 10;
    const maxAllowed = Math.min(remaining, maxPerOrder);
    const currentQty = getTierSelectedQty(ticket._id);
    const nextQty = currentQty + delta;

    if (nextQty < 0) return;
    if (delta > 0 && remaining <= 0) {
      setIsErrorNote(true);
      setNote(`Hạng vé "${ticket.name}" đã hết vé.`);
      return;
    }
    if (delta > 0 && nextQty > maxAllowed) {
      setIsErrorNote(true);
      setNote(
        remaining < maxPerOrder
          ? `Hạng vé "${ticket.name}" chỉ còn ${remaining} vé.`
          : `Tối đa ${maxPerOrder} vé "${ticket.name}" mỗi đơn.`,
      );
      return;
    }

    setIsErrorNote(false);
    setNote("");

    const ticketProp = formatSessionDateTime(activeSession);
    setCartItems((prev) => {
      const existing = prev.find(
        (item) =>
          String(item.sessionId) === String(activeSession._id) &&
          String(item.ticketId) === String(ticket._id) &&
          !item.seatIds?.length,
      );

      if (nextQty === 0) {
        return prev.filter((item) => item !== existing);
      }

      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: nextQty } : item,
        );
      }

      return [
        ...prev,
        {
          id: `${activeSession._id}-${ticket._id}`,
          sessionId: activeSession._id,
          ticketId: ticket._id,
          ticketProp,
          ticketName: ticket.name,
          ticketPrice: ticket.price,
          ticketColor:
            ticket.zoneColor ||
            tierById[String(ticket._id)]?.color ||
            ZONE_PALETTE[0],
          quantity: nextQty,
        },
      ];
    });
  };

  const handleToggleSeat = (seat) => {
    if (!activeSession || seat.status !== "AVAILABLE") return;
    const tier = tierById[String(seat.tierId)];
    if (!tier) return;

    const seatIdStr = String(seat._id);
    const seatLabel = `${seat.row}${seat.number}`;
    const maxPerOrder = Number(tier.maxPerOrder) || 10;
    const ticketProp = formatSessionDateTime(activeSession);

    setCartItems((prev) => {
      const existing = prev.find(
        (item) =>
          String(item.sessionId) === String(activeSession._id) &&
          String(item.ticketId) === String(tier._id) &&
          Array.isArray(item.seatIds),
      );

      const isAlreadySelected = existing?.seatIds?.some(
        (id) => String(id) === seatIdStr,
      );

      if (isAlreadySelected) {
        const nextSeatIds = existing.seatIds.filter(
          (id) => String(id) !== seatIdStr,
        );
        const nextSeats = (existing.seats || []).filter(
          (s) => String(s._id) !== seatIdStr,
        );
        setIsErrorNote(false);
        setNote("");

        if (nextSeatIds.length === 0) {
          return prev.filter((item) => item !== existing);
        }
        return prev.map((item) =>
          item === existing
            ? {
                ...item,
                seatIds: nextSeatIds,
                seats: nextSeats,
                quantity: nextSeatIds.length,
              }
            : item,
        );
      }

      if (existing && existing.seatIds.length >= maxPerOrder) {
        setIsErrorNote(true);
        setNote(
          `Hạng vé "${tier.name}" chỉ cho phép chọn tối đa ${maxPerOrder} ghế mỗi đơn.`,
        );
        return prev;
      }

      setIsErrorNote(false);
      setNote("");

      const seatEntry = {
        _id: seat._id,
        label: seatLabel,
        section: seat.section,
        row: seat.row,
        number: seat.number,
      };

      if (existing) {
        const nextSeatIds = [...existing.seatIds, seat._id];
        const nextSeats = [...(existing.seats || []), seatEntry];
        return prev.map((item) =>
          item === existing
            ? {
                ...item,
                seatIds: nextSeatIds,
                seats: nextSeats,
                quantity: nextSeatIds.length,
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: `${activeSession._id}-${tier._id}-seated`,
          sessionId: activeSession._id,
          ticketId: tier._id,
          ticketProp,
          ticketName: tier.name,
          ticketPrice: tier.price,
          ticketColor: tier.color,
          seatIds: [seat._id],
          seats: [seatEntry],
          quantity: 1,
        },
      ];
    });
  };

  const handleRemoveItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalTicketsCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const grandTotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.ticketPrice,
    0,
  );

  // Pan & Zoom handlers for interactive seat map
  const handleMouseDown = (e) => {
    if (e.target.closest("button")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || totalTicketsCount === 0) {
      setIsErrorNote(true);
      setNote(
        isSeatedMode
          ? "Vui lòng chọn ít nhất 1 ghế trên sơ đồ."
          : "Vui lòng chọn ít nhất 1 vé.",
      );
      return;
    }

    setSubmitting(true);
    setIsErrorNote(false);
    try {
      const payload = {
        sessionId: activeSession?._id,
        cartItems: cartItems
          .filter((item) => item.quantity > 0)
          .map((item) =>
            item.seatIds?.length
              ? {
                  sessionId: item.sessionId,
                  ticketId: item.ticketId,
                  quantity: item.seatIds.length,
                  seatIds: item.seatIds,
                }
              : {
                  sessionId: item.sessionId,
                  ticketId: item.ticketId,
                  quantity: item.quantity,
                },
          ),
        orderKey,
        voucherCode: voucherCode.trim() || undefined,
      };

      const res = await axiosInstance.post(
        `/booking/carts/${eventId}`,
        payload,
      );

      if (res.data.success) {
        setNotification(
          "Đã giữ vé thành công! Đang chuyển sang trang thanh toán QR...",
        );
        setCartItems([]);
        setTimeout(() => {
          navigate(`/payment/${res.data.orderId}`);
        }, 900);
      } else {
        setIsErrorNote(true);
        setNote(res.data.message || "Có lỗi xảy ra khi đặt vé.");
      }
    } catch (err) {
      setIsErrorNote(true);
      if (err.response?.data?.message) {
        setNote(err.response.data.message);
      } else {
        setNote("Có lỗi xảy ra khi kết nối tới máy chủ.");
      }
      console.error("Error submitting order:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (cartItems.length > 0) {
      const ok = window.confirm(
        "Các vé/ghế đang chọn sẽ bị hủy, bạn có muốn quay lại trang sự kiện?",
      );
      if (!ok) return;
    }
    navigate(`/event/${eventId}`);
  };

  if (!event) {
    return (
      <div className="tbx-loading-screen">
        <div className="tbx-spinner" />
        <p>Đang tải sơ đồ và thông tin vé...</p>
      </div>
    );
  }

  const diagramBgUrl =
    seatMapInfo?.canvas?.backgroundUrl ||
    activeSession?.seatMap?.background_url ||
    null;

  return (
    <div className="tbx-booking-shell">
      {/* =====================================================================
          THANH TOP BAR CHUẨN TICKETBOX (IMAGE 6)
          Trái: ← Trở về | Giữa: Chọn vé | Phải: Chú thích trạng thái ghế tròn
         ===================================================================== */}
      <header className="tbx-topbar">
        <button
          type="button"
          className="tbx-back-link"
          onClick={handleBack}
        >
          <span className="tbx-back-arrow">←</span>
          <span>Trở về</span>
        </button>

        <h1 className="tbx-topbar-title">Chọn vé</h1>

        {isSeatedMode ? (
          <div className="tbx-seat-legend-bar">
            <div className="tbx-legend-pill">
              <span className="tbx-circle-dot available" />
              <span>Đang trống</span>
            </div>
            <div className="tbx-legend-pill">
              <span className="tbx-circle-dot selected" />
              <span>Đang chọn</span>
            </div>
            <div className="tbx-legend-pill">
              <span className="tbx-circle-dot unavailable" />
              <span>Không chọn được</span>
            </div>
          </div>
        ) : (
          <div className="tbx-seat-legend-bar">
            <div className="tbx-legend-pill">
              <span className="tbx-circle-dot selected" />
              <span>Còn vé</span>
            </div>
            <div className="tbx-legend-pill">
              <span className="tbx-circle-dot unavailable" />
              <span>Hết vé</span>
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          BODY: CỘT TRÁI (SƠ ĐỒ / CHỌN VÉ) + CỘT PHẢI (SIDEBAR THÔNG TIN SỰ KIỆN)
         ===================================================================== */}
      <div className="tbx-body-grid">
        {/* CỘT TRÁI: VÙNG SƠ ĐỒ GHẾ NGỒI (IMAGE 6) HOẶC VÉ ĐỨNG (IMAGES 4 & 5) */}
        <main className="tbx-main-stage">
          {loadingSeats ? (
            <div className="tbx-stage-loading">
              <div className="tbx-spinner" />
              <span>Đang tải sơ đồ suất diễn...</span>
            </div>
          ) : seatMapInfo?.hasMap && seatMapInfo.svgContent ? (
            /* SƠ ĐỒ SVG + EXCEL: ghế nằm ngay trên mặt bằng, bấm chọn trực tiếp; khu đứng (GA) mở bảng số lượng */
            <>
              <SeatMapView
                svgContent={seatMapInfo.svgContent}
                sections={mapSections}
                seats={sessionSeats}
                selectedSeatIds={selectedSeatIds}
                selectedCount={selectedCountBySection}
                onToggleSeat={handleToggleSeat}
                onSelectSection={(sec) => setActiveSectionId(sec.sectionId)}
              />
              {activeSection && activeSection.type === "GA" && (
                <div className="sm-ga-overlay" onClick={() => setActiveSectionId(null)}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <SectionTickets
                      section={activeSection}
                      quantity={getTierSelectedQty(activeSection.tierId)}
                      onChange={(delta) => {
                        const tier = tierById[String(activeSection.tierId)];
                        if (tier) handleStandingQtyChange(tier, delta);
                      }}
                      onBack={() => setActiveSectionId(null)}
                    />
                  </div>
                </div>
              )}
            </>
          ) : isSeatedMode ? (
            /* ===============================================================
               CHẾ ĐỒ 1: VÉ NGỒI — SƠ ĐỒ GHẾ TƯƠNG TÁC MÀU SẮC + CHẤM TRÒN (IMAGE 6)
               =============================================================== */
            <div
              className={`tbx-seatmap-canvas-area ${isDragging ? "dragging" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Nút điều khiển phóng to / xoay lại góc trên bên trái (Image 6) */}
              <div className="tbx-floating-controls">
                <button
                  type="button"
                  className="tbx-ctrl-btn"
                  onClick={() =>
                    setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))
                  }
                  title="Phóng to"
                >
                  +
                </button>
                <button
                  type="button"
                  className="tbx-ctrl-btn"
                  onClick={handleResetView}
                  title="Đặt lại góc nhìn"
                >
                  ⟳
                </button>
                <button
                  type="button"
                  className="tbx-ctrl-btn"
                  onClick={() =>
                    setZoom((z) => Math.max(0.65, +(z - 0.15).toFixed(2)))
                  }
                  title="Thu nhỏ"
                >
                  −
                </button>
              </div>

              {/* Thanh lọc nhanh theo khu vực */}
              <div className="tbx-floating-tier-pills">
                <button
                  type="button"
                  className={`tbx-filter-pill ${activeTierFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setActiveTierFilter("ALL")}
                >
                  Tất cả khu ({sessionSeats.length})
                </button>
                {activeSession?.tickets?.map((t, idx) => {
                  const c = t.zoneColor || ZONE_PALETTE[idx % ZONE_PALETTE.length];
                  const isFiltered = String(activeTierFilter) === String(t._id);
                  return (
                    <button
                      key={t._id || idx}
                      type="button"
                      className={`tbx-filter-pill ${isFiltered ? "active" : ""}`}
                      onClick={() =>
                        setActiveTierFilter(isFiltered ? "ALL" : t._id)
                      }
                    >
                      <span
                        className="tbx-filter-swatch"
                        style={{ backgroundColor: c }}
                      />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Khung vẽ Sân khấu & các khối Khu vực tô màu chứa hàng ghế tròn */}
              <div
                className="tbx-seatmap-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {/* Khối STAGE / SÂN KHẤU phía trên (Image 6) */}
                <div className="tbx-stage-box">STAGE</div>

                {/* Các khối khu vực màu sắc chứa các hàng ghế chấm tròn */}
                <div
                  className={`tbx-zones-bowl count-${Math.min(groupedSections.length, 4)}`}
                >
                  {groupedSections.map((sec, secIdx) => {
                    return (
                      <div
                        key={sec.name}
                        className={`tbx-colored-zone-polygon zone-idx-${secIdx}`}
                        style={{ "--zone-fill": sec.color }}
                      >
                        <div className="tbx-zone-watermark">{sec.name}</div>

                        <div className="tbx-zone-rows-list">
                          {sec.rows.map(({ rowLabel, seats }) => (
                            <div key={rowLabel} className="tbx-circle-seat-row">
                              <span className="tbx-row-letter">{rowLabel}</span>
                              <div className="tbx-circle-seats-track">
                                {seats.map((seat) => {
                                  const isSelected = selectedSeatIds.has(
                                    String(seat._id),
                                  );
                                  const isUnavailable =
                                    seat.status !== "AVAILABLE";
                                  const seatState = isSelected
                                    ? "selected"
                                    : isUnavailable
                                      ? "unavailable"
                                      : "available";

                                  return (
                                    <button
                                      key={seat._id}
                                      type="button"
                                      className={`tbx-seat-circle ${seatState}`}
                                      disabled={isUnavailable}
                                      onClick={() => handleToggleSeat(seat)}
                                      onMouseEnter={() =>
                                        setHoveredSeat({
                                          ...seat,
                                          tierName:
                                            sec.tier?.name || sec.name,
                                          price: sec.tier?.price || 0,
                                          isSelected,
                                        })
                                      }
                                      onMouseLeave={() => setHoveredSeat(null)}
                                      title={`${sec.name} • Hàng ${seat.row} - Ghế ${seat.number} (${formatMoney(sec.tier?.price || 0)})`}
                                    >
                                      <span className="tbx-seat-circle-num">
                                        {seat.number}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <span className="tbx-row-letter">{rowLabel}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Khối FOH trung tâm phía dưới */}
                <div className="tbx-foh-block">FOH</div>
              </div>

              {/* Chú thích ghế đang trỏ chuột ở góc dưới trái */}
              <div className="tbx-hover-status-pill">
                {hoveredSeat ? (
                  <>
                    <strong>
                      {hoveredSeat.section} • Ghế {hoveredSeat.row}
                      {hoveredSeat.number}
                    </strong>{" "}
                    <span>({formatMoney(hoveredSeat.price)})</span> —{" "}
                    <span
                      className={`tbx-hover-tag ${
                        hoveredSeat.isSelected
                          ? "selected"
                          : hoveredSeat.status === "AVAILABLE"
                            ? "available"
                            : "unavailable"
                      }`}
                    >
                      {hoveredSeat.isSelected
                        ? "Đang chọn"
                        : hoveredSeat.status === "AVAILABLE"
                          ? "Đang trống (Click để chọn)"
                          : "Không chọn được"}
                    </span>
                  </>
                ) : (
                  <span>
                    Nhấp vào chấm tròn màu trắng để chọn ghế • Kéo chuột để di chuyển sơ đồ
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* ===============================================================
               CHẾ ĐỘ 2: VÉ ĐỨNG (GA) — SƠ ĐỒ KHU VỰC SÂN KHẤU + BẢNG CHỌN SỐ LƯỢNG (IMAGES 4 & 5)
               =============================================================== */
            <div className="tbx-standing-workspace">
              {/* Khung Sơ đồ khu vực sân khấu (Image 4) */}
              <div className="tbx-standing-map-card">
                <div className="tbx-standing-map-header">
                  <span>SƠ ĐỒ KHU VỰC SÂN KHẤU</span>
                  {diagramBgUrl && (
                    <button
                      type="button"
                      className="tbx-zoom-img-btn"
                      onClick={() => setShowImageModal(true)}
                    >
                      Phóng to sơ đồ
                    </button>
                  )}
                </div>

                {diagramBgUrl ? (
                  <div className="tbx-standing-img-box">
                    <img
                      src={diagramBgUrl}
                      alt="Sơ đồ khu vực"
                      onClick={() => setShowImageModal(true)}
                    />
                  </div>
                ) : (
                  <div className="tbx-concert-standing-map">
                    <div className="tbx-concert-stage-top">STAGE</div>
                    <div className="tbx-concert-stage-thrust" />

                    <div className="tbx-concert-standing-zones">
                      {activeSession?.tickets?.map((ticket, idx) => {
                        const color =
                          ticket.zoneColor ||
                          ZONE_PALETTE[idx % ZONE_PALETTE.length];
                        const remaining = getRemainingTickets(ticket);
                        const soldOut = remaining <= 0;
                        const qty = getTierSelectedQty(ticket._id);

                        return (
                          <div
                            key={ticket._id || idx}
                            className={`tbx-standing-zone-tile ${
                              qty > 0 ? "selected" : ""
                            } ${soldOut ? "sold-out" : ""}`}
                            style={{ "--tile-bg": color }}
                            onClick={() => {
                              if (!soldOut) handleStandingQtyChange(ticket, 1);
                            }}
                            title={
                              soldOut
                                ? `${ticket.name} - Hết vé`
                                : `Nhấn để chọn +1 vé ${ticket.name}`
                            }
                          >
                            <span className="tbx-tile-name">{ticket.name}</span>
                            <span className="tbx-tile-price">
                              {formatMoney(ticket.price)}
                            </span>
                            {soldOut ? (
                              <span className="tbx-tile-soldout">Hết vé</span>
                            ) : qty > 0 ? (
                              <span className="tbx-tile-selected-badge">
                                Đang chọn: {qty}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="tbx-concert-foh-bottom">FOH</div>
                  </div>
                )}
              </div>

              {/* Bảng Chọn vé theo loại vé & số lượng chuẩn Ticketbox (Image 5) */}
              <div className="tbx-standing-ticket-table">
                <div className="tbx-table-head">
                  <span>Loại vé</span>
                  <span>Số lượng</span>
                </div>

                <div className="tbx-table-body">
                  {activeSession?.tickets?.map((ticket, idx) => {
                    const color =
                      ticket.zoneColor ||
                      ZONE_PALETTE[idx % ZONE_PALETTE.length];
                    const remaining = getRemainingTickets(ticket);
                    const isSoldOut = remaining <= 0;
                    const qty = getTierSelectedQty(ticket._id);
                    const maxPerOrder = Number(ticket.maxPerOrder) || 10;

                    return (
                      <div key={ticket._id || idx} className="tbx-ticket-row">
                        <div className="tbx-ticket-row-main">
                          <div className="tbx-ticket-row-left">
                            <div className="tbx-ticket-title-line">
                              <span
                                className="tbx-tier-color-square"
                                style={{ backgroundColor: color }}
                              />
                              <span className="tbx-ticket-tier-name">
                                {ticket.name}
                              </span>
                            </div>
                            <div className="tbx-ticket-tier-price">
                              {formatMoney(ticket.price)}
                            </div>
                          </div>

                          <div className="tbx-ticket-row-right">
                            {isSoldOut ? (
                              <span className="tbx-pink-soldout-badge">
                                Hết vé
                              </span>
                            ) : (
                              <div className="tbx-qty-stepper">
                                <button
                                  type="button"
                                  className="tbx-step-btn"
                                  onClick={() =>
                                    handleStandingQtyChange(ticket, -1)
                                  }
                                  disabled={qty <= 0}
                                >
                                  −
                                </button>
                                <span className="tbx-step-val">{qty}</span>
                                <button
                                  type="button"
                                  className="tbx-step-btn plus"
                                  onClick={() =>
                                    handleStandingQtyChange(ticket, 1)
                                  }
                                  disabled={
                                    qty >= Math.min(remaining, maxPerOrder)
                                  }
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {ticket.desc && (
                          <div className="tbx-ticket-desc-box">
                            <span className="tbx-info-icon">ⓘ</span>
                            <span>{ticket.desc}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* =====================================================================
            CỘT PHẢI: SIDEBAR THÔNG TIN SỰ KIỆN, BẢNG GIÁ VÉ & NÚT TIẾP TỤC (IMAGE 6)
           ===================================================================== */}
        <aside className="tbx-sidebar">
          <div className="tbx-sidebar-scroll">
            {/* Tên sự kiện & Thời gian / Địa điểm */}
            <div className="tbx-sidebar-event-block">
              <h2 className="tbx-sidebar-event-title">
                {event.title || event.eventName}
              </h2>

              {activeSession && (
                <div className="tbx-sidebar-meta-line">
                  <span className="tbx-meta-icon">📅</span>
                  <span>{formatSessionDateTime(activeSession)}</span>
                </div>
              )}

              <div className="tbx-sidebar-meta-line">
                <span className="tbx-meta-icon">📍</span>
                <span>
                  {event.venueName || event.location || event.eventAddress}
                </span>
              </div>

              {/* Bộ chuyển suất diễn nếu sự kiện có nhiều suất */}
              {event.sessions?.length > 1 && (
                <div className="tbx-session-switcher">
                  <span className="tbx-session-switcher-label">
                    Đổi suất diễn:
                  </span>
                  <div className="tbx-session-pills">
                    {event.sessions.map((s, idx) => (
                      <button
                        key={s._id || idx}
                        type="button"
                        className={`tbx-session-pill ${
                          idx === selectedSessionIdx ? "active" : ""
                        }`}
                        onClick={() => handleSelectSession(idx)}
                      >
                        {s.name || `Suất ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bảng chú thích "Giá vé" với ô màu vuông chuẩn Image 6 */}
            <div className="tbx-sidebar-pricing-block">
              <h3 className="tbx-sidebar-section-heading">Giá vé</h3>
              <div className="tbx-pricing-legend-list">
                {activeSession?.tickets?.map((ticket, idx) => {
                  const color =
                    ticket.zoneColor || ZONE_PALETTE[idx % ZONE_PALETTE.length];
                  const remaining = getRemainingTickets(ticket);
                  const soldOut = remaining <= 0;

                  return (
                    <div
                      key={ticket._id || idx}
                      className="tbx-pricing-legend-row"
                    >
                      <div className="tbx-pricing-legend-left">
                        <span
                          className="tbx-color-swatch"
                          style={{ backgroundColor: color }}
                        />
                        <span className="tbx-legend-tier-name">
                          {ticket.name}
                        </span>
                      </div>
                      <div className="tbx-pricing-legend-right">
                        <span className="tbx-legend-tier-price">
                          {formatMoney(ticket.price)}
                        </span>
                        {soldOut && (
                          <span className="tbx-pink-soldout-badge small">
                            Hết vé
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danh sách vé / ghế đang chọn */}
            {cartItems.length > 0 && (
              <div className="tbx-sidebar-cart-block">
                <div className="tbx-cart-head">
                  <h3 className="tbx-sidebar-section-heading">
                    Vé đang chọn ({totalTicketsCount})
                  </h3>
                  <button
                    type="button"
                    className="tbx-clear-btn"
                    onClick={() => setCartItems([])}
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="tbx-selected-list">
                  {cartItems.map((item) => {
                    const isSeatedItem =
                      Array.isArray(item.seatIds) && item.seatIds.length > 0;
                    return (
                      <div key={item.id} className="tbx-selected-item">
                        <div className="tbx-selected-item-top">
                          <span
                            className="tbx-color-swatch"
                            style={{
                              backgroundColor: item.ticketColor || "#2dc274",
                            }}
                          />
                          <strong className="tbx-selected-name">
                            {item.ticketName}
                          </strong>
                          <span className="tbx-selected-qty">
                            x{item.quantity}
                          </span>
                          <button
                            type="button"
                            className="tbx-remove-item-btn"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            ×
                          </button>
                        </div>

                        {isSeatedItem && (
                          <div className="tbx-selected-seat-chips">
                            {item.seats?.map((s) => (
                              <span key={s._id} className="tbx-seat-chip">
                                {s.label}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSeat({
                                      _id: s._id,
                                      tierId: item.ticketId,
                                      section: s.section,
                                      row: s.row,
                                      number: s.number,
                                      status: "AVAILABLE",
                                    })
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="tbx-selected-subtotal">
                          {formatMoney(item.quantity * item.ticketPrice)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ô nhập mã giảm giá (Voucher) */}
            <div className="tbx-sidebar-voucher-block">
              <label className="tbx-voucher-label">Mã giảm giá (nếu có)</label>
              <input
                type="text"
                className="tbx-voucher-input"
                placeholder="Nhập mã voucher..."
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* FOOTER CỐ ĐỊNH DƯỚI CÙNG CỦA SIDEBAR (IMAGE 6) */}
          <div className="tbx-sidebar-footer">
            {note && (
              <div className={`tbx-footer-note ${isErrorNote ? "error" : ""}`}>
                {note}
              </div>
            )}

            {notification && (
              <div className="tbx-footer-success">{notification}</div>
            )}

            <div className="tbx-footer-summary-row">
              <div className="tbx-footer-ticket-icon">
                <span>🎟️</span>
                <span>
                  {totalTicketsCount > 0
                    ? `Đã chọn ${totalTicketsCount} vé`
                    : "Chưa chọn vé"}
                </span>
              </div>
              {totalTicketsCount > 0 && (
                <strong className="tbx-footer-total-price">
                  {formatMoney(grandTotal)}
                </strong>
              )}
            </div>

            <button
              type="button"
              className={`tbx-cta-submit-btn ${
                totalTicketsCount > 0 ? "active" : "empty"
              }`}
              disabled={submitting || totalTicketsCount === 0}
              onClick={handleCheckout}
            >
              {submitting
                ? "Đang xử lý giữ vé..."
                : totalTicketsCount === 0
                  ? "Vui lòng chọn vé"
                  : `Tiếp tục - ${formatMoney(grandTotal)} >>`}
            </button>
          </div>
        </aside>
      </div>

      {/* Modal phóng to sơ đồ */}
      {showImageModal && (
        <div
          className="tbx-modal-backdrop"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="tbx-modal-body"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tbx-modal-close"
              onClick={() => setShowImageModal(false)}
            >
              ✕
            </button>
            <img
              src={diagramBgUrl || event.bannerUrl || event.backgroundImage}
              alt="Sơ đồ sự kiện"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimeEventDetails;
