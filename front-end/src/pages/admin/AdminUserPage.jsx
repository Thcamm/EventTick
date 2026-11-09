import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminUserPage.css";

const ROLES = ["CUSTOMER", "ORGANIZER", "STAFF", "ADMIN"];

export default function AdminUserPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  // Modal confirm state
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get("/admin/users", { params });
      if (res.data?.success) {
        setUsers(res.data.users || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh sách người dùng" });
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setActionLoading(userId);
      const res = await api.put(`/admin/users/${userId}/role`, { role: newRole });
      if (res.data?.success) {
        setToast({ type: "success", message: res.data.message || `Đã đổi vai trò thành ${newRole}` });
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể đổi vai trò" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusToggle = async (user) => {
    const nextStatus = user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    try {
      setActionLoading(user.id);
      const res = await api.put(`/admin/users/${user.id}/status`, { status: nextStatus });
      if (res.data?.success) {
        setToast({
          type: "success",
          message: nextStatus === "BLOCKED" ? `Đã khoá tài khoản ${user.username}` : `Đã mở khoá tài khoản ${user.username}`,
        });
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể đổi trạng thái tài khoản" });
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  return (
    <div className="admin-users-page">
      <div className="admin-container">
        <div className="users-page-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Người dùng</span>
            </div>
            <h1>Quản lý người dùng & Phân quyền</h1>
            <p className="subtitle">
              Quản lý toàn bộ tài khoản trên hệ thống, kiểm soát trạng thái hoạt động và cấp quyền truy cập.
            </p>
          </div>
          <div className="total-badge">
            Tổng cộng: <strong>{total}</strong> tài khoản
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
          <div className="filter-group search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo username, họ tên, email, sđt..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filter-group">
            <label>Vai trò:</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả vai trò</option>
              <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
              <option value="ORGANIZER">Nhà tổ chức (ORGANIZER)</option>
              <option value="STAFF">Nhân viên soát vé (STAFF)</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="BLOCKED">Bị khoá (BLOCKED)</option>
            </select>
          </div>
        </div>

        {/* Users table */}
        <div className="users-table-card">
          {loading ? (
            <div className="users-loading">Đang tải danh sách người dùng...</div>
          ) : users.length === 0 ? (
            <div className="users-empty">Không tìm thấy người dùng nào phù hợp với bộ lọc.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Email / SĐT</th>
                    <th>Vai trò (RBAC)</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={u.status === "BLOCKED" ? "row-blocked" : ""}>
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar-placeholder">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" />
                            ) : (
                              (u.fullName || u.username || "U").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="user-name">{u.fullName || "—"}</div>
                            <div className="user-username">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <div>{u.email}</div>
                          <div className="phone-sub">{u.phone || "Chưa có SĐT"}</div>
                        </div>
                      </td>
                      <td>
                        <select
                          className={`role-select role-${u.role.toLowerCase()}`}
                          value={u.role}
                          disabled={actionLoading === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`status-pill ${u.status === "ACTIVE" ? "active" : "blocked"}`}>
                          {u.status === "ACTIVE" ? "Hoạt động" : "Bị khoá"}
                        </span>
                      </td>
                      <td className="date-cell">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={`btn-toggle-status ${u.status === "ACTIVE" ? "btn-danger" : "btn-success"}`}
                          disabled={actionLoading === u.id}
                          onClick={() => setConfirmModal(u)}
                        >
                          {u.status === "ACTIVE" ? "Khoá tài khoản" : "Mở khoá"}
                        </button>
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

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="confirm-modal-box">
            <h3>Xác nhận thay đổi trạng thái</h3>
            <p>
              Bạn có chắc chắn muốn{" "}
              <strong>{confirmModal.status === "ACTIVE" ? "KHOÁ TÀI KHOẢN" : "MỞ KHOÁ TÀI KHOẢN"}</strong> cho người
              dùng <strong>{confirmModal.username}</strong> ({confirmModal.email})?
            </p>
            {confirmModal.status === "ACTIVE" && (
              <p className="warning-text">
                Người dùng bị khoá sẽ không thể đăng nhập hoặc thực hiện bất kỳ giao dịch nào trên nền tảng.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>
                Huỷ bỏ
              </button>
              <button
                className={`btn-confirm ${confirmModal.status === "ACTIVE" ? "btn-danger" : "btn-success"}`}
                onClick={() => handleStatusToggle(confirmModal)}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
