import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./AdminDashboardPage.css";

const AdminDashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async (targetYear = year) => {
    setLoading(true);
    setError("");
    try {
      const [ovRes, revRes] = await Promise.all([
        apiClient.get("/admin/analytics/overview"),
        apiClient.get("/admin/analytics/revenue", { params: { year: targetYear } }),
      ]);
      setOverview(ovRes.data.overview);
      setRevenue(revRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải số liệu thống kê quản trị");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchData(year);
    }
  }, [user, year]);

  if (authLoading) return <div className="admin-loading"><div className="spinner"></div></div>;
  if (!user || user.role !== "ADMIN") return <Navigate to={PATHS.HOME} replace />;

  const formatVnd = (num) => (num || 0).toLocaleString("vi-VN") + " ₫";

  return (
    <div className="admin-dashboard-page">
      {/* HEADER */}
      <header className="admin-dash-header">
        <div className="admin-container header-inner">
          <div>
            <div className="admin-badge">HỆ THỐNG QUẢN TRỊ VIÊN</div>
            <h1>Tổng Quan Nền Tảng EventTick</h1>
            <p className="admin-subtitle">
              Giám sát sức khỏe vận hành, doanh thu bán vé online 100% và duyệt tác vụ hành chính.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-refresh" onClick={() => fetchData(year)} disabled={loading}>
              🔄 Cập nhật dữ liệu
            </button>
          </div>
        </div>
      </header>

      <main className="admin-container main-content">
        {error && <div className="admin-alert error">{error}</div>}

        {/* ACTION CARDS / PENDING NOTIFICATIONS */}
        {overview?.pendingActions && (
          <section className="pending-grid">
            <Link
              to={PATHS.ADMIN_KYC}
              className={`pending-card ${overview.pendingActions.kycProfiles > 0 ? "urgent" : ""}`}
            >
              <div className="pending-icon">🪪</div>
              <div className="pending-info">
                <span className="pending-count">{overview.pendingActions.kycProfiles}</span>
                <span className="pending-label">Hồ sơ KYC chờ duyệt</span>
              </div>
            </Link>

            <Link
              to={PATHS.ADMIN_EVENTS_APPROVAL}
              className={`pending-card ${overview.pendingActions.pendingEvents > 0 ? "urgent" : ""}`}
            >
              <div className="pending-icon">🎪</div>
              <div className="pending-info">
                <span className="pending-count">{overview.pendingActions.pendingEvents}</span>
                <span className="pending-label">Sự kiện chờ phê duyệt</span>
              </div>
            </Link>

            <Link
              to={PATHS.ADMIN_SETTLEMENTS}
              className={`pending-card ${overview.pendingActions.payoutRequests > 0 ? "urgent" : ""}`}
            >
              <div className="pending-icon">💰</div>
              <div className="pending-info">
                <span className="pending-count">{overview.pendingActions.payoutRequests}</span>
                <span className="pending-label">Yêu cầu đối soát giải ngân</span>
              </div>
            </Link>

            <Link
              to={PATHS.ADMIN_REFUNDS}
              className={`pending-card ${overview.pendingActions.refundRequests > 0 ? "urgent" : ""}`}
            >
              <div className="pending-icon">🔄</div>
              <div className="pending-info">
                <span className="pending-count">{overview.pendingActions.refundRequests}</span>
                <span className="pending-label">Yêu cầu hoàn tiền cần duyệt</span>
              </div>
            </Link>
          </section>
        )}

        {/* OVERALL FINANCIAL KPIS */}
        <section className="kpi-grid">
          <div className="kpi-card green-highlight">
            <span className="kpi-title">Tổng GMV toàn sàn</span>
            <span className="kpi-value">{formatVnd(overview?.financials?.totalGMV)}</span>
            <span className="kpi-sub">Giá trị giao dịch vé trực tuyến đã thanh toán</span>
          </div>

          <div className="kpi-card blue-highlight">
            <span className="kpi-title">Hoa hồng ước tính sàn (10%)</span>
            <span className="kpi-value">{formatVnd(overview?.financials?.estimatedCommission)}</span>
            <span className="kpi-sub">Doanh thu thu về từ phí hoa hồng hợp đồng</span>
          </div>

          <div className="kpi-card purple-highlight">
            <span className="kpi-title">Đơn hàng hoàn tất</span>
            <span className="kpi-value">{(overview?.financials?.paidOrdersCount || 0).toLocaleString()}</span>
            <span className="kpi-sub">Giao dịch SePay / Thẻ thành công</span>
          </div>

          <div className="kpi-card orange-highlight">
            <span className="kpi-title">Tổng thành viên</span>
            <span className="kpi-value">{(overview?.users?.total || 0).toLocaleString()}</span>
            <span className="kpi-sub">
              {overview?.users?.byRole?.ORGANIZER || 0} BTC • {overview?.users?.byRole?.STAFF || 0} Soát vé
            </span>
          </div>
        </section>

        {/* REVENUE BY MONTH */}
        <section className="admin-panel">
          <div className="panel-header-row">
            <div>
              <h2>Báo Cáo Doanh Thu Bán Vé Trực Tuyến Năm {year}</h2>
              <p className="panel-desc">Chi tiết GMV, phí hoa hồng nền tảng và số tiền hoàn vé từng tháng</p>
            </div>
            <div className="year-selector">
              <label>Năm:</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>

          {/* YEAR SUMMARY STATS */}
          {revenue?.summary && (
            <div className="year-summary-strip">
              <div className="strip-item">
                <span className="strip-label">Tổng GMV Năm:</span>
                <span className="strip-val">{formatVnd(revenue.summary.yearlyGross)}</span>
              </div>
              <div className="strip-item">
                <span className="strip-label">Đã hoàn tiền:</span>
                <span className="strip-val red">{formatVnd(revenue.summary.yearlyRefund)}</span>
              </div>
              <div className="strip-item">
                <span className="strip-label">GMV thực nhận (Net):</span>
                <span className="strip-val green">{formatVnd(revenue.summary.yearlyNetGMV)}</span>
              </div>
              <div className="strip-item">
                <span className="strip-label">Hoa hồng sàn:</span>
                <span className="strip-val cyan">{formatVnd(revenue.summary.yearlyCommissionRevenue)}</span>
              </div>
              <div className="strip-item">
                <span className="strip-label">Vé đã bán:</span>
                <span className="strip-val">{revenue.summary.totalTickets.toLocaleString()} vé</span>
              </div>
            </div>
          )}

          {/* TABLE OF 12 MONTHS */}
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Tổng doanh thu (GMV)</th>
                  <th>Hoàn tiền</th>
                  <th>Hoa hồng sàn (Revenue)</th>
                  <th>Số đơn hàng</th>
                  <th>Số vé điện tử</th>
                </tr>
              </thead>
              <tbody>
                {revenue?.monthlyStats?.map((m) => (
                  <tr key={m.month}>
                    <td className="bold">Tháng {m.month}</td>
                    <td className="bold">{formatVnd(m.grossMerchandiseValue)}</td>
                    <td className={m.refundAmount > 0 ? "red-text" : "dim-text"}>
                      {m.refundAmount > 0 ? `-${formatVnd(m.refundAmount)}` : "0 ₫"}
                    </td>
                    <td className="cyan-text bold">{formatVnd(m.platformCommissionRevenue)}</td>
                    <td>{m.ordersCount.toLocaleString()}</td>
                    <td>{m.ticketsCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* QUICK ACCESS HUB */}
        <section className="quick-access-section">
          <h2>Các Phân Hệ Quản Trị Hệ Thống</h2>
          <div className="quick-tools-grid">
            <Link to={PATHS.ADMIN_USERS} className="tool-card">
              <div className="tool-icon">👥</div>
              <div className="tool-details">
                <h3>Quản lý người dùng & Phân quyền</h3>
                <p>Khóa / mở khóa tài khoản, phân quyền Customer / Organizer / Staff / Admin</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_CATEGORIES} className="tool-card">
              <div className="tool-icon">🏷️</div>
              <div className="tool-details">
                <h3>Danh mục & Tỷ lệ hoa hồng</h3>
                <p>Cấu hình nhóm sự kiện, slug chuẩn SEO và mức hoa hồng mặc định</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_KYC} className="tool-card">
              <div className="tool-icon">📋</div>
              <div className="tool-details">
                <h3>Thẩm định định danh (KYC)</h3>
                <p>Kiểm duyệt CCCD, giấy phép kinh doanh ĐKKD và thông tin thuế nhà tổ chức</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_EVENTS_APPROVAL} className="tool-card">
              <div className="tool-icon">📑</div>
              <div className="tool-details">
                <h3>Phê duyệt sự kiện & Hợp đồng</h3>
                <p>Duyệt giấy phép biểu diễn, phát hành hợp đồng điện tử và ghim trang chủ</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_SEATMAP} className="tool-card">
              <div className="tool-icon">🗺️</div>
              <div className="tool-details">
                <h3>Dựng sơ đồ chỗ ngồi (SeatMap)</h3>
                <p>Import bản đồ SVG và file Excel manifest ghế cho sự kiện phân khu</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_SETTLEMENTS} className="tool-card">
              <div className="tool-icon">🏦</div>
              <div className="tool-details">
                <h3>Đối soát & Quyết toán giải ngân</h3>
                <p>Khấu trừ hoa hồng tự động, xác nhận ủy nhiệm chi và giải ngân lợi nhuận</p>
              </div>
            </Link>

            <Link to={PATHS.ADMIN_REFUNDS} className="tool-card">
              <div className="tool-icon">💸</div>
              <div className="tool-details">
                <h3>Xử lý hoàn tiền & Hủy sự kiện</h3>
                <p>Duyệt yêu cầu hoàn tiền cá nhân và chạy tiến trình hoàn tiền hàng loạt</p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
