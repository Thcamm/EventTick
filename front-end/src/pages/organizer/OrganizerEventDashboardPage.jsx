import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/services/apiClient";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { PATHS } from "@/routes/paths";
import "./OrganizerEventDashboardPage.css";

const OrganizerEventDashboardPage = () => {
  const { id, eventId: paramEventId } = useParams();
  const eventId = paramEventId || id;
  const [activeTab, setActiveTab] = useState("analytics"); // 'analytics' | 'attendees' | 'staff' | 'payout'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [payouts, setPayouts] = useState([]);

  // Add staff modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffEmailOrUsername, setStaffEmailOrUsername] = useState("");
  const [assignedGate, setAssignedGate] = useState("Cổng chính");
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffError, setStaffError] = useState(null);

  // Request payout modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState(null);

  const fetchData = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [analyticsRes, attendeesRes, staffRes, payoutsRes] = await Promise.all([
        apiClient.get(`/organizer/events/${eventId}/analytics`).catch(() => ({ data: null })),
        apiClient.get(`/organizer/events/${eventId}/attendees?limit=50`).catch(() => ({ data: null })),
        apiClient.get(`/organizer/events/${eventId}/staff`).catch(() => ({ data: null })),
        apiClient.get(`/organizer/events/${eventId}/payouts`).catch(() => ({ data: null })),
      ]);

      if (analyticsRes.data?.analytics) {
        setAnalytics(analyticsRes.data.analytics);
      }
      if (attendeesRes.data?.attendees) {
        setAttendees(attendeesRes.data.attendees);
      }
      if (staffRes.data?.staff) {
        setStaffList(staffRes.data.staff);
      }
      if (payoutsRes.data?.payouts) {
        setPayouts(payoutsRes.data.payouts);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải thông tin sự kiện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!staffEmailOrUsername.trim()) {
      setStaffError("Vui lòng nhập email hoặc username nhân viên");
      return;
    }

    try {
      setStaffSubmitting(true);
      setStaffError(null);
      await apiClient.post(`/organizer/events/${eventId}/staff`, {
        email: staffEmailOrUsername.includes("@") ? staffEmailOrUsername.trim() : undefined,
        username: !staffEmailOrUsername.includes("@") ? staffEmailOrUsername.trim() : undefined,
        assignedGate: assignedGate.trim(),
      });

      setShowAddStaffModal(false);
      setStaffEmailOrUsername("");
      // refresh staff
      const res = await apiClient.get(`/organizer/events/${eventId}/staff`);
      setStaffList(res.data?.staff || []);
    } catch (err) {
      setStaffError(err.response?.data?.message || "Không thể phân công nhân viên");
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleRemoveStaff = async (assignmentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phân công nhân viên này?")) return;
    try {
      await apiClient.delete(`/organizer/staff-assignments/${assignmentId}`);
      setStaffList((prev) => prev.filter((a) => a.assignmentId !== assignmentId));
    } catch (err) {
      alert(err.response?.data?.message || "Không thể xóa phân công");
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    try {
      setPayoutSubmitting(true);
      setPayoutError(null);
      await apiClient.post(`/organizer/events/${eventId}/payouts`, {
        notes: payoutNotes,
      });

      alert("Gửi yêu cầu thanh toán thành công! Admin sẽ đối soát và giải ngân vào tài khoản ngân hàng của bạn.");
      setShowPayoutModal(false);
      const res = await apiClient.get(`/organizer/events/${eventId}/payouts`);
      setPayouts(res.data?.payouts || []);
    } catch (err) {
      setPayoutError(err.response?.data?.message || "Không thể gửi yêu cầu giải ngân");
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const downloadCsv = async (endpoint, filename) => {
    try {
      const res = await apiClient.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Không thể tải file CSV: " + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="org-dash-loading">
        <LoadingSpinner text="Đang tải dữ liệu trung tâm điều hành sự kiện..." />
      </div>
    );
  }

  return (
    <div className="organizer-event-dashboard">
      {/* HEADER */}
      <div className="dash-header">
        <div className="dash-header-container">
          <div className="breadcrumbs">
            <Link to={PATHS.ADMIN_MY_EVENTS}>← Tất cả sự kiện</Link>
            <span className="sep">/</span>
            <span>Điều hành sự kiện</span>
          </div>

          <div className="dash-title-row">
            <div>
              <h1>{analytics?.title || "Bảng Điều Hành Sự Kiện"}</h1>
              <p className="event-id-text">Mã sự kiện: <span className="mono">{eventId}</span></p>
            </div>

            <div className="header-nav-buttons">
              <Link to={`/event/${eventId}`} className="btn-view-public" target="_blank">
                🌐 Xem trang bán vé
              </Link>
              <Link to={`/organizer/events/${eventId}/vouchers`} className="btn-go-voucher">
                🎟️ Quản lý Vouchers
              </Link>
              <Link to={`/staff/check-in?event=${eventId}`} className="btn-go-gate">
                📱 Cổng soát vé
              </Link>
            </div>
          </div>

          {/* TABS */}
          <div className="dash-tabs">
            <button
              className={`dash-tab ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              📊 Báo cáo Doanh thu & Vé
            </button>
            <button
              className={`dash-tab ${activeTab === "attendees" ? "active" : ""}`}
              onClick={() => setActiveTab("attendees")}
            >
              👥 Danh sách Khách & Vé ({attendees.length})
            </button>
            <button
              className={`dash-tab ${activeTab === "staff" ? "active" : ""}`}
              onClick={() => setActiveTab("staff")}
            >
              🛡️ Nhân viên Soát vé ({staffList.length})
            </button>
            <button
              className={`dash-tab ${activeTab === "payout" ? "active" : ""}`}
              onClick={() => setActiveTab("payout")}
            >
              💰 Quyết toán & Giải ngân ({payouts.length})
            </button>
          </div>
        </div>
      </div>

      <div className="dash-body-container">
        {error && <div className="dash-alert error">{error}</div>}

        {/* TAB 1: ANALYTICS & FINANCES */}
        {activeTab === "analytics" && analytics && (
          <div className="tab-pane">
            {/* STAT CARDS */}
            <div className="metrics-grid">
              <div className="metric-box">
                <span className="label">Doanh thu bán vé (Gross)</span>
                <span className="value green">
                  {(analytics.grossRevenue || 0).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="metric-box">
                <span className="label">Hoa hồng sàn ({analytics.commissionRatePct || 10}%)</span>
                <span className="value red">
                  -{(analytics.platformCommissionAmt || 0).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="metric-box">
                <span className="label">Thực nhận dự kiến (Net)</span>
                <span className="value highlight">
                  {(analytics.netEarnings || 0).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="metric-box">
                <span className="label">Tổng vé bán trực tuyến</span>
                <span className="value">{analytics.totalTicketsSold || 0} vé</span>
              </div>
              <div className="metric-box">
                <span className="label">Đã quét QR vào cổng</span>
                <span className="value cyan">
                  {analytics.checkedInCount || 0} / {analytics.totalTicketsSold || 0} ({analytics.checkInRatePct}%)
                </span>
              </div>
            </div>

            {/* TIER BREAKDOWN TABLE */}
            <div className="panel-card">
              <div className="card-title-row">
                <h3>Phân bổ Hạng vé (Ticket Tiers)</h3>
              </div>
              <div className="table-responsive">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Hạng vé</th>
                      <th>Giá vé</th>
                      <th>Tổng số vé</th>
                      <th>Đã bán</th>
                      <th>Còn lại</th>
                      <th>Doanh thu hạng vé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.tierAnalytics || []).map((t) => (
                      <tr key={t.tierId}>
                        <td className="bold">{t.tierName}</td>
                        <td>{t.price?.toLocaleString("vi-VN")} đ</td>
                        <td>{t.totalQuantity}</td>
                        <td className="green-text bold">{t.soldQuantity}</td>
                        <td>{t.availableQuantity}</td>
                        <td className="highlight-text bold">
                          {(t.revenue || 0).toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SESSIONS BREAKDOWN */}
            <div className="panel-card">
              <div className="card-title-row">
                <h3>Doanh thu theo Suất diễn (Sessions)</h3>
              </div>
              <div className="table-responsive">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Suất diễn</th>
                      <th>Thời gian bắt đầu</th>
                      <th>Số đơn hàng</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.sessionAnalytics || []).map((s) => (
                      <tr key={s.sessionId}>
                        <td className="bold">{s.sessionName}</td>
                        <td>{s.startTime ? new Date(s.startTime).toLocaleString("vi-VN") : "—"}</td>
                        <td>{s.ordersCount} đơn</td>
                        <td className="highlight-text bold">
                          {(s.revenue || 0).toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDEES & CSV EXPORTS */}
        {activeTab === "attendees" && (
          <div className="tab-pane">
            <div className="panel-card">
              <div className="card-title-row">
                <div>
                  <h3>Danh sách người tham dự & Vé điện tử</h3>
                  <p className="card-sub">Theo dõi mã vé online, định danh khách hàng và trạng thái quét cổng.</p>
                </div>
                <div className="export-buttons">
                  <button
                    className="btn-export"
                    onClick={() =>
                      downloadCsv(
                        `/organizer/events/${eventId}/export/attendees`,
                        `danh-sach-ve-${eventId}.csv`
                      )
                    }
                  >
                    📥 Xuất CSV Khách vé
                  </button>
                  <button
                    className="btn-export secondary"
                    onClick={() =>
                      downloadCsv(
                        `/organizer/events/${eventId}/export/orders`,
                        `danh-sach-don-hang-${eventId}.csv`
                      )
                    }
                  >
                    📥 Xuất CSV Đơn hàng
                  </button>
                </div>
              </div>

              {attendees.length === 0 ? (
                <div className="empty-panel">
                  <span>🎟️</span>
                  <p>Chưa có lượt đặt vé nào được xác nhận.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Mã Vé Online</th>
                        <th>Họ tên khách</th>
                        <th>Hạng vé</th>
                        <th>Vị trí ghế</th>
                        <th>Trạng thái vé</th>
                        <th>Thời điểm quét cổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((t) => (
                        <tr key={t.ticketCode}>
                          <td className="font-mono text-blue">{t.ticketCode}</td>
                          <td>
                            <div className="attendee-info">
                              <span className="attendee-name">{t.owner?.name || "Khách"}</span>
                              <span className="attendee-email">{t.owner?.email}</span>
                            </div>
                          </td>
                          <td>{t.tierName}</td>
                          <td><span className="badge-seat">{t.seat}</span></td>
                          <td>
                            <span className={`status-badge ticket-${t.status?.toLowerCase()}`}>
                              {t.status === "USED" ? "ĐÃ CHECK-IN" : "HỢP LỆ (CHƯA VÀO)"}
                            </span>
                          </td>
                          <td className="time-text">
                            {t.checkedInAt ? new Date(t.checkedInAt).toLocaleString("vi-VN") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STAFF MANAGEMENT */}
        {activeTab === "staff" && (
          <div className="tab-pane">
            <div className="panel-card">
              <div className="card-title-row">
                <div>
                  <h3>Phân Công Nhân Viên Soát Vé Cổng (Staff Assignments)</h3>
                  <p className="card-sub">
                    Chỉ định tài khoản nhân viên được quyền dùng camera quét vé online tại các cửa ra vào.
                  </p>
                </div>
                <button className="btn-add-staff" onClick={() => setShowAddStaffModal(true)}>
                  + Phân công nhân viên mới
                </button>
              </div>

              {staffList.length === 0 ? (
                <div className="empty-panel">
                  <span>🛡️</span>
                  <p>Chưa có nhân viên nào được phân công cho sự kiện này.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Tài khoản</th>
                        <th>Email / Điện thoại</th>
                        <th>Cổng phân công</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((s) => (
                        <tr key={s.assignmentId}>
                          <td className="bold">{s.staffUser?.name || "Nhân viên"}</td>
                          <td className="font-mono">{s.staffUser?.username || "—"}</td>
                          <td>{s.staffUser?.email || s.staffUser?.phone || "—"}</td>
                          <td>
                            <span className="badge-gate">{s.assignedGate || "Cổng chính"}</span>
                          </td>
                          <td>
                            <span className={`status-badge ${s.isActive ? "active" : "inactive"}`}>
                              {s.isActive ? "ĐANG HOẠT ĐỘNG" : "NGỪNG PHÂN CÔNG"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-remove-staff"
                              onClick={() => handleRemoveStaff(s.assignmentId)}
                            >
                              Xoá
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PAYOUT & SETTLEMENT */}
        {activeTab === "payout" && (
          <div className="tab-pane">
            <div className="panel-card">
              <div className="card-title-row">
                <div>
                  <h3>Yêu Cầu Quyết Toán & Giải Ngân Doanh Thu (Payouts)</h3>
                  <p className="card-sub">
                    Doanh thu sự kiện trừ đi tỷ lệ hoa hồng sàn sẽ được chuyển khoản trực tiếp vào tài khoản ngân hàng đã KYC.
                  </p>
                </div>
                <button className="btn-request-payout" onClick={() => setShowPayoutModal(true)}>
                  💸 Gửi yêu cầu giải ngân
                </button>
              </div>

              {payouts.length === 0 ? (
                <div className="empty-panel">
                  <span>💰</span>
                  <p>Chưa có yêu cầu thanh toán nào được tạo.</p>
                  <small>Sau khi sự kiện diễn ra thành công, hãy bấm gửi yêu cầu giải ngân để nhận tiền.</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Mã yêu cầu</th>
                        <th>Số tiền yêu cầu</th>
                        <th>Số tiền thực nhận</th>
                        <th>Trạng thái</th>
                        <th>Ngày yêu cầu</th>
                        <th>Ngày hoàn tất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p._id || p.id}>
                          <td className="font-mono">{p.payoutCode || p._id}</td>
                          <td className="bold">{(p.amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td className="bold green-text">
                            {(p.settledAmount || p.amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-badge payout-${p.status?.toLowerCase()}`}>
                              {p.status === "SETTLED"
                                ? "ĐÃ GIẢI NGÂN"
                                : p.status === "APPROVED"
                                ? "ĐÃ PHÊ DUYỆT"
                                : p.status === "PENDING"
                                ? "CHỜ DUYỆT"
                                : p.status}
                            </span>
                          </td>
                          <td>{new Date(p.created_at || p.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td>
                            {p.settled_at || p.settledAt
                              ? new Date(p.settled_at || p.settledAt).toLocaleDateString("vi-VN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ADD STAFF MODAL */}
      {showAddStaffModal && (
        <div className="modal-overlay" onClick={() => setShowAddStaffModal(false)}>
          <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Thêm Nhân Viên Soát Vé</h2>
              <button className="btn-close" onClick={() => setShowAddStaffModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddStaff} className="modal-form">
              {staffError && <div className="modal-alert error">{staffError}</div>}
              <div className="form-group">
                <label>Email hoặc Tên đăng nhập (Username) *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: staff01@gmail.com hoặc staff_hn"
                  value={staffEmailOrUsername}
                  onChange={(e) => setStaffEmailOrUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Vị trí cổng phụ trách</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cổng chính, Cổng VIP, Cửa A..."
                  value={assignedGate}
                  onChange={(e) => setAssignedGate(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddStaffModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-confirm" disabled={staffSubmitting}>
                  {staffSubmitting ? "Đang gán..." : "Phân công"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST PAYOUT MODAL */}
      {showPayoutModal && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Yêu Cầu Giải Ngân Doanh Thu</h2>
              <button className="btn-close" onClick={() => setShowPayoutModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRequestPayout} className="modal-form">
              {payoutError && <div className="modal-alert error">{payoutError}</div>}
              <div className="payout-summary-box">
                <p>Số tiền thực nhận ước tính: <strong>{(analytics?.netEarnings || 0).toLocaleString("vi-VN")} đ</strong></p>
                <small>Tiền sẽ được gửi vào thông tin ngân hàng đã xác thực KYC.</small>
              </div>
              <div className="form-group">
                <label>Ghi chú cho ban quản trị (nếu có)</label>
                <textarea
                  rows="3"
                  placeholder="Ví dụ: Yêu cầu quyết toán sau sự kiện..."
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowPayoutModal(false)}>
                  Đóng
                </button>
                <button type="submit" className="btn-confirm" disabled={payoutSubmitting}>
                  {payoutSubmitting ? "Đang gửi..." : "Xác nhận gửi yêu cầu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerEventDashboardPage;