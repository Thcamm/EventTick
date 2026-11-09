import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/services/apiClient";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { PATHS } from "@/routes/paths";
import "./OrganizerVouchersPage.css";

const OrganizerVouchersPage = () => {
  const { id, eventId: paramEventId } = useParams();
  const eventId = paramEventId || id;
  const [vouchers, setVouchers] = useState([]);
  const [roiSummary, setRoiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("PERCENT");
  const [discountValue, setDiscountValue] = useState(10);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(50000);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [maxUses, setMaxUses] = useState(100);
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(1);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchVouchersData = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [vouchersRes, roiRes] = await Promise.all([
        apiClient.get(`/organizer/events/${eventId}/vouchers`),
        apiClient.get(`/organizer/events/${eventId}/vouchers/roi`).catch(() => ({ data: null })),
      ]);

      setVouchers(vouchersRes.data?.vouchers || []);
      if (roiRes.data?.summary) {
        setRoiSummary(roiRes.data.summary);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách mã giảm giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchersData();
  }, [eventId]);

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setFormError("Vui lòng nhập mã voucher");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await apiClient.post(`/organizer/events/${eventId}/vouchers`, {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxDiscountAmount: discountType === "PERCENT" ? Number(maxDiscountAmount) : null,
        minOrderAmount: Number(minOrderAmount) || 0,
        maxUses: Number(maxUses),
        maxUsesPerUser: Number(maxUsesPerUser) || 1,
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
        isActive: true,
      });

      setShowCreateModal(false);
      setCode("");
      fetchVouchersData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Tạo mã giảm giá thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVoucherStatus = async (voucher) => {
    try {
      await apiClient.put(`/organizer/vouchers/${voucher.id || voucher._id}`, {
        isActive: !voucher.isActive,
      });
      fetchVouchersData();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể cập nhật trạng thái voucher");
    }
  };

  if (loading) {
    return (
      <div className="vouchers-loading-wrap">
        <LoadingSpinner text="Đang tải dữ liệu mã ưu đãi và ROI..." />
      </div>
    );
  }

  return (
    <div className="organizer-vouchers-page">
      <div className="vouchers-header">
        <div className="vouchers-header-container">
          <div className="breadcrumbs">
            <Link to={eventId ? `/organizer/events/${eventId}/dashboard` : PATHS.ADMIN_MY_EVENTS}>← Quay lại Dashboard</Link>
            <span className="sep">/</span>
            <span>Mã Ưu Đãi (Vouchers)</span>
          </div>
          <div className="header-actions-row">
            <div>
              <h1>Quản Lý Voucher & Đo Lường ROI Sự Kiện</h1>
              <p>Tạo mã khuyến mãi, kiểm soát lượt dùng và theo dõi hiệu suất doanh thu bán vé.</p>
            </div>
            <button className="btn-add-voucher" onClick={() => setShowCreateModal(true)}>
              + Tạo mã voucher mới
            </button>
          </div>
        </div>
      </div>

      <div className="vouchers-container">
        {error && <div className="vouchers-alert error">{error}</div>}

        {/* ROI SUMMARY CARDS */}
        {roiSummary && (
          <div className="roi-metrics-grid">
            <div className="roi-card">
              <span className="roi-label">Tổng mã đã tạo</span>
              <span className="roi-value">{roiSummary.totalVouchers || 0}</span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Tổng lượt sử dụng</span>
              <span className="roi-value highlight">{roiSummary.totalUsed || 0}</span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Chi phí giảm giá (Khuyến mãi)</span>
              <span className="roi-value text-red">
                {(roiSummary.totalDiscountGiven || 0).toLocaleString("vi-VN")} đ
              </span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Doanh thu vé mang lại</span>
              <span className="roi-value text-green">
                {(roiSummary.totalRevenueGenerated || 0).toLocaleString("vi-VN")} đ
              </span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Chỉ số ROI tổng thể</span>
              <span className="roi-value text-blue">
                {roiSummary.overallRoiPct ? `${roiSummary.overallRoiPct}%` : "—"}
              </span>
            </div>
          </div>
        )}

        {/* VOUCHER LIST */}
        <div className="vouchers-card">
          <div className="card-header">
            <h2>Danh sách Voucher sự kiện ({vouchers.length})</h2>
          </div>

          {vouchers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🎟️</span>
              <p>Chưa có mã giảm giá nào cho sự kiện này.</p>
              <button className="btn-create-first" onClick={() => setShowCreateModal(true)}>
                Tạo mã ưu đãi đầu tiên
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="vouchers-table">
                <thead>
                  <tr>
                    <th>Mã Voucher</th>
                    <th>Mức giảm</th>
                    <th>Đơn tối thiểu</th>
                    <th>Đã dùng / Giới hạn</th>
                    <th>Thời hạn hiệu lực</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id || v._id}>
                      <td className="code-cell font-mono">{v.code}</td>
                      <td>
                        {v.discountType === "PERCENT" ? (
                          <span className="discount-tag">
                            Giảm {v.discountValue}%
                            {v.maxDiscountAmount && ` (Tối đa ${v.maxDiscountAmount.toLocaleString("vi-VN")} đ)`}
                          </span>
                        ) : (
                          <span className="discount-tag fixed">
                            Giảm {v.discountValue?.toLocaleString("vi-VN")} đ
                          </span>
                        )}
                      </td>
                      <td>{(v.minOrderAmount || 0).toLocaleString("vi-VN")} đ</td>
                      <td>
                        <strong>{v.usedCount || 0}</strong> / {v.maxUses || "∞"}
                      </td>
                      <td className="dates-cell">
                        {v.validFrom ? new Date(v.validFrom).toLocaleDateString("vi-VN") : "—"}
                        {" → "}
                        {v.validTo ? new Date(v.validTo).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td>
                        <span className={`status-pill ${v.isActive ? "active" : "inactive"}`}>
                          {v.isActive ? "ĐANG HOẠT ĐỘNG" : "TẠM TẮT"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn-toggle ${v.isActive ? "disable" : "enable"}`}
                          onClick={() => toggleVoucherStatus(v)}
                        >
                          {v.isActive ? "Tạm dừng" : "Kích hoạt"}
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

      {/* CREATE VOUCHER MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card modal-voucher" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tạo Mã Khuyến Mãi Mới</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="voucher-form">
              {formError && <div className="form-alert error">{formError}</div>}

              <div className="form-group">
                <label>Mã Voucher (In hoa không dấu) *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: SUMMER20, VIP100K..."
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Loại giảm giá</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="PERCENT">Phần trăm (%)</option>
                    <option value="FIXED">Số tiền cố định (VNĐ)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Mức giảm *</label>
                  <input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              {discountType === "PERCENT" && (
                <div className="form-group">
                  <label>Mức giảm tối đa (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ví dụ: 50000"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group-row">
                <div className="form-group">
                  <label>Giá trị đơn hàng tối thiểu (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Tổng lượt sử dụng tối đa</label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Lượt dùng tối đa / Mỗi tài khoản *</label>
                <input
                  type="number"
                  min="1"
                  value={maxUsesPerUser}
                  onChange={(e) => setMaxUsesPerUser(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Hiệu lực từ ngày *</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Đến ngày *</label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? "Đang tạo..." : "Xác nhận tạo Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerVouchersPage;