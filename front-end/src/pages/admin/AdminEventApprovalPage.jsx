import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminEventApprovalPage.css";

export default function AdminEventApprovalPage() {
  const [activeTab, setActiveTab] = useState("events"); // 'events' | 'contracts'

  // Tab 1: Events
  const [events, setEvents] = useState([]);
  const [eventStatusFilter, setEventStatusFilter] = useState("PENDING");
  const [eventPage, setEventPage] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Tab 2: Contracts
  const [contracts, setContracts] = useState([]);
  const [contractStatusFilter, setContractStatusFilter] = useState("");
  const [contractPage, setContractPage] = useState(1);
  const [contractTotal, setContractTotal] = useState(0);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Approve modal
  const [approvingEvent, setApprovingEvent] = useState(null);
  const [commissionRate, setCommissionRate] = useState(10);
  const [customTerms, setCustomTerms] = useState("");

  // Reject modal
  const [rejectingEvent, setRejectingEvent] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Update commission modal for existing contract
  const [editingContract, setEditingContract] = useState(null);
  const [newCommissionRate, setNewCommissionRate] = useState(10);

  // Fetch Events
  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const params = { page: eventPage, limit: 15 };
      if (eventStatusFilter) params.status = eventStatusFilter;

      const res = await api.get("/admin/events", { params });
      if (res.data?.success) {
        setEvents(res.data.items || []);
        setEventTotal(res.data.total || 0);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách sự kiện" });
    } finally {
      setEventsLoading(false);
    }
  }, [eventPage, eventStatusFilter]);

  // Fetch Contracts
  const fetchContracts = useCallback(async () => {
    try {
      setContractsLoading(true);
      const params = { page: contractPage, limit: 15 };
      if (contractStatusFilter) params.status = contractStatusFilter;

      const res = await api.get("/admin/contracts", { params });
      if (res.data?.success) {
        setContracts(res.data.contracts || res.data.items || []);
        setContractTotal(res.data.total || 0);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách hợp đồng" });
    } finally {
      setContractsLoading(false);
    }
  }, [contractPage, contractStatusFilter]);

  useEffect(() => {
    if (activeTab === "events") {
      fetchEvents();
    } else {
      fetchContracts();
    }
  }, [activeTab, fetchEvents, fetchContracts]);

  // Initial load: fetch contract count so tab header displays accurately
  useEffect(() => {
    api.get("/admin/contracts")
      .then((res) => {
        if (res.data?.success) {
          setContractTotal(res.data.total || (res.data.items || []).length || 0);
        }
      })
      .catch(() => {});
  }, []);

  // Handlers
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approvingEvent) return;
    try {
      setActionLoading(approvingEvent._id);
      const res = await api.put(`/admin/events/${approvingEvent._id}/approve`, {
        commissionRatePct: Number(commissionRate),
        customTerms: customTerms.trim() || undefined,
      });
      if (res.data?.success) {
        setToast({
          type: "success",
          message: "Đã duyệt sự kiện và tạo hợp đồng điện tử. Đang chờ Nhà tổ chức ký số.",
        });
        setApprovingEvent(null);
        fetchEvents();
        api.get("/admin/contracts")
          .then((res) => {
            if (res.data?.success) {
              setContractTotal(res.data.total || (res.data.items || []).length || 0);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể duyệt sự kiện" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingEvent) return;
    if (!rejectReason.trim()) {
      setToast({ type: "error", message: "Vui lòng nhập lý do từ chối sự kiện" });
      return;
    }
    try {
      setActionLoading(rejectingEvent._id);
      const res = await api.put(`/admin/events/${rejectingEvent._id}/reject`, {
        reason: rejectReason.trim(),
      });
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã từ chối sự kiện và chuyển về trạng thái DRAFT cho Organizer." });
        setRejectingEvent(null);
        setRejectReason("");
        fetchEvents();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể từ chối sự kiện" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCommissionUpdate = async (e) => {
    e.preventDefault();
    if (!editingContract) return;
    try {
      setActionLoading(editingContract._id);
      const res = await api.put(`/admin/contracts/${editingContract._id}/commission`, {
        commissionRatePct: Number(newCommissionRate),
      });
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã cập nhật mức phí hoa hồng hợp đồng" });
        setEditingContract(null);
        fetchContracts();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể cập nhật hoa hồng" });
    } finally {
      setActionLoading(null);
    }
  };

  const openLegalDoc = (eventId) => {
    window.open(`${api.defaults.baseURL || "/v1"}/admin/events/${eventId}/legal-doc`, "_blank");
  };

  const openContractPdf = (contractId) => {
    window.open(`${api.defaults.baseURL || "/v1"}/admin/contracts/${contractId}/pdf`, "_blank");
  };

  return (
    <div className="admin-events-page">
      <div className="admin-container">
        <div className="events-page-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Phê duyệt sự kiện</span>
            </div>
            <h1>Kiểm duyệt sự kiện & Quản lý Hợp đồng điện tử</h1>
            <p className="subtitle">
              Thẩm định giấy phép biểu diễn, thiết lập hoa hồng sàn, phê duyệt phát hành vé và lưu trữ hợp đồng có giá trị pháp lý.
            </p>
          </div>
        </div>

        {toast && (
          <div className={`toast-banner ${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="main-tabs-bar">
          <button
            className={`main-tab-btn ${activeTab === "events" ? "active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            📋 Hàng chờ kiểm duyệt sự kiện ({eventTotal})
          </button>
          <button
            className={`main-tab-btn ${activeTab === "contracts" ? "active" : ""}`}
            onClick={() => setActiveTab("contracts")}
          >
            📜 Quản lý Hợp đồng điện tử ({contractTotal})
          </button>
        </div>

        {/* TAB 1: EVENTS */}
        {activeTab === "events" && (
          <>
            <div className="filter-card">
              <div className="filter-group">
                <label>Trạng thái sự kiện:</label>
                <div className="filter-tabs">
                  <button
                    className={eventStatusFilter === "PENDING" ? "tab-active" : ""}
                    onClick={() => {
                      setEventStatusFilter("PENDING");
                      setEventPage(1);
                    }}
                  >
                    Chờ duyệt (PENDING)
                  </button>
                  <button
                    className={eventStatusFilter === "APPROVED" ? "tab-active" : ""}
                    onClick={() => {
                      setEventStatusFilter("APPROVED");
                      setEventPage(1);
                    }}
                  >
                    Chờ ký HĐ (APPROVED)
                  </button>
                  <button
                    className={eventStatusFilter === "PUBLISHED" ? "tab-active" : ""}
                    onClick={() => {
                      setEventStatusFilter("PUBLISHED");
                      setEventPage(1);
                    }}
                  >
                    Đang mở bán (PUBLISHED)
                  </button>
                  <button
                    className={eventStatusFilter === "" ? "tab-active" : ""}
                    onClick={() => {
                      setEventStatusFilter("");
                      setEventPage(1);
                    }}
                  >
                    Tất cả
                  </button>
                </div>
              </div>
            </div>

            <div className="table-card">
              {eventsLoading ? (
                <div className="tab-loading">Đang tải danh sách sự kiện...</div>
              ) : events.length === 0 ? (
                <div className="tab-empty" style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                  <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                    {eventStatusFilter === "PENDING"
                      ? "Hiện không có sự kiện nào đang chờ duyệt."
                      : "Không có sự kiện nào trong danh mục này."}
                  </p>
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    {eventStatusFilter === "PENDING"
                      ? "Khi Nhà tổ chức gửi tạo sự kiện mới, sự kiện sẽ xuất hiện tại đây để Admin thẩm định giấy phép và phê duyệt."
                      : "Thay đổi bộ lọc để xem các sự kiện ở trạng thái khác."}
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tên sự kiện</th>
                        <th>Địa điểm & Thành phố</th>
                        <th>Thời gian</th>
                        <th>Giấy phép biểu diễn</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={e._id}>
                          <td>
                            <strong className="event-title-cell">{e.title}</strong>
                            {e.rejection_reason && (
                              <div className="rejection-snippet">Lý do từ chối: {e.rejection_reason}</div>
                            )}
                          </td>
                          <td>
                            <div>{e.venue_name || "—"}</div>
                            <div className="city-sub">{e.city || ""}</div>
                          </td>
                          <td className="date-cell">
                            {e.start_time ? new Date(e.start_time).toLocaleDateString("vi-VN") : "—"}
                          </td>
                          <td>
                            <button className="btn-legal-doc" onClick={() => openLegalDoc(e._id)}>
                              📄 Xem giấy phép ↗
                            </button>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                e.status === "PUBLISHED"
                                  ? "active"
                                  : e.status === "APPROVED"
                                  ? "pending"
                                  : e.status === "PENDING"
                                  ? "urgent"
                                  : "blocked"
                              }`}
                            >
                              {e.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {e.status === "PENDING" ? (
                              <div className="action-buttons-cell">
                                <button className="btn-approve" onClick={() => setApprovingEvent(e)}>
                                  Duyệt sự kiện
                                </button>
                                <button className="btn-delete" onClick={() => setRejectingEvent(e)}>
                                  Từ chối
                                </button>
                              </div>
                            ) : (
                              <span className="dim-text">Đã xử lý</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: CONTRACTS */}
        {activeTab === "contracts" && (
          <>
            <div className="filter-card">
              <div className="filter-group">
                <label>Trạng thái hợp đồng:</label>
                <div className="filter-tabs">
                  <button
                    className={contractStatusFilter === "" ? "tab-active" : ""}
                    onClick={() => {
                      setContractStatusFilter("");
                      setContractPage(1);
                    }}
                  >
                    Tất cả
                  </button>
                  <button
                    className={contractStatusFilter === "WAITING_SIGN" ? "tab-active" : ""}
                    onClick={() => {
                      setContractStatusFilter("WAITING_SIGN");
                      setContractPage(1);
                    }}
                  >
                    Chờ ký (WAITING_SIGN)
                  </button>
                  <button
                    className={contractStatusFilter === "SIGNED" ? "tab-active" : ""}
                    onClick={() => {
                      setContractStatusFilter("SIGNED");
                      setContractPage(1);
                    }}
                  >
                    Đã ký (SIGNED)
                  </button>
                </div>
              </div>
            </div>

            <div className="table-card">
              {contractsLoading ? (
                <div className="tab-loading">Đang tải danh sách hợp đồng...</div>
              ) : contracts.length === 0 ? (
                <div className="tab-empty" style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                  <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                    {contractStatusFilter === "WAITING_SIGN"
                      ? "Không có hợp đồng nào đang chờ ký."
                      : contractStatusFilter === "SIGNED"
                      ? "Chưa có hợp đồng nào đã ký số."
                      : "Không tìm thấy hợp đồng nào."}
                  </p>
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    Hợp đồng điện tử chỉ được hệ thống tự động khởi tạo sau khi Admin phê duyệt một sự kiện ở Tab &quot;Hàng chờ kiểm duyệt sự kiện&quot;.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Sự kiện</th>
                        <th>Phí hoa hồng sàn (%)</th>
                        <th>Trạng thái hợp đồng</th>
                        <th>Ngày ký</th>
                        <th>Bản PDF ký số</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => (
                        <tr key={c._id}>
                          <td>
                            <strong>{c.eventTitle || c.event_id?.title || "Hợp đồng sự kiện"}</strong>
                          </td>
                          <td>
                            <span className="commission-tag">
                              {c.commissionRatePct || c.commission_rate_pct}%
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${c.status === "SIGNED" ? "active" : "pending"}`}>
                              {c.status === "SIGNED" ? "Đã ký số" : "Chờ ký số"}
                            </span>
                          </td>
                          <td className="date-cell">
                            {c.signedAt || c.signed_at
                              ? new Date(c.signedAt || c.signed_at).toLocaleString("vi-VN")
                              : "—"}
                          </td>
                          <td>
                            {c.hasSignedPdf || c.signed_pdf_url ? (
                              <button className="btn-pdf-download" onClick={() => openContractPdf(c._id)}>
                                📥 Tải PDF ký số ↗
                              </button>
                            ) : (
                              <span className="dim-text">Chưa sinh PDF</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {c.status === "WAITING_SIGN" ? (
                              <button
                                className="btn-edit"
                                onClick={() => {
                                  setEditingContract(c);
                                  setNewCommissionRate(c.commissionRatePct || c.commission_rate_pct || 10);
                                }}
                              >
                                Đổi hoa hồng
                              </button>
                            ) : (
                              <span className="dim-text">Đã khóa điều khoản</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Approve Event Modal */}
      {approvingEvent && (
        <div className="modal-overlay">
          <div className="event-modal-box">
            <h3>Phê duyệt sự kiện: {approvingEvent.title}</h3>
            <p className="modal-desc">
              Sau khi duyệt, hệ thống sẽ tự động khởi tạo <strong>Hợp đồng hợp tác điện tử</strong> và gửi đến Nhà tổ chức
              để ký số trước khi vé được mở bán online.
            </p>
            <form onSubmit={handleApproveSubmit}>
              <div className="form-group">
                <label>
                  Tỷ lệ hoa hồng nền tảng thu (%) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  required
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                />
                <small className="help-text">Phần trăm trích lại trên mỗi vé bán thành công (mặc định 10%).</small>
              </div>

              <div className="form-group">
                <label>Điều khoản bổ sung riêng (Tùy chọn, gắn vào hợp đồng)</label>
                <textarea
                  rows={4}
                  placeholder="VD: Nhà tổ chức cam kết hoàn trả 100% nếu sự kiện bị hoãn quá 30 ngày..."
                  value={customTerms}
                  onChange={(e) => setCustomTerms(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setApprovingEvent(null)}>
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="btn-approve"
                  disabled={actionLoading === approvingEvent._id}
                >
                  {actionLoading === approvingEvent._id ? "Đang xử lý..." : "✓ Xác nhận phê duyệt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Event Modal */}
      {rejectingEvent && (
        <div className="modal-overlay">
          <div className="event-modal-box">
            <h3>Từ chối sự kiện: {rejectingEvent.title}</h3>
            <p className="modal-desc">
              Sự kiện sẽ được trả về trạng thái <strong>DRAFT</strong> để Nhà tổ chức bổ sung thông tin hoặc giấy phép theo yêu cầu.
            </p>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label>
                  Lý do từ chối <span className="req">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="VD: Giấy phép biểu diễn chưa có dấu đỏ của Sở VHTT, hoặc sơ đồ chỗ ngồi thiếu lối thoát hiểm..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setRejectingEvent(null)}>
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={actionLoading === rejectingEvent._id}
                >
                  {actionLoading === rejectingEvent._id ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Commission Modal */}
      {editingContract && (
        <div className="modal-overlay">
          <div className="event-modal-box">
            <h3>Cập nhật hoa hồng hợp đồng</h3>
            <form onSubmit={handleCommissionUpdate}>
              <div className="form-group">
                <label>Tỷ lệ hoa hồng mới (%):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  required
                  value={newCommissionRate}
                  onChange={(e) => setNewCommissionRate(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingContract(null)}>
                  Huỷ bỏ
                </button>
                <button type="submit" className="btn-save" disabled={actionLoading === editingContract._id}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
