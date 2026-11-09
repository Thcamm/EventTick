import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import "./StaffTrafficPage.css";

const StaffTrafficPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    searchParams.get("eventId") || ""
  );
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch list of available events for dropdown
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axiosInstance.get("/events/search?limit=30");
        if (res.data?.success && res.data.events?.length) {
          setEvents(res.data.events);
          if (!selectedEventId) {
            setSelectedEventId(res.data.events[0]._id);
          }
        }
      } catch (err) {
        console.warn("Could not load events list:", err);
      }
    };
    fetchEvents();
  }, []);

  const fetchStats = async (evId) => {
    if (!evId) return;
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await axiosInstance.get(
        `/booking/staff/events/${evId}/check-in-stats`,
        { withCredentials: true }
      );
      if (res.data?.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Không thể tải thống kê lưu lượng soát vé. Bạn cần quyền Quản trị, Ban tổ chức hoặc Nhân viên soát vé được phân công.";
      setErrorMsg(msg);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchStats(selectedEventId);
      setSearchParams({ eventId: selectedEventId });
    }
  }, [selectedEventId]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return;
    const interval = setInterval(() => {
      fetchStats(selectedEventId);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEventId]);

  return (
    <div className="staff-traffic-page">
      {/* HEADER */}
      <div className="traffic-header">
        <div className="traffic-header-content">
          <div>
            <h1>Giám Sát Lưu Lượng Cổng Soát Vé (Gate Traffic)</h1>
            <p>
              Theo dõi tiến độ vào cổng thời gian thực, mật độ từng khu vực vé
              và tốc độ check-in để điều phối nhân sự cửa kiểm soát.
            </p>
          </div>
          <div className="traffic-header-actions">
            <Link to="/staff/check-in" className="btn-scanner-link">
              📱 Đến trang Quét QR Cổng
            </Link>
          </div>
        </div>
      </div>

      <div className="traffic-container">
        {/* SELECT EVENT & AUTO-REFRESH BAR */}
        <div className="traffic-toolbar">
          <div className="event-selector-wrap">
            <label htmlFor="event-select">Chọn sự kiện giám sát:</label>
            <select
              id="event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title || ev.eventName} ({ev.city || "Toàn quốc"})
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-controls">
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Tự động cập nhật (mỗi 6s)</span>
            </label>
            <button
              type="button"
              className="refresh-manual-btn"
              onClick={() => fetchStats(selectedEventId)}
              disabled={loading}
            >
              {loading ? "Đang tải..." : "🔄 Làm mới ngay"}
            </button>
          </div>
        </div>

        {errorMsg && <div className="traffic-error-alert">{errorMsg}</div>}

        {stats && (
          <div className="traffic-stats-grid">
            {/* OVERVIEW CARDS */}
            <div className="stat-card total">
              <span className="stat-title">Tổng số vé online phát hành</span>
              <span className="stat-num">{stats.totalTickets}</span>
              <span className="stat-hint">100% vé điện tử QR an toàn</span>
            </div>

            <div className="stat-card checked-in">
              <span className="stat-title">Khán giả đã vào cổng</span>
              <span className="stat-num">{stats.checkedInCount}</span>
              <span className="stat-hint">
                Tỷ lệ: {stats.checkInRatePct}% tổng vé
              </span>
            </div>

            <div className="stat-card remaining">
              <span className="stat-title">Khán giả chưa check-in</span>
              <span className="stat-num">{stats.remainingCount}</span>
              <span className="stat-hint">Đang di chuyển tới cổng</span>
            </div>

            {/* PROGRESS BAR BIG */}
            <div className="traffic-progress-card">
              <div className="progress-label-row">
                <span>Tiến độ soát vé tổng thể</span>
                <strong>{stats.checkInRatePct}%</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${stats.checkInRatePct}%` }}
                />
              </div>
            </div>

            {/* TIER BREAKDOWN TABLE */}
            <div className="tier-breakdown-card">
              <h3>Phân bổ check-in theo khu vực / hạng vé</h3>
              <div className="table-responsive">
                <table className="traffic-table">
                  <thead>
                    <tr>
                      <th>Hạng vé / Khu vực</th>
                      <th>Tổng vé</th>
                      <th>Đã vào</th>
                      <th>Chưa vào</th>
                      <th>Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.tierBreakdown || stats.tierStats || []).map((t) => {
                      const pct =
                        t.totalTickets > 0
                          ? Math.round((t.checkedIn / t.totalTickets) * 100)
                          : 0;
                      return (
                        <tr key={t.tierId}>
                          <td className="font-semibold">{t.tierName}</td>
                          <td>{t.totalTickets}</td>
                          <td className="text-emerald">{t.checkedIn}</td>
                          <td className="text-amber">{t.remaining}</td>
                          <td>
                            <div className="mini-progress-wrap">
                              <div className="mini-progress-track">
                                <div
                                  className="mini-progress-fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="mini-pct">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RECENT CHECK-INS STREAM */}
            <div className="recent-stream-card">
              <h3>Lượt soát vé gần đây nhất (Live Feed)</h3>
              <div className="stream-list">
                {(!stats.recentCheckIns || stats.recentCheckIns.length === 0) ? (
                  <p className="no-stream-text">Chưa có lượt soát vé nào</p>
                ) : (
                  stats.recentCheckIns.map((ci, idx) => (
                    <div className="stream-item" key={idx}>
                      <span className="stream-dot">🟢</span>
                      <div className="stream-info">
                        <strong>{ci.ticketCode}</strong>
                        <span className="stream-tier">[{ci.tierName}]</span>
                        <span className="stream-staff">
                          • Soát bởi: {ci.checkedInBy || "Cổng 1"}
                        </span>
                      </div>
                      <span className="stream-time">
                        {ci.checkedInAt
                          ? new Date(ci.checkedInAt).toLocaleTimeString("vi-VN")
                          : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffTrafficPage;
