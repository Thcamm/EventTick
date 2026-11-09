import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminRefundPage.css";

export default function AdminRefundPage() {
  const [refunds, setRefunds] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PROCESSING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Bulk refund modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkEventId, setBulkEventId] = useState("");
  const [bulkReason, setBulkReason] = useState("Sự kiện bị huỷ theo quyết định của ban tổ chức");
  const [bulkResult, setBulkResult] = useState(null);

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get("/admin/refunds", { params });
      if (res.data?.success) {
        setRefunds(res.data.refunds || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách hoàn tiền" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleApprove = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn phê duyệt hoàn tiền này? Tiền sẽ được hoàn và ghế/vé sẽ được tự động giải phóng.")) return;
    try {
      setActionLoading(id);
      const res = await api.put(`/admin/refunds/${id}/approve`);
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã phê duyệt hoàn tiền thành công" });
        fetchRefunds();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể duyệt hoàn tiền" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn từ chối yêu cầu hoàn tiền này?")) return;
    try {
      setActionLoading(id);
      const res = await api.put(`/admin/refunds/${id}/reject`);
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã từ chối yêu cầu hoàn tiền" });
        fetchRefunds();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể từ chối yêu cầu" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRefundSubmit = async (e) => {
    e.preventDefault();
    if (!bulkEventId.trim()) {
      setToast({ type: "error", message: "Vui lòng nhập ID sự kiện cần hoàn tiền hàng loạt" });
      return;
    }

    try {
      setActionLoading("bulk");
      const res = await api.post(`/admin/events/${bulkEventId.trim()}/bulk-refund`, {
        reason: bulkReason.trim(),
      });
      if (res.data?.success) {
        setBulkResult(res.data);
        setToast({
          type: "success",
          message: `Đã hoàn tất hoàn tiền hàng loạt cho ${res.data.refundedCount || 0} đơn hàng!`,
        });
        fetchRefunds();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể hoàn tiền hàng loạt" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatVnd = (val) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);
  };

  return (
    <div className="admin-refund-page">
      <div className="admin-container">
        <div className="page-header flex-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Hoàn tiền vé (UC43)</span>
            </div>
            <h1>Quản lý Hoàn tiền & Huỷ sự kiện hàng loạt</h1>
            <p className="subtitle">
              Xem xét xử lý các khiếu nại hoàn tiền vé online, tự động thu hồi mã vé HMAC, giải phóng ghế vào kho vé và kích hoạt quy trình hoàn tiền hàng loạt khi sự kiện bị huỷ.
            </p>
          </div>
          <button className="btn-bulk-refund-open" onClick={() => setShowBulkModal(true)}>
            ⚡ Hoàn tiền hàng loạt sự kiện huỷ
          </button>
        </div>

        {toast && (
          <div className={`toast-banner ${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-card">
          <div className="filter-group">
            <label>Trạng thái yêu cầu:</label>
            <div className="filter-tabs">
              <button
                className={statusFilter === "PROCESSING" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("PROCESSING");
                  setPage(1);
                }}
              >
                Chờ xử lý (PROCESSING)
              </button>
              <button
                className={statusFilter === "COMPLETED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("COMPLETED");
                  setPage(1);
                }}
              >
                Đã hoàn tiền (COMPLETED)
              </button>
              <button
                className={statusFilter === "REJECTED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("REJECTED");
                  setPage(1);
                }}
              >
                Đã từ chối (REJECTED)
              </button>
              <button
                className={statusFilter === "" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                Tất cả ({total})
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-card">
          {loading ? (
            <div className="tab-loading">Đang tải danh sách hoàn tiền...</div>
          ) : refunds.length === 0 ? (
            <div className="tab-empty">Không tìm thấy yêu cầu hoàn tiền nào.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Sự kiện / Mã đơn</th>
                    <th>Mã vé / Loại</th>
                    <th>Số tiền hoàn</th>
                    <th>Lý do khiếu nại</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="user-cell">
                          <strong>{r.user?.name || "Khách hàng"}</strong>
                          <div className="email-sub">{r.user?.email}</div>
                          <div className="phone-sub">{r.user?.phone}</div>
                        </div>
                      </td>
                      <td>
                        <strong className="event-title-cell">{r.eventName || "—"}</strong>
                        <div className="order-code-sub">Mã đơn: #{r.orderCode || "—"}</div>
                      </td>
                      <td>
                        {r.ticketCode ? (
                          <span className="ticket-code-tag">{r.ticketCode}</span>
                        ) : (
                          <span className="order-level-tag">Toàn bộ đơn hàng</span>
                        )}
                        <div className="type-sub">{r.refundType}</div>
                      </td>
                      <td className="amount-cell">
                        <strong>{formatVnd(r.refundAmount)}</strong>
                      </td>
                      <td>
                        <div className="reason-text">{r.reason || "Không có lý do chi tiết"}</div>
                        <div className="date-sub">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "—"}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            r.status === "COMPLETED"
                              ? "active"
                              : r.status === "PROCESSING"
                              ? "urgent"
                              : "blocked"
                          }`}
                        >
                          {r.status === "COMPLETED"
                            ? "Đã hoàn tất"
                            : r.status === "PROCESSING"
                            ? "Chờ phê duyệt"
                            : "Đã từ chối"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.status === "PROCESSING" ? (
                          <div className="action-buttons-cell">
                            <button
                              className="btn-approve"
                              disabled={actionLoading === r.id}
                              onClick={() => handleApprove(r.id)}
                            >
                              Duyệt hoàn
                            </button>
                            <button
                              className="btn-delete"
                              disabled={actionLoading === r.id}
                              onClick={() => handleReject(r.id)}
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="dim-text">
                            {r.processedAt ? new Date(r.processedAt).toLocaleDateString("vi-VN") : "Đã xong"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="table-pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                « Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Sau »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Refund Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="refund-modal-box">
            <h3>⚡ Hoàn tiền hàng loạt sự kiện huỷ bỏ</h3>
            <p className="modal-desc">
              Khi sự kiện bị hủy bỏ bất khả kháng hoặc theo yêu cầu cơ quan chức năng, tính năng này sẽ tự động:
              thu hồi toàn bộ mã vé điện tử, giải phóng sơ đồ ghế, hủy các phiên bán lại (Resale) đang hoạt động và ghi nhận hoàn tiền 100% cho người mua.
            </p>

            {bulkResult ? (
              <div className="bulk-success-box">
                <h4>✓ Hoàn tiền hàng loạt thành công!</h4>
                <ul>
                  <li>Số đơn hàng đã xử lý hoàn tiền: <strong>{bulkResult.refundedCount}</strong></li>
                  <li>Tổng số tiền hoàn trả: <strong>{formatVnd(bulkResult.totalRefundAmount)}</strong></li>
                  <li>Mã vé & Ghế ngồi đã giải phóng: Đầy đủ</li>
                </ul>
                <button
                  className="btn-save"
                  style={{ width: "100%", marginTop: "14px" }}
                  onClick={() => {
                    setBulkResult(null);
                    setShowBulkModal(false);
                    setBulkEventId("");
                  }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkRefundSubmit}>
                <div className="form-group">
                  <label>
                    Event ID sự kiện cần hoàn tiền <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 660f1b2c3d4e5f6a7b8c9d0e"
                    value={bulkEventId}
                    onChange={(e) => setBulkEventId(e.target.value)}
                  />
                  <small className="help-text">Nhập chính xác MongoDB ID của sự kiện bị huỷ.</small>
                </div>

                <div className="form-group">
                  <label>
                    Lý do huỷ sự kiện & hoàn tiền <span className="req">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowBulkModal(false);
                      setBulkResult(null);
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="btn-danger"
                    disabled={actionLoading === "bulk"}
                  >
                    {actionLoading === "bulk" ? "Đang xử lý hàng loạt..." : "⚡ Xác nhận hoàn tiền toàn bộ"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
