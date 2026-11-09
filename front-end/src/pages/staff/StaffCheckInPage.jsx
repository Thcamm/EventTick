import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { axiosInstance } from "@/services/apiClient";
import "./StaffCheckInPage.css";

const playBeep = (type = "success") => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // AudioContext might be blocked until user gesture
  }
};

const StaffCheckInPage = () => {
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { success: boolean, message: string, ticket?: any }
  const [recentLogs, setRecentLogs] = useState([]);
  const html5QrCodeRef = useRef(null);

  const startScanner = async () => {
    setCameraError("");
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError("Không tìm thấy camera trên thiết bị này.");
        return;
      }

      const scanner = new Html5Qrcode("staff-reader");
      html5QrCodeRef.current = scanner;

      // Prefer back camera on mobile
      const cameraId =
        devices.find((d) => d.label.toLowerCase().includes("back"))?.id ||
        devices[0].id;

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleVerifyTicket(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
      setScanning(true);
    } catch (err) {
      console.error("Camera start error:", err);
      setCameraError(
        "Không thể kích hoạt camera. Vui lòng cấp quyền truy cập camera hoặc dùng chế độ nhập mã thủ công."
      );
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Stop scanner error:", e);
      }
      setScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleVerifyTicket = async (rawInput) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await axiosInstance.post(
        "/booking/check-in",
        { rawInput, ticketCode: rawInput },
        { withCredentials: true }
      );

      if (res.data?.success) {
        playBeep("success");
        const ticket = res.data.ticket;
        const resultObj = {
          success: true,
          message: res.data.message || "VÉ HỢP LỆ - MỜI VÀO CỔNG",
          ticket,
        };
        setScanResult(resultObj);
        setRecentLogs((prev) => [
          {
            id: Date.now(),
            ticketCode: ticket?.ticketCode,
            zone: ticket?.zoneName,
            status: "VALID",
            time: new Date().toLocaleTimeString("vi-VN"),
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch (err) {
      playBeep("error");
      const msg =
        err.response?.data?.message ||
        "VÉ KHÔNG HỢP LỆ HOẶC CÓ DẤU HIỆU GIAN LẬN!";
      setScanResult({
        success: false,
        message: msg,
      });
      setRecentLogs((prev) => [
        {
          id: Date.now(),
          ticketCode: manualCode || "QR Scan",
          status: "FAILED",
          error: msg,
          time: new Date().toLocaleTimeString("vi-VN"),
        },
        ...prev.slice(0, 19),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleVerifyTicket(manualCode.trim());
    setManualCode("");
  };

  return (
    <div className="staff-checkin-page">
      {/* HEADER */}
      <div className="staff-header">
        <div className="staff-header-content">
          <div>
            <h1>Quét Vé Soát Cổng (100% Vé Online)</h1>
            <p>
              Hệ thống xác thực vé điện tử bảo mật HMAC-SHA256, kiểm tra vé hợp
              lệ tức thì và ngăn chặn vé trùng/vé giả mạo.
            </p>
          </div>
          <div className="staff-header-actions">
            <Link to="/staff/traffic" className="traffic-nav-btn">
              📊 Thống kê lưu lượng cổng
            </Link>
          </div>
        </div>
      </div>

      <div className="staff-main-container">
        {/* SCANNER & INPUT SECTION */}
        <div className="staff-scanner-card">
          <div className="scanner-controls-bar">
            <h3>Camera quét mã QR</h3>
            {!scanning ? (
              <button
                type="button"
                className="cam-toggle-btn start"
                onClick={startScanner}
              >
                📷 Mở camera quét
              </button>
            ) : (
              <button
                type="button"
                className="cam-toggle-btn stop"
                onClick={stopScanner}
              >
                ⏹ Tắt camera
              </button>
            )}
          </div>

          {cameraError && <div className="cam-error-box">{cameraError}</div>}

          {/* VIEWPORT CAMERA */}
          <div className="qr-viewport-wrapper">
            <div
              id="staff-reader"
              className={`qr-reader-box ${scanning ? "active" : ""}`}
            />
            {!scanning && (
              <div className="cam-placeholder">
                <span className="cam-icon">📱</span>
                <p>Bấm "Mở camera quét" để bắt đầu quét vé của khách hàng</p>
              </div>
            )}
          </div>

          {/* MANUAL INPUT FALLBACK */}
          <form className="manual-input-form" onSubmit={handleManualSubmit}>
            <label htmlFor="manual-code-input">
              Nhập mã vé thủ công (nếu màn hình khách bị vỡ hoặc mờ):
            </label>
            <div className="manual-input-group">
              <input
                id="manual-code-input"
                type="text"
                placeholder="VD: TK-20261110-XXXXXX"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button
                type="submit"
                className="manual-submit-btn"
                disabled={loading || !manualCode.trim()}
              >
                {loading ? "Đang xác thực..." : "Xác nhận vào"}
              </button>
            </div>
          </form>
        </div>

        {/* RESULT & LOGS PANEL */}
        <div className="staff-sidebar-panel">
          {/* RESULT CARD */}
          <div className="scan-verdict-box">
            <h4>Kết quả soát vé mới nhất</h4>
            {scanResult ? (
              <div
                className={`verdict-card ${scanResult.success ? "success" : "failed"}`}
              >
                <div className="verdict-icon">
                  {scanResult.success ? "✅" : "⛔"}
                </div>
                <div className="verdict-info">
                  <div className="verdict-title">
                    {scanResult.success
                      ? "HỢP LỆ - MỜI VÀO CỔNG"
                      : "KHÔNG HỢP LỆ / TỪ CHỐI"}
                  </div>
                  <div className="verdict-msg">{scanResult.message}</div>
                  {scanResult.ticket && (
                    <div className="verdict-ticket-details">
                      <div>
                        <strong>Mã vé:</strong> {scanResult.ticket.ticketCode}
                      </div>
                      <div>
                        <strong>Hạng vé:</strong> {scanResult.ticket.zoneName}
                      </div>
                      <div>
                        <strong>Sự kiện:</strong> {scanResult.ticket.eventName}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="verdict-idle">
                <span>Chưa có lượt quét nào</span>
                <small>Hãy quét mã QR trên ứng dụng/email của khách hàng</small>
              </div>
            )}
          </div>

          {/* RECENT CHECK-INS */}
          <div className="recent-logs-box">
            <h4>Lịch sử soát vé ca làm việc ({recentLogs.length})</h4>
            <div className="logs-scroll-area">
              {recentLogs.length === 0 ? (
                <p className="no-logs-text">Chưa có dữ liệu</p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`log-row-item ${log.status.toLowerCase()}`}
                  >
                    <div className="log-badge">
                      {log.status === "VALID" ? "OK" : "ERR"}
                    </div>
                    <div className="log-code-wrap">
                      <span className="log-code">{log.ticketCode}</span>
                      {log.zone && (
                        <span className="log-zone">[{log.zone}]</span>
                      )}
                      {log.error && (
                        <span className="log-err-text">{log.error}</span>
                      )}
                    </div>
                    <div className="log-time">{log.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffCheckInPage;
