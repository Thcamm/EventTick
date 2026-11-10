import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import "./ResaleMarketPage.css";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80";

const fmtDay = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getDate()} Th ${dt.getMonth() + 1}`;
};

const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;

/**
 * Chợ vé bán lại — bước 1: danh sách sự kiện đang có vé bán lại.
 * Bấm vào sự kiện -> /resale/:eventId để chọn vé.
 */
const ResaleMarketPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axiosInstance.get("/resale/events");
        if (alive) setEvents(data.events || []);
      } catch (err) {
        if (alive) setError(err.response?.data?.message || "Không thể tải chợ vé bán lại lúc này.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => e.title.toLowerCase().includes(q)) : events;
  }, [events, query]);

  return (
    <div className="rsm-page">
      <section className="rsm-hero">
        <div className="rsm-hero-inner">
          <div className="rsm-hero-badge">🎟️</div>
          <div>
            <h1 className="rsm-hero-title">
              Resale Ticket
              <span>VÉ BÁN LẠI</span>
            </h1>
            <p className="rsm-hero-sub">
              Mua lại vé chính chủ an toàn — giá tối đa 110% giá gốc, thanh toán qua EventTick, vé mới được cấp mã QR riêng cho bạn.
            </p>
          </div>
        </div>
        <div className="rsm-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Nhập tên sự kiện bán lại vé"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      <div className="rsm-container">
        {error && <div className="rsm-alert">⚠️ {error}</div>}

        {loading ? (
          <div className="rsm-state">
            <div className="rsm-spinner" />
            <p>Đang tải các sự kiện có vé bán lại...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rsm-state">
            <div className="rsm-empty-icon">🎫</div>
            <h3>Hiện chưa có vé bán lại nào</h3>
            <p>Hãy quay lại sau hoặc khám phá các sự kiện đang mở bán.</p>
            <Link to="/" className="rsm-btn">Khám phá sự kiện</Link>
          </div>
        ) : (
          <div className="rsm-grid">
            {filtered.map((ev) => (
              <Link key={ev.id} to={`/resale/${ev.id}`} className="rsm-card">
                <div className="rsm-card-img">
                  <img src={ev.bannerUrl || FALLBACK_IMG} alt={ev.title} loading="lazy" />
                  <span className="rsm-card-count">{ev.listingCount} vé</span>
                </div>
                <h3 className="rsm-card-title">{ev.title}</h3>
                <div className="rsm-card-meta">
                  <span>{fmtDay(ev.nextSessionTime)}</span>
                  <span className="rsm-card-price">Từ {money(ev.minPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResaleMarketPage;
