import React, { useState, useEffect, useRef } from "react";
import apiClient from "@/services/apiClient";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import "./OrganizerContractsPage.css";

const OrganizerContractsPage = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Signing modal
  const [signingContract, setSigningContract] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);
  const [signError, setSignError] = useState(null);

  // Canvas ref for signature
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get("/organizer/contracts");
      setContracts(res.data?.contracts || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // Canvas drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const openSignModal = (contract) => {
    setSigningContract(contract);
    setAgreed(false);
    setHasDrawn(false);
    setSignError(null);
    setTimeout(() => {
      clearCanvas();
    }, 100);
  };

  const handleSignSubmit = async () => {
    if (!agreed) {
      setSignError("Bạn cần tích đồng ý với các điều khoản hợp đồng trước khi ký.");
      return;
    }
    if (!hasDrawn) {
      setSignError("Vui lòng ký tên của bạn vào khung chữ ký điện tử.");
      return;
    }

    const canvas = canvasRef.current;
    const signatureBase64 = canvas ? canvas.toDataURL("image/png") : "";

    try {
      setSubmittingSign(true);
      setSignError(null);
      await apiClient.post(`/organizer/contracts/${signingContract.id}/sign`, {
        signature: signatureBase64,
        agree: true,
      });

      alert("Ký điện tử hợp đồng thành công! Sự kiện của bạn đã sẵn sàng mở bán vé online.");
      setSigningContract(null);
      fetchContracts();
    } catch (err) {
      setSignError(err.response?.data?.message || "Ký hợp đồng thất bại");
    } finally {
      setSubmittingSign(false);
    }
  };

  if (loading) {
    return (
      <div className="contracts-loading-wrap">
        <LoadingSpinner text="Đang tải danh sách hợp đồng điện tử..." />
      </div>
    );
  }

  return (
    <div className="organizer-contracts-page">
      <div className="contracts-header">
        <div className="contracts-header-container">
          <h1>Quản Lý Hợp Đồng Điện Tử (E-Contract)</h1>
          <p>
            Hợp đồng phân phối vé trực tuyến, thỏa thuận tỷ lệ hoa hồng và ký kết số điện tử theo tiêu chuẩn pháp lý.
          </p>
        </div>
      </div>

      <div className="contracts-container">
        {error && <div className="contracts-alert error">{error}</div>}

        <div className="contracts-table-card">
          <div className="card-header">
            <h2>Danh sách hợp đồng ({contracts.length})</h2>
          </div>

          {contracts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📝</span>
              <p>Chưa có hợp đồng nào được tạo.</p>
              <small>Hợp đồng điện tử sẽ tự động được ban hành khi sự kiện của bạn được Admin duyệt.</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="contracts-table">
                <thead>
                  <tr>
                    <th>Số HĐ</th>
                    <th>Sự kiện</th>
                    <th>Tỷ lệ hoa hồng</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Ngày ký</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono">{c.contractNumber || "HĐ-EVENT"}</td>
                      <td className="event-title-cell">{c.eventTitle || "Sự kiện"}</td>
                      <td className="commission-cell">
                        <span className="tag-commission">
                          {c.commissionRatePct ?? 10}%
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${c.status?.toLowerCase()}`}>
                          {c.status === "SIGNED"
                            ? "ĐÃ KÝ"
                            : c.status === "WAITING_SIGN"
                            ? "CHỜ KÝ"
                            : c.status}
                        </span>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString("vi-VN")}</td>
                      <td>
                        {c.signedAt
                          ? new Date(c.signedAt).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                      <td>
                        {c.status === "WAITING_SIGN" ? (
                          <button
                            className="btn-sign"
                            onClick={() => openSignModal(c)}
                          >
                            ✍️ Xem & Ký số
                          </button>
                        ) : (
                          <button
                            className="btn-view"
                            onClick={() => openSignModal(c)}
                          >
                            👁️ Xem chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SIGNING & VIEW MODAL */}
      {signingContract && (
        <div className="modal-overlay" onClick={() => setSigningContract(null)}>
          <div className="modal-card modal-contract" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi Tiết Hợp Đồng Phân Phối Vé</h2>
              <button className="btn-close" onClick={() => setSigningContract(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="contract-preview-box">
                <div className="contract-title">
                  <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
                  <p>Độc lập - Tự do - Hạnh phúc</p>
                  <hr />
                  <h4>HỢP ĐỒNG DỊCH VỤ PHÂN PHỐI VÉ TRỰC TUYẾN</h4>
                  <p className="contract-no">Số: {signingContract.contractNumber}</p>
                </div>

                <div className="contract-content">
                  <p><strong>Bên A (Nền tảng):</strong> HỆ THỐNG PHÂN PHỐI VÉ TRỰC TUYẾN EVENTTICK</p>
                  <p><strong>Bên B (Nhà tổ chức):</strong> {signingContract.organizerName || "Đơn vị tổ chức"}</p>
                  <p><strong>Sự kiện phân phối:</strong> {signingContract.eventTitle}</p>
                  <p>
                    <strong>Tỷ lệ chiết khấu sàn:</strong> {signingContract.commissionRatePct}% trên tổng doanh thu vé bán trực tuyến thành công.
                  </p>
                  <p><strong>Hình thức vé và soát vé:</strong></p>
                  <ul>
                    <li>Hệ thống 100% bán và phát hành vé điện tử (E-Ticket) với mã QR mã hóa HMAC-SHA256 chống làm giả.</li>
                    <li>Khách hàng tham dự quét vé trực tiếp qua ứng dụng/cổng soát vé nhân viên trực tuyến, không sử dụng vé giấy.</li>
                    <li>Doanh thu sự kiện được kết toán và đối soát tự động sau khi sự kiện kết thúc.</li>
                  </ul>
                </div>
              </div>

              {signingContract.status === "SIGNED" ? (
                <div className="signed-evidence-box">
                  <h4>Thông tin chứng thực chữ ký điện tử</h4>
                  <p>Hợp đồng đã được ký số và có hiệu lực pháp lý.</p>
                  <p>Thời gian ký: {new Date(signingContract.signedAt).toLocaleString("vi-VN")}</p>
                  {signingContract.signatureDataUrl && (
                    <div className="signature-preview">
                      <img src={signingContract.signatureDataUrl} alt="Chữ ký điện tử" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="sign-action-box">
                  <div className="agree-check">
                    <label>
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                      />
                      <span>
                        Tôi đã đọc, hiểu rõ và đồng ý với tất cả điều khoản trong Hợp đồng phân phối vé và chính sách sàn EventTick.
                      </span>
                    </label>
                  </div>

                  <div className="canvas-container">
                    <div className="canvas-header">
                      <span>Vẽ chữ ký điện tử của bạn vào khung bên dưới:</span>
                      <button type="button" className="btn-clear" onClick={clearCanvas}>
                        Xoá chữ ký
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={140}
                      className="signature-canvas"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>

                  {signError && <div className="modal-error">{signError}</div>}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setSigningContract(null)}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      className="btn-confirm-sign"
                      onClick={handleSignSubmit}
                      disabled={submittingSign}
                    >
                      {submittingSign ? "Đang ký số..." : "Ký số & Kích hoạt sự kiện"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerContractsPage;