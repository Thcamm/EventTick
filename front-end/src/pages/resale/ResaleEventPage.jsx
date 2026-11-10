import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { PATHS } from "@/routes/paths";
import "./ResaleListPage.css";

const REFRESH_MS = 15000;

const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" }) : "—");

/**
 * Chợ vé bán lại — danh sách gói vé của 1 sự kiện (lưới thẻ giống Ticketbox).
 * Mỗi thẻ = 1 gói (mã RSL…); bấm vào để chọn vé ở /resale/:eventId/:bundleCode.
 */
const ResaleEventPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("ALL");
  const [onlyPartial, setOnlyPartial] = useState("ALL"); // ALL | PARTIAL | WHOLE
  const [showFilter, setShowFilter] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      try {
        const { data: res } = await axiosInstance.get(`/resale/events/${eventId}`);
        setData(res);
      } catch (err) {
        if (!silent) setError(err.response?.data?.message || "Không tải được danh sách vé bán lại.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const sessionById = useMemo(() => new Map((data?.sessions || []).map((s) => [String(s.id), s])), [data]);

  const cards = useMemo(() => {
    const all = data?.bundles || [];
    return all.filter((b) => {
      if (sessionId !== "ALL" && String(b.sessionId) !== sessionId) return false;
      if (onlyPartial === "PARTIAL" && !b.allowPartial) return false;
      if (onlyPartial === "WHOLE" && b.allowPartial) return false;
      return true;
    });
  }, [data, sessionId, onlyPartial]);

  if (loading) {
    return (
      <div className="rsl-page rsl-center">
        <div className="rsl-spinner" />
        <p>Đang tải danh sách vé bán lại...</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rsl-page rsl-center">
        <p className="rsl-error">{error || "Không tìm thấy sự kiện."}</p>
        <Link to={PATHS.RESALE_MARKET} className="rsl-btn">Quay lại Chợ vé</Link>
      </div>
    );
  }

  return (
    <div className="rsl-page">
      <div className="rsl-top">
        <div className="rsl-top-inner">
          <div>
            <div className="rsl-breadcrumb">
              <Link to="/">Trang chủ</Link>
              <span>›</span>
              <Link to={PATHS.RESALE_MARKET}>Vé bán lại</Link>
              <span>›</span>
              <strong>{data.event.title}</strong>
            </div>
            <h1>Danh sách vé bán lại</h1>
          </div>
          <div className="rsl-filters">
            <select
              className="rsl-pill"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              aria-label="Lọc suất diễn"
            >
              <option value="ALL">Tất cả suất diễn</option>
              {data.sessions.map((s) => (
                <option key={s.id} value={String(s.id)}>{fmtDate(s.startTime)} · {fmtTime(s.startTime)}</option>
              ))}
            </select>
            <div className="rsl-filter-wrap">
              <button type="button" className="rsl-pill" onClick={() => setShowFilter((v) => !v)}>
                ⏷ Bộ lọc
              </button>
              {showFilter && (
                <div className="rsl-filter-menu">
                  {[
                    ["ALL", "Tất cả"],
                    ["PARTIAL", "Bán lẻ"],
                    ["WHOLE", "Không bán lẻ"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={onlyPartial === k ? "is-active" : ""}
                      onClick={() => {
                        setOnlyPartial(k);
                        setShowFilter(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rsl-container">
        {cards.length === 0 ? (
          <div className="rsl-empty">Hiện không có vé bán lại phù hợp.</div>
        ) : (
          <div className="rsl-grid">
            {cards.map((b) => {
              const session = sessionById.get(String(b.sessionId));
              const available = b.items.filter((i) => !i.held);
              const allHeld = available.length === 0;
              const price = Math.min(...b.items.map((i) => i.resalePrice));
              return (
                <button
                  key={b.code}
                  type="button"
                  className={`rsl-card ${allHeld ? "is-held" : ""}`}
                  onClick={() => navigate(`/resale/${eventId}/${b.code}`)}
                >
                  <div className="rsl-card-head">
                    <span className="rsl-dot" style={{ background: b.zoneColor || "#5b8def" }} />
                    <span className="rsl-card-title">{b.tierName}</span>
                  </div>
                  <div className="rsl-card-body">
                    <div className="rsl-row">
                      <span className={`rsl-badge ${b.allowPartial ? "is-partial" : "is-whole"}`}>
                        {b.allowPartial ? "Bán lẻ" : "Không bán lẻ"}
                      </span>
                      <span className="rsl-code">{b.code}</span>
                    </div>
                    <div className="rsl-row">
                      <span className="rsl-muted">Số lượng:</span>
                      <strong>{available.length}</strong>
                    </div>
                    <div className="rsl-row rsl-row-session">
                      <span className="rsl-muted">Suất diễn:</span>
                      <span className="rsl-session">
                        <strong>{fmtTime(session?.startTime)}</strong>
                        <strong>{fmtDate(session?.startTime)}</strong>
                      </span>
                    </div>
                    <div className="rsl-row">
                      <span className="rsl-muted">Giá bán mỗi vé:</span>
                      <strong className="rsl-price">{money(price)}</strong>
                    </div>
                    {allHeld && <div className="rsl-held">Đang chờ thanh toán</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResaleEventPage;
