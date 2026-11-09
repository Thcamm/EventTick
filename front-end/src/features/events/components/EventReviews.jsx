import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./EventReviews.css";

const EventReviews = ({ eventId, eventTitle }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/events/${eventId}/reviews`);
      if (res.data?.success) {
        setReviews(res.data.reviews || []);
        setTotalReviews(res.data.totalReviews || 0);
        setAvgRating(res.data.averageRating || 0);
      }
    } catch (err) {
      console.warn("Could not load reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchReviews();
    }
  }, [eventId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!user) {
      setErrorMsg("Vui lòng đăng nhập để gửi đánh giá.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await axiosInstance.post(
        `/events/${eventId}/reviews`,
        {
          rating: Number(userRating),
          comment: userComment.trim(),
        },
        { withCredentials: true }
      );

      if (res.data?.success) {
        setSuccessMsg(res.data.message || "Đánh giá thành công!");
        setUserComment("");
        fetchReviews();
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Gửi đánh giá thất bại. Vui lòng đảm bảo bạn đã sở hữu vé sự kiện này.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`star-icon ${i <= Math.round(rating) ? "filled" : "empty"}`}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div className="event-details-intro-container ed-light-card event-reviews-wrapper">
      <div className="ed-section-title-row reviews-header-row">
        <div>
          <h3>Đánh giá từ khán giả</h3>
          <p className="reviews-subheading">
            Chỉ những khán giả đã sở hữu vé mới có thể gửi đánh giá cho sự kiện.
          </p>
        </div>
        <div className="resale-market-banner-link">
          <Link
            to={`/resale?search=${encodeURIComponent(eventTitle || "")}`}
            className="resale-pill-link"
          >
            🔄 Chợ vé bán lại (Resale) cho sự kiện này →
          </Link>
        </div>
      </div>

      {/* RATING SUMMARY STATS */}
      <div className="reviews-score-summary">
        <div className="score-big-box">
          <span className="big-number">{avgRating > 0 ? avgRating : "—"}</span>
          <div className="stars-cluster">{renderStars(avgRating)}</div>
          <span className="total-count-text">{totalReviews} lượt đánh giá</span>
        </div>
        <div className="score-info-box">
          <h4>Trải nghiệm sự kiện</h4>
          <p>
            Tất cả phản hồi được gửi bởi khán giả đã xác thực mua vé và tham gia
            sự kiện trên EventTick.
          </p>
        </div>
      </div>

      {/* FORM GỬI ĐÁNH GIÁ NẾU ĐÃ ĐĂNG NHẬP */}
      <div className="submit-review-box">
        <h4>Gửi đánh giá của bạn</h4>
        {user ? (
          <form onSubmit={handleSubmitReview}>
            <div className="rating-select-row">
              <label>Đánh giá số sao:</label>
              <div className="star-rating-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={`star-select-btn ${star <= userRating ? "active" : ""}`}
                    onClick={() => setUserRating(star)}
                    aria-label={`${star} sao`}
                  >
                    ★
                  </button>
                ))}
                <span className="rating-num-label">{userRating} / 5 sao</span>
              </div>
            </div>

            <div className="comment-input-row">
              <textarea
                placeholder="Chia sẻ cảm nhận của bạn về sự kiện, âm thanh, không gian, nghệ sĩ..."
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>

            {errorMsg && <div className="review-alert error">{errorMsg}</div>}
            {successMsg && <div className="review-alert success">{successMsg}</div>}

            <div className="submit-action-row">
              <button
                type="submit"
                className="submit-review-btn"
                disabled={submitting}
              >
                {submitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </form>
        ) : (
          <div className="login-to-review-hint">
            <span>Bạn cần </span>
            <Link to={PATHS.LOGIN} className="login-link-inline">
              đăng nhập
            </Link>
            <span> để gửi đánh giá sau khi tham gia sự kiện.</span>
          </div>
        )}
      </div>

      {/* DANH SÁCH REVIEW */}
      <div className="reviews-list-container">
        {loading ? (
          <p className="reviews-loading">Đang tải đánh giá...</p>
        ) : reviews.length === 0 ? (
          <p className="reviews-empty">
            Chưa có đánh giá nào cho sự kiện này. Hãy là người đầu tiên để lại cảm
            nhận!
          </p>
        ) : (
          reviews.map((rev) => (
            <div className="review-item-card" key={rev._id}>
              <div className="review-author-meta">
                {rev.user?.avatarUrl ? (
                  <img
                    src={rev.user.avatarUrl}
                    alt={rev.user.name}
                    className="review-user-avatar"
                  />
                ) : (
                  <div className="review-user-avatar-fallback">
                    {(rev.user?.name || "K").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="review-user-name">
                    {rev.user?.name || "Khán giả"}
                    <span className="verified-badge">✓ Đã sở hữu vé</span>
                  </div>
                  <div className="review-stars-date">
                    <span className="review-stars-small">
                      {renderStars(rev.rating)}
                    </span>
                    <span className="review-date-text">
                      {rev.createdAt
                        ? new Date(rev.createdAt).toLocaleDateString("vi-VN")
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {rev.comment && <p className="review-body-text">{rev.comment}</p>}

              {rev.organizerReply && (
                <div className="organizer-reply-box">
                  <span className="reply-label">Phản hồi từ Ban tổ chức:</span>
                  <p className="reply-content">{rev.organizerReply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventReviews;
