import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminKycPage.css";

export default function AdminKycPage() {
  const [profiles, setProfiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  // Detail / Action modal
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchKycProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get("/admin/kyc", { params });
      if (res.data?.success) {
        setProfiles(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(Math.ceil((res.data.total || 0) / 15) || 1);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách KYC" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchKycProfiles();
  }, [fetchKycProfiles]);

  const handleApprove = async (profileId) => {
    try {
      setActionLoading(profileId);
      const res = await api.put(`/admin/kyc/${profileId}/approve`);
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã phê duyệt hồ sơ KYC thành công. Tài khoản đã được nâng lên ORGANIZER." });
        setSelectedProfile(null);
        fetchKycProfiles();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể duyệt hồ sơ" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (profileId) => {
    if (!rejectReason.trim()) {
      setToast({ type: "error", message: "Vui lòng nhập lý do từ chối hồ sơ KYC" });
      return;
    }

    try {
      setActionLoading(profileId);
      const res = await api.put(`/admin/kyc/${profileId}/reject`, { reason: rejectReason.trim() });
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã từ chối hồ sơ KYC và gửi phản hồi cho Nhà tổ chức." });
        setSelectedProfile(null);
        setIsRejecting(false);
        setRejectReason("");
        fetchKycProfiles();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể từ chối hồ sơ" });
    } finally {
      setActionLoading(null);
    }
  };

  const openDocument = (profileId) => {
    window.open(`${api.defaults.baseURL || "/v1"}/admin/kyc/${profileId}/document`, "_blank");
  };

  return (
    <div className="admin-kyc-page">
      <div className="admin-container">
        <div className="kyc-page-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Kiểm duyệt KYC</span>
            </div>
            <h1>Kiểm duyệt hồ sơ định danh Nhà tổ chức (KYC)</h1>
            <p className="subtitle">
              Thẩm định căn cước công dân, giấy phép kinh doanh và tài khoản ngân hàng của đơn vị tổ chức trước khi cấp quyền tạo sự kiện.
            </p>
          </div>
          <div className="total-badge">
            Hồ sơ: <strong>{total}</strong>
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
            <label>Trạng thái duyệt:</label>
            <div className="filter-tabs">
              <button
                className={statusFilter === "PENDING" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("PENDING");
                  setPage(1);
                }}
              >
                Chờ duyệt (PENDING)
              </button>
              <button
                className={statusFilter === "VERIFIED" ? "tab-active" : ""}
                onClick={() => {
                  setStatusFilter("VERIFIED");
                  setPage(1);
                }}
              >
                Đã duyệt (VERIFIED)
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
                Tất cả
              </button>
            </div>
          </div>
        </div>

        {/* Profiles Table */}
        <div className="kyc-table-card">
          {loading ? (
            <div className="kyc-loading">Đang tải danh sách hồ sơ KYC...</div>
          ) : profiles.length === 0 ? (
            <div className="kyc-empty">Không có hồ sơ KYC nào trong mục này.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tổ chức / Cá nhân</th>
                    <th>Chủ tài khoản</th>
                    <th>Loại hình</th>
                    <th>Số ĐK / CCCD</th>
                    <th>Tài khoản ngân hàng</th>
                    <th>Trạng thái</th>
                    <th>Ngày gửi</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="org-name-cell">
                          <strong>{p.company_name || p.organizationName || p.idCardOrTaxCode}</strong>
                          <div className="email-sub">{p.user?.email || p.ownerEmail}</div>
                        </div>
                      </td>
                      <td>
                        <div className="owner-cell">
                          <div>{p.user?.full_name || p.ownerName || "—"}</div>
                          <div className="phone-sub">{p.user?.phone || p.ownerPhone || ""}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`org-type-badge ${p.organization_type === "BUSINESS" ? "biz" : "ind"}`}>
                          {p.organization_type === "BUSINESS" ? "Doanh nghiệp" : "Cá nhân"}
                        </span>
                      </td>
                      <td>
                        <code className="id-code">{p.id_card_or_tax_code || p.idCardOrTaxCode}</code>
                      </td>
                      <td>
                        {p.bank_account_info ? (
                          <div className="bank-info-cell">
                            <strong>{p.bank_account_info.bank_name || p.bank_account_info.bankName}</strong>
                            <div>{p.bank_account_info.account_number || p.bank_account_info.accountNumber}</div>
                            <div className="dim-text">
                              {p.bank_account_info.account_holder_name || p.bank_account_info.accountHolderName}
                            </div>
                          </div>
                        ) : (
                          <span className="dim-text">Chưa cung cấp</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            p.kyc_status === "VERIFIED"
                              ? "active"
                              : p.kyc_status === "PENDING"
                              ? "pending"
                              : "blocked"
                          }`}
                        >
                          {p.kyc_status === "VERIFIED"
                            ? "Đã duyệt"
                            : p.kyc_status === "PENDING"
                            ? "Chờ duyệt"
                            : "Bị từ chối"}
                        </span>
                      </td>
                      <td className="date-cell">
                        {p.submitted_at || p.createdAt
                          ? new Date(p.submitted_at || p.createdAt).toLocaleDateString("vi-VN")
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="action-buttons-cell">
                          <button
                            className="btn-view"
                            onClick={() => {
                              setSelectedProfile(p);
                              setIsRejecting(false);
                            }}
                          >
                            Chi tiết
                          </button>
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
            <div className="pagination-bar">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                « Trước
              </button>
              <span>
                Trang <strong>{page}</strong> / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Sau »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Detail / Approval Modal */}
      {selectedProfile && (
        <div className="modal-overlay">
          <div className="kyc-modal-box">
            <div className="modal-header-row">
              <h3>Hồ sơ KYC: {selectedProfile.company_name || selectedProfile.organizationName}</h3>
              <button className="btn-close" onClick={() => setSelectedProfile(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body-scroll">
              <div className="info-grid">
                <div className="info-row">
                  <span className="label">Loại hình tổ chức:</span>
                  <span className="value">
                    {selectedProfile.organization_type === "BUSINESS" ? "Doanh nghiệp (Pháp nhân)" : "Cá nhân tổ chức"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Tên tổ chức / Công ty:</span>
                  <span className="value bold">{selectedProfile.company_name || selectedProfile.organizationName}</span>
                </div>
                <div className="info-row">
                  <span className="label">Mã số thuế / Số CCCD:</span>
                  <span className="value">{selectedProfile.id_card_or_tax_code || selectedProfile.idCardOrTaxCode}</span>
                </div>
                <div className="info-row">
                  <span className="label">Địa chỉ trụ sở / Liên hệ:</span>
                  <span className="value">{selectedProfile.address || "Chưa cung cấp"}</span>
                </div>
                <div className="info-row">
                  <span className="label">Người đại diện:</span>
                  <span className="value">
                    {selectedProfile.user?.full_name || selectedProfile.ownerName} (
                    {selectedProfile.user?.email || selectedProfile.ownerEmail})
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Số điện thoại liên hệ:</span>
                  <span className="value">{selectedProfile.user?.phone || selectedProfile.ownerPhone || "—"}</span>
                </div>
              </div>

              {/* Bank Details */}
              <div className="section-block">
                <h4>Thông tin tài khoản nhận quyết toán doanh thu</h4>
                {selectedProfile.bank_account_info ? (
                  <div className="bank-card-preview">
                    <div>
                      Ngân hàng:{" "}
                      <strong>
                        {selectedProfile.bank_account_info.bank_name || selectedProfile.bank_account_info.bankName}
                      </strong>
                    </div>
                    <div>
                      Số tài khoản:{" "}
                      <code>
                        {selectedProfile.bank_account_info.account_number ||
                          selectedProfile.bank_account_info.accountNumber}
                      </code>
                    </div>
                    <div>
                      Chủ tài khoản:{" "}
                      <strong>
                        {selectedProfile.bank_account_info.account_holder_name ||
                          selectedProfile.bank_account_info.accountHolderName}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="dim-text">Chưa cấu hình tài khoản ngân hàng</div>
                )}
              </div>

              {/* Document attachment */}
              <div className="section-block">
                <h4>Giấy phép kinh doanh / Giấy tờ pháp lý</h4>
                <div className="doc-preview-banner">
                  <span>📄 Giấy tờ đính kèm được lưu trữ bảo mật (Private Storage)</span>
                  <button className="btn-open-doc" onClick={() => openDocument(selectedProfile._id)}>
                    Xem tài liệu ↗
                  </button>
                </div>
              </div>

              {selectedProfile.rejection_reason && (
                <div className="rejection-box">
                  <strong>Lý do từ chối trước đó:</strong> {selectedProfile.rejection_reason}
                </div>
              )}

              {/* Rejection input when toggled */}
              {isRejecting && (
                <div className="reject-form-box">
                  <label>
                    Nhập lý do từ chối hồ sơ <span className="req">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Giấy phép kinh doanh bị mờ, mã số thuế không khớp với cơ sở dữ liệu quốc gia..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="reject-actions">
                    <button className="btn-secondary" onClick={() => setIsRejecting(false)}>
                      Huỷ bỏ
                    </button>
                    <button
                      className="btn-danger"
                      disabled={actionLoading === selectedProfile._id}
                      onClick={() => handleReject(selectedProfile._id)}
                    >
                      {actionLoading === selectedProfile._id ? "Đang xử lý..." : "Xác nhận từ chối"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedProfile.kyc_status === "PENDING" && !isRejecting && (
              <div className="modal-actions-footer">
                <button className="btn-reject-toggle" onClick={() => setIsRejecting(true)}>
                  Từ chối hồ sơ
                </button>
                <button
                  className="btn-approve"
                  disabled={actionLoading === selectedProfile._id}
                  onClick={() => handleApprove(selectedProfile._id)}
                >
                  {actionLoading === selectedProfile._id ? "Đang duyệt..." : "✓ Phê duyệt & Cấp quyền ORGANIZER"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
