import React, { useEffect, useState } from "react";
import "./MyEventPage.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";

const EVENT_STATUS_MAP = {
  DRAFT: {
    label: "Bản nháp",
    color: "#94a3b8",
  },
  PENDING: {
    label: "Chờ Admin duyệt",
    color: "#fbbf24",
  },
  APPROVED: {
    label: "Chờ ký hợp đồng",
    color: "#38bdf8",
  },
  PUBLISHED: {
    label: "Đang mở bán",
    color: "#4ade80",
  },
  CANCELLED: {
    label: "Đã huỷ",
    color: "#ef4444",
  },
  ENDED: {
    label: "Đã kết thúc",
    color: "#9ca3af",
  },
  REJECTED: {
    label: "Bị từ chối",
    color: "#f87171",
  },
};

const MyEventPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axiosInstance.get("/events/my-event", {
          withCredentials: true, // include cookies/session if needed
        });

        // assuming backend returns { success: true, events: [...] }
        if (response.data && response.data.success) {
          setEvents(response.data.events || []);
        } else {
          setEvents([]);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="my-event-container">
      <div className="my-event-sidebar">
        <h2>Tài khoản của {user?.name || user?.userName || user?.username || "tôi"}</h2>
        <ul>
          <li>
            <Link
              to={PATHS.USER_ACCOUNT}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Thông tin tài khoản
            </Link>
          </li>
          <li>
            <Link
              to={PATHS.USER_TICKETS}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Vé của tôi
            </Link>
          </li>
          <li>
            <strong>Sự kiện của tôi</strong>
          </li>
          <li>
            <Link
              to={PATHS.ORGANIZER_KYC}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Hồ sơ xác minh KYC
            </Link>
          </li>
          <li>
            <Link
              to={PATHS.ORGANIZER_CONTRACTS}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Hợp đồng điện tử
            </Link>
          </li>
        </ul>
      </div>
      <div className="my-event-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ margin: 0 }}>Sự kiện của tôi</h1>
          <Link to={PATHS.ADMIN_CREATE_EVENT} className="my-event-btn" style={{ padding: "8px 16px", textDecoration: "none" }}>
            ➕ Đăng ký sự kiện mới
          </Link>
        </div>
        {loading ? (
          <p>Đang tải sự kiện...</p>
        ) : events.length > 0 ? (
          <div className="my-event-list">
            <table className="my-event-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Tên</th>
                  <th>Địa điểm</th>
                  <th>Trạng thái duyệt</th>
                  <th>Công cụ vận hành</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => {
                  const status = (event.status || "DRAFT").toUpperCase();
                  const statusConfig = EVENT_STATUS_MAP[status] || {
                    label: status,
                    color: "#94a3b8",
                  };
                  const statusLabel = statusConfig.label;
                  const statusColor = statusConfig.color;
                  const isRejected = status === "REJECTED";
                  const isApproved = status === "APPROVED";
                  const imageSrc = event.thumbnailUrl || event.bannerUrl || event.eventImage;

                  return (
                    <tr key={index}>
                      <td>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={event.title || event.eventName}
                            className="my-event-image"
                          />
                        ) : (
                          "No image"
                        )}
                      </td>
                      <td>
                        <Link to={`/event/${event._id}`} className="my-event-link">
                          {event.title || event.eventName}
                        </Link>
                      </td>
                      <td>{event.location || event.eventAddress || event.venueName}</td>
                      <td>
                        <span style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: `${statusColor}22`,
                          color: statusColor,
                          border: `1px solid ${statusColor}55`,
                        }}>
                          {statusLabel}
                        </span>
                        {isApproved && (
                          <div style={{ marginTop: "6px" }}>
                            <Link
                              to={PATHS.ORGANIZER_CONTRACTS}
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                backgroundColor: "#10b981",
                                color: "#fff",
                                borderRadius: "4px",
                                fontSize: "11px",
                                textDecoration: "none",
                                fontWeight: 600,
                              }}
                            >
                              ✍️ Ký hợp đồng ngay
                            </Link>
                          </div>
                        )}
                        {isRejected && event.rejectionReason && (
                          <div style={{ fontSize: "11px", color: "#f87171", marginTop: "4px" }}>
                            Lý do: {event.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <Link
                            to={`/organizer/events/${event._id}/dashboard`}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#3b82f6",
                              color: "#fff",
                              borderRadius: "4px",
                              fontSize: "12px",
                              textDecoration: "none",
                              fontWeight: 500,
                            }}
                          >
                            📊 Dashboard
                          </Link>
                          <Link
                            to={`/organizer/events/${event._id}/vouchers`}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#8b5cf6",
                              color: "#fff",
                              borderRadius: "4px",
                              fontSize: "12px",
                              textDecoration: "none",
                              fontWeight: 500,
                            }}
                          >
                            🎟 Vouchers
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="my-event-content">
            <img
              src="https://via.placeholder.com/300x200.png?text=Sunset+Illustration"
              alt="Sunset Illustration"
            />
            <p>Bạn chưa có sự kiện nào</p>
            <Link to={PATHS.ADMIN_CREATE_EVENT} className="my-event-btn">
              Tạo sự kiện
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEventPage;
