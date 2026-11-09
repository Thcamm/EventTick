import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./ResaleMarketPage.css";

const ResaleMarketPage = () => {
  const [searchParams] = useSearchParams();
  const eventIdFilter = searchParams.get("eventId");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [buying, setBuying] = useState(false);
  const [buySuccess, setBuySuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchListings = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let url = "/resale/listings";
      if (eventIdFilter) {
        url = `/resale/events/${eventIdFilter}/listings`;
      }
      const res = await axiosInstance.get(url, { withCredentials: true });
      if (res.data?.success) {
        setListings(res.data.listings || []);
      }
    } catch (err) {
      console.error("Lỗi khi tải chợ vé bán lại:", err);
      setErrorMsg("Không thể tải danh sách vé bán lại lúc này.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [eventIdFilter]);

  const filteredListings = listings.filter((l) => {
    const title = l.event?.title || l.eventName || "";
    const tier = l.tierName || "";
    const seat = l.seat || "";
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      title.toLowerCase().includes(q) ||
      tier.toLowerCase().includes(q) ||
      seat.toLowerCase().includes(q)
    );
  });

  const handleBuy = async () => {
    if (!user) {
      navigate(`${PATHS.LOGIN}?returnTo=/resale`);
      return;
    }
    if (!selectedListing) return;

    setBuying(true);
    setErrorMsg("");
    try {
      const res = await axiosInstance.post(
        `/resale/listings/${selectedListing.id}/buy`,
        {},
        { withCredentials: true }
      );
      if (res.data?.success) {
        setBuySuccess(res.data);
        setSelectedListing(null);
        fetchListings();
      } else {
        setErrorMsg(res.data?.message || "Mua vé thất bại.");
      }
    } catch (err) {
      console.error("Lỗi mua vé:", err);
      setErrorMsg(
        err.response?.data?.message || "Mua vé thất bại. Vui lòng thử lại sau."
      );
    } finally {
      setBuying(false);
    }
  };

  const formatVnd = (amount) =>
    Number(amount || 0).toLocaleString("vi-VN") + " đ";

  return (
    <div className="resale-page">
      <div className="resale-header">
        <div className="resale-header-content">
          <h1>Chợ Vé Bán Lại Chính Chủ (100% Online)</h1>
          <p>
            Mua lại vé từ khán giả khác một cách an toàn. Giá trần tối đa{" "}
            <strong>110%</strong> giá gốc để chống phe vé. Vé cũ bị huỷ ngay lập
            tức và vé trực tuyến mới (với mã QR HMAC) được cấp riêng cho bạn.
          </p>

          <div className="resale-search-bar">
            <input
              type="text"
              placeholder="Tìm theo tên sự kiện, hạng vé, vị trí ghế..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {eventIdFilter && (
              <button
                className="resale-clear-filter-btn"
                onClick={() => navigate(PATHS.RESALE_MARKET)}
              >
                ✕ Xem tất cả sự kiện
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="resale-container">
        {errorMsg && (
          <div className="resale-alert error">
            ⚠️ {errorMsg}
            <button onClick={() => setErrorMsg("")}>✕</button>
          </div>
        )}

        {buySuccess && (
          <div className="resale-alert success">
            <div className="alert-body">
              <strong>🎉 Chúc mừng bạn đã mua vé thành công!</strong>
              <p>{buySuccess.message}</p>
              <p>Mã vé mới đã được tạo với mã QR chữ ký số bảo mật.</p>
            </div>
            <div className="alert-actions">
              <Link to={PATHS.USER_TICKETS} className="alert-btn primary">
                Xem vé của tôi
              </Link>
              <button
                className="alert-btn secondary"
                onClick={() => setBuySuccess(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="resale-loading">
            <div className="spinner"></div>
            <p>Đang tìm kiếm vé bán lại hợp lệ...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="resale-empty">
            <div className="empty-icon">🎟️</div>
            <h3>Hiện chưa có vé bán lại nào</h3>
            <p>
              Tất cả các vé đang được lưu giữ an toàn. Bạn có thể ghé thăm trang sự
              kiện chính hoặc quay lại sau.
            </p>
            <Link to={PATHS.HOME} className="empty-home-btn">
              Khám phá sự kiện
            </Link>
          </div>
        ) : (
          <div className="resale-grid">
            {filteredListings.map((item) => {
              const ev = item.event || {};
              const isOverPrice = item.resalePrice > item.originalPrice;
              const priceDiffPct =
                item.originalPrice > 0
                  ? Math.round(
                      ((item.resalePrice - item.originalPrice) /
                        item.originalPrice) *
                        100
                    )
                  : 0;

              return (
                <div key={item.id} className="resale-card">
                  <div className="resale-card-img-wrap">
                    <img
                      src={
                        ev.bannerUrl ||
                        "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80"
                      }
                      alt={ev.title || item.eventName}
                    />
                    <div className="resale-verified-tag">
                      🛡️ Vé Online Xác Thực
                    </div>
                  </div>

                  <div className="resale-card-content">
                    <h3 className="resale-card-title">
                      {ev.title || item.eventName}
                    </h3>
                    <p className="resale-card-venue">
                      📍 {ev.venueName || "Địa điểm sự kiện"}{" "}
                      {ev.city ? `• ${ev.city}` : ""}
                    </p>

                    <div className="resale-ticket-specs">
                      <div className="spec-item">
                        <span className="spec-label">Hạng vé:</span>
                        <strong className="spec-val">{item.tierName}</strong>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Chỗ ngồi:</span>
                        <strong className="spec-val">{item.seat}</strong>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Người bán:</span>
                        <span className="spec-val seller">
                          {item.seller?.name || "Khán giả chính chủ"}
                        </span>
                      </div>
                    </div>

                    <div className="resale-pricing-box">
                      <div className="price-row">
                        <span className="price-label">Giá gốc:</span>
                        <span className="price-orig">
                          {formatVnd(item.originalPrice)}
                        </span>
                      </div>
                      <div className="price-row main">
                        <span className="price-label">Giá bán lại:</span>
                        <span className="price-resale">
                          {formatVnd(item.resalePrice)}
                        </span>
                      </div>
                      {priceDiffPct !== 0 && (
                        <div
                          className={`price-badge ${
                            isOverPrice ? "markup" : "discount"
                          }`}
                        >
                          {isOverPrice
                            ? `+${priceDiffPct}% (Trần cho phép ≤10%)`
                            : `${priceDiffPct}% so với giá gốc`}
                        </div>
                      )}
                    </div>

                    <button
                      className="resale-buy-btn"
                      onClick={() => {
                        setErrorMsg("");
                        setSelectedListing(item);
                      }}
                    >
                      Mua vé này
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIRM PURCHASE MODAL */}
      {selectedListing && (
        <div className="resale-modal-overlay">
          <div className="resale-modal-card">
            <h3>Xác nhận mua vé bán lại</h3>
            <div className="modal-event-summary">
              <h4>
                {selectedListing.event?.title || selectedListing.eventName}
              </h4>
              <p>
                <strong>Hạng vé:</strong> {selectedListing.tierName}
              </p>
              <p>
                <strong>Vị trí:</strong> {selectedListing.seat}
              </p>
              <p>
                <strong>Giá thanh toán:</strong>{" "}
                <span className="highlight-price">
                  {formatVnd(selectedListing.resalePrice)}
                </span>
              </p>
            </div>

            <div className="modal-security-notice">
              <div className="sec-icon">🔒</div>
              <div className="sec-text">
                <strong>Chính sách Vé 100% Online Chính Chủ:</strong>
                <ul>
                  <li>Vé của chủ cũ sẽ tự động bị huỷ bỏ (RESOLD_INVALID).</li>
                  <li>
                    Bạn sẽ nhận được vé mới toanh với mã QR chứa chữ ký số
                    HMAC-SHA256 chống làm giả.
                  </li>
                  <li>
                    Chỉ cần xuất trình mã QR trên điện thoại tại cổng soát vé.
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setSelectedListing(null)}
                disabled={buying}
              >
                Hủy bỏ
              </button>
              <button
                className="confirm-btn"
                onClick={handleBuy}
                disabled={buying}
              >
                {buying ? "Đang xử lý cấp vé..." : "Xác nhận mua vé"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResaleMarketPage;