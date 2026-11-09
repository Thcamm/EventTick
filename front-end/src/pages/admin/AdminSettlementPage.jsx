import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminSettlementPage.css";

export default function AdminSettlementPage() {
  const [payouts, setPayouts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Settle modal
  const [settlingPayout, setSettlingPayout] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get("/admin/payouts", { params });
      if (res.data?.success) {
        setPayouts(res.data.payouts || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách đối soát" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      const res = await api.put(`/admin/payouts/${id}/approve`);
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã phê duyệt yêu cầu đối soát" });
        fetchPayouts();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể phê duyệt yêu cầu" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settlingPayout) return;

    try {
      setActionLoading(settlingPayout.id);
      const res = await api.put(`/admin/payouts/${settlingPayout.id}/settle`, {
        bankTransferReceiptUrl: receiptUrl.trim() || "bank_confirmed",
        note: note.trim() || undefined,
      });
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã xác nhận giải ngân thành công cho Nhà tổ chức" });
        setSettlingPayout(null);
        setReceiptUrl("");
        setNote("");
        fetchPayouts();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể xác nhận giải ngân" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatVnd = (val) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);
  };

  return (
    <div className="admin-settlement-page">
      <div className="admin-container">
        <div className="page-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Đối soát & Giải ngân</span>
            </div>
            <h1>Quản lý Đối soát & Giải ngân doanh thu (UC42)</h1>
            <p className="subtitle">
              Xác thực doanh thu bán vé online của Nhà tổ chức, tính toán hoa hồng nền tảng và thực hiện giải ngân qua tài khoản ngân hàng đã KYC.
            </p>
          </div>
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
            <label>Trạng thái thanh toán:</label>
            <div className="filter-tabs">
              <button
                className={statusFilter === "" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                Tất cả ({total})
              </button>
              <button
                className={statusFilter === "REQUESTED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("REQUESTED");
                  setPage(1);
                }}
              >
                Chờ duyệt (REQUESTED)
              </button>
              <button
                className={statusFilter === "APPROVED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("APPROVED");
                  setPage(1);
                }}
              >
                Đã duyệt - Chờ chuyển tiền (APPROVED)
              </button>
              <button
                className={statusFilter === "SETTLED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("SETTLED");
                  setPage(1);
                }}
              >
                Đã giải ngân (SETTLED)
              </button>
            </div>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="table-card">
          {loading ? (
            <div className="tab-loading">Đang tải danh sách giải ngân...</div>
          ) : payouts.length === 0 ? (
            <div className="tab-empty">Không tìm thấy yêu cầu đối soát nào.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sự kiện</th>
                    <th>Nhà tổ chức & STK</th>
                    <th>Tổng GMV vé</th>
                    <th>Hoa hồng sàn (-)</th>
                    <th>Thực nhận (Net)</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong className="event-title-cell">{p.event?.title || "Sự kiện"}</strong>
                        <div className="date-sub">
                          Yêu cầu: {p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "—"}
                        </div>
                      </td>
                      <td>
                        <div className="org-name-cell">
                          <strong>{p.organizer?.name || "Organizer"}</strong>
                          <div className="email-sub">{p.organizer?.email}</div>
                          {p.organizer?.bankAccount && (
                            <div className="bank-info-pill">
                              🏦 {p.organizer.bankAccount.bank_name} - {p.organizer.bankAccount.account_number} ({p.organizer.bankAccount.account_holder_name})
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="amount-cell">{formatVnd(p.grossRevenue)}</td>
                      <td className="commission-cell">-{formatVnd(p.platformCommissionAmt)}</td>
                      <td className="net-amount-cell">
                        <strong>{formatVnd(p.netPayoutAmount)}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            p.status === "SETTLED"
                              ? "active"
                              : p.status === "APPROVED"
                              ? "pending"
                              : "urgent"
                          }`}
                        >
                          {p.status === "SETTLED"
                            ? "Đã giải ngân"
                            : p.status === "APPROVED"
                            ? "Đã duyệt chi"
                            : "Chờ phê duyệt"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="action-buttons-cell">
                          {p.status === "REQUESTED" && (
                            <>
                              <button
                                className="btn-approve"
                                disabled={actionLoading === p.id}
                                onClick={() => handleApprove(p.id)}
                              >
                                Duyệt
                              </button>
                              <button
                                className="btn-settle"
                                disabled={actionLoading === p.id}
                                onClick={() => setSettlingPayout(p)}
                              >
                                Giải ngân ngay
                              </button>
                            </>
                          )}
                          {p.status === "APPROVED" && (
                            <button
                              className="btn-settle"
                              disabled={actionLoading === p.id}
                              onClick={() => setSettlingPayout(p)}
                            >
                              Xác nhận đã chuyển khoản
                            </button>
                          )}
                          {p.status === "SETTLED" && (
                            <span className="settled-text">
                              ✓ {p.settledByAdmin || "Admin"} ({p.settledAt ? new Date(p.settledAt).toLocaleDateString("vi-VN") : ""})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
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

      {/* Settle Modal */}
      {settlingPayout && (
        <div className="modal-overlay">
          <div className="settle-modal-box">
            <h3>Xác nhận chuyển khoản giải ngân</h3>
            <div className="settle-summary">
              <div className="summary-row">
                <span>Nhà tổ chức:</span>
                <strong>{settlingPayout.organizer?.name}</strong>
              </div>
              <div className="summary-row">
                <span>Tài khoản nhận:</span>
                <span>
                  {settlingPayout.organizer?.bankAccount
                    ? `${settlingPayout.organizer.bankAccount.bank_name} - ${settlingPayout.organizer.bankAccount.account_number} (${settlingPayout.organizer.bankAccount.account_holder_name})`
                    : "Chưa cập nhật tài khoản"}
                </span>
              </div>
              <div className="summary-row total-highlight">
                <span>Số tiền chuyển khoản (Net):</span>
                <strong>{formatVnd(settlingPayout.netPayoutAmount)}</strong>
              </div>
            </div>

            <form onSubmit={handleSettleSubmit}>
              <div className="form-group">
                <label>Mã giao dịch / Biên lai chuyển tiền ngân hàng:</label>
                <input
                  type="text"
                  placeholder="VD: FT2603948271 hoặc link ảnh chứng từ..."
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Ghi chú đối soát nội bộ:</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thêm (nếu có)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setSettlingPayout(null)}>
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="btn-settle-confirm"
                  disabled={actionLoading === settlingPayout.id}
                >
                  {actionLoading === settlingPayout.id ? "Đang xử lý..." : "✓ Xác nhận đã giải ngân"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
