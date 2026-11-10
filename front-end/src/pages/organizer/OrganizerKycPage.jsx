import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import "./OrganizerKycPage.css";

const OrganizerKycPage = () => {
  const { checkAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [organizationName, setOrganizationName] = useState("");
  const [businessType, setBusinessType] = useState("INDIVIDUAL");
  const [taxCode, setTaxCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchKyc = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get("/organizer/kyc");
      if (res.data?.profile) {
        const p = res.data.profile;
        setProfile(p);
        setOrganizationName(p.organizationName || "");
        setBusinessType(p.businessType || "INDIVIDUAL");
        setTaxCode(p.taxCode || "");
        setBankName(p.bankName || "");
        setBankAccountNo(p.bankAccountNo || "");
        setBankAccountHolder(p.bankAccountHolder || "");
        if (p.kycStatus === "VERIFIED") {
          checkAuth?.();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải thông tin hồ sơ KYC");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKyc();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!organizationName.trim()) {
      setError("Vui lòng nhập tên đơn vị / tổ chức");
      return;
    }
    if (!/^\d{10}(-?\d{3})?$/.test(taxCode.trim())) {
      setError("Mã số thuế phải gồm 10 hoặc 13 chữ số");
      return;
    }
    if (!/^\d{6,20}$/.test(bankAccountNo.trim())) {
      setError("Số tài khoản chỉ gồm 6–20 chữ số");
      return;
    }
    if (!profile?.hasDocument && !selectedFile) {
      setError("Vui lòng tải lên tài liệu định danh (CCCD / Giấy phép ĐKKD)");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("organizationName", organizationName.trim());
      formData.append("businessType", businessType);
      formData.append("taxCode", taxCode.trim());
      formData.append("bankName", bankName.trim());
      formData.append("bankAccountNo", bankAccountNo.trim());
      formData.append("bankAccountHolder", bankAccountHolder.trim().toUpperCase());
      if (selectedFile) {
        formData.append("document", selectedFile);
      }

      const res = await apiClient.post("/organizer/kyc", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccessMsg(res.data?.message || "Đã gửi hồ sơ KYC thành công!");
      if (res.data?.profile) {
        setProfile(res.data.profile);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Gửi hồ sơ KYC thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="kyc-loading-wrap">
        <LoadingSpinner text="Đang tải thông tin xác minh KYC..." />
      </div>
    );
  }

  const isVerified = profile?.kycStatus === "VERIFIED";
  const isPending = profile?.kycStatus === "PENDING";
  const isRejected = profile?.kycStatus === "REJECTED";

  return (
    <div className="organizer-kyc-page">
      <div className="kyc-header">
        <div className="kyc-header-container">
          <h1>Xác Minh Danh Tính Nhà Tổ Chức (KYC)</h1>
          <p>
            Tuân thủ pháp lý và xác minh danh tính điện tử theo chuẩn EventTick để tạo sự kiện và bán vé online.
          </p>
        </div>
      </div>

      <div className="kyc-container">
        {/* STATUS BANNER */}
        {isVerified && (
          <div className="kyc-alert success">
            <div className="alert-icon">✅</div>
            <div className="alert-text">
              <h3>Hồ sơ đã được phê duyệt</h3>
              <p>
                Tài khoản của bạn đã được xác minh thành công vào lúc{" "}
                {profile.verifiedAt ? new Date(profile.verifiedAt).toLocaleDateString("vi-VN") : "gần đây"}.
                Bạn có đầy đủ quyền hạn để đăng tải sự kiện, ký hợp đồng hoa hồng và bán vé online.
              </p>
              <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link
                  to={PATHS.ADMIN_CREATE_EVENT}
                  style={{
                    backgroundColor: "#22c55e",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                    display: "inline-block",
                  }}
                >
                  ➕ Tạo sự kiện ngay
                </Link>
                <Link
                  to={PATHS.ORGANIZER_CONTRACTS}
                  style={{
                    backgroundColor: "#3b82f6",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                    display: "inline-block",
                  }}
                >
                  📝 Ký hợp đồng hoa hồng
                </Link>
                <Link
                  to={PATHS.ADMIN_MY_EVENTS}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "14px",
                    display: "inline-block",
                  }}
                >
                  📋 Quản lý sự kiện
                </Link>
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="kyc-alert warning">
            <div className="alert-icon">⏳</div>
            <div className="alert-text">
              <h3>Hồ sơ đang chờ Admin phê duyệt</h3>
              <p>
                Đơn vị kiểm duyệt của EventTick đang tiến hành đối soát thông tin của bạn.
                Quá trình thường hoàn tất trong vòng 24 giờ làm việc. Bạn vẫn có thể cập nhật lại thông tin nếu cần.
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="kyc-alert danger">
            <div className="alert-icon">❌</div>
            <div className="alert-text">
              <h3>Hồ sơ bị từ chối phê duyệt</h3>
              <p>
                <strong>Lý do từ chối:</strong> {profile.rejectionReason || "Thông tin hoặc tài liệu chưa hợp lệ"}.
              </p>
              <p>Vui lòng bổ sung hoặc điều chỉnh thông tin chính xác bên dưới và gửi lại hồ sơ.</p>
            </div>
          </div>
        )}

        {error && <div className="kyc-alert-inline error">{error}</div>}
        {successMsg && <div className="kyc-alert-inline success">{successMsg}</div>}

        <div className="kyc-card">
          <div className="kyc-card-header">
            <h2>Thông tin định danh pháp lý</h2>
            <span className="badge-status">
              {profile?.kycStatus || "CHƯA_GỬI"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="kyc-form">
            <div className="form-group-row">
              <div className="form-group">
                <label>Loại hình tổ chức *</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  disabled={isVerified}
                >
                  <option value="INDIVIDUAL">Cá nhân / Nghệ sĩ / Ban nhạc</option>
                  <option value="ENTERPRISE">Doanh nghiệp / Công ty / Tổ chức</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tên đơn vị / Thương hiệu tổ chức *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Công ty TNHH Giải trí Sao Mai"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={isVerified}
                  required
                />
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>Mã số thuế (10 hoặc 13 chữ số) *</label>
                <input
                  type="text"
                  placeholder="0101234567 hoặc 0101234567-001"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  disabled={isVerified}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tên ngân hàng nhận giải ngân *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Vietcombank, Techcombank, BIDV..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={isVerified}
                  required
                />
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>Số tài khoản ngân hàng *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0011002345678"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  disabled={isVerified}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tên chủ tài khoản (In hoa không dấu) *</label>
                <input
                  type="text"
                  placeholder="NGUYEN VAN A"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  disabled={isVerified}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Tài liệu định danh & Pháp lý (PDF, PNG, JPG tối đa 10MB) *
              </label>
              <div className="file-upload-box">
                <input
                  type="file"
                  id="kyc-file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  disabled={isVerified}
                />
                <label htmlFor="kyc-file" className="file-upload-label">
                  <span className="upload-icon">📁</span>
                  <span>
                    {selectedFile
                      ? selectedFile.name
                      : profile?.hasDocument
                      ? "Đã có tài liệu lưu trên hệ thống (Chọn tệp mới để thay thế)"
                      : "Nhấp để tải lên CCCD (2 mặt) hoặc Giấy phép ĐKKD"}
                  </span>
                </label>
              </div>
              <small className="hint-text">
                Hệ thống bảo vệ tài liệu định danh với cơ chế mã hóa lưu trữ riêng tư, chỉ nhân viên kiểm duyệt được phân quyền mới có thể xem.
              </small>
            </div>

            {!isVerified && (
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-submit-kyc"
                  disabled={submitting}
                >
                  {submitting ? "Đang gửi hồ sơ..." : profile ? "Cập nhật hồ sơ KYC" : "Gửi hồ sơ KYC phê duyệt"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default OrganizerKycPage;