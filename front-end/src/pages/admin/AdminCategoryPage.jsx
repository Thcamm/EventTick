import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminCategoryPage.css";

export default function AdminCategoryPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    iconUrl: "",
    defaultCommissionPct: 10,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/categories");
      if (res.data?.success) {
        setCategories(res.data.categories || []);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể tải danh mục" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCat(null);
    setFormData({
      name: "",
      slug: "",
      iconUrl: "",
      defaultCommissionPct: 10,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCat(cat);
    setFormData({
      name: cat.name || "",
      slug: cat.slug || "",
      iconUrl: cat.icon_url || "",
      defaultCommissionPct: cat.default_commission_pct ?? 10,
      isActive: cat.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ type: "error", message: "Vui lòng nhập tên danh mục" });
      return;
    }

    try {
      setSubmitting(true);
      if (editingCat) {
        const res = await api.put(`/admin/categories/${editingCat._id}`, formData);
        if (res.data?.success) {
          setToast({ type: "success", message: "Đã cập nhật danh mục thành công" });
          setIsModalOpen(false);
          fetchCategories();
        }
      } else {
        const res = await api.post("/admin/categories", formData);
        if (res.data?.success) {
          setToast({ type: "success", message: "Đã tạo danh mục mới thành công" });
          setIsModalOpen(false);
          fetchCategories();
        }
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể lưu danh mục" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá danh mục "${cat.name}"?`)) return;
    try {
      const res = await api.delete(`/admin/categories/${cat._id}`);
      if (res.data?.success) {
        setToast({ type: "success", message: "Đã xoá danh mục thành công" });
        fetchCategories();
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không thể xoá danh mục" });
    }
  };

  return (
    <div className="admin-categories-page">
      <div className="admin-container">
        <div className="cats-page-header">
          <div>
            <div className="header-breadcrumbs">
              <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Danh mục sự kiện</span>
            </div>
            <h1>CMS Danh mục & Cấu hình phí hoa hồng</h1>
            <p className="subtitle">
              Quản lý các danh mục phân loại sự kiện, biểu tượng và tỷ lệ hoa hồng mặc định (%) áp dụng khi tạo hợp đồng.
            </p>
          </div>
          <button className="btn-primary-add" onClick={openCreateModal}>
            + Thêm danh mục mới
          </button>
        </div>

        {toast && (
          <div className={`toast-banner ${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* Categories Grid */}
        <div className="cats-card">
          {loading ? (
            <div className="cats-loading">Đang tải danh mục...</div>
          ) : categories.length === 0 ? (
            <div className="cats-empty">Chưa có danh mục nào trên hệ thống.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Biểu tượng</th>
                    <th>Tên danh mục</th>
                    <th>Slug</th>
                    <th>Hoa hồng mặc định (%)</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat._id}>
                      <td>
                        <div className="cat-icon-wrap">
                          {cat.icon_url ? (
                            <img src={cat.icon_url} alt="" onError={(e) => (e.target.style.display = "none")} />
                          ) : (
                            <span>🏷️</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong className="cat-name">{cat.name}</strong>
                      </td>
                      <td>
                        <code className="slug-code">/{cat.slug}</code>
                      </td>
                      <td>
                        <span className="commission-tag">
                          {cat.default_commission_pct !== undefined ? `${cat.default_commission_pct}%` : "10%"}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${cat.is_active ? "active" : "blocked"}`}>
                          {cat.is_active ? "Đang hiển thị" : "Đã ẩn"}
                        </span>
                      </td>
                      <td className="date-cell">
                        {cat.created_at ? new Date(cat.created_at).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="action-buttons-cell">
                          <button className="btn-edit" onClick={() => openEditModal(cat)}>
                            Sửa
                          </button>
                          <button className="btn-delete" onClick={() => handleDelete(cat)}>
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal create/edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="cat-modal-box">
            <h3>{editingCat ? "Cập nhật danh mục" : "Tạo danh mục sự kiện mới"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Tên danh mục <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Âm nhạc & Concert"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Đường dẫn Slug (Tùy chọn, tự động sinh nếu để trống)</label>
                <input
                  type="text"
                  placeholder="VD: am-nhac-concert"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>URL biểu tượng / Icon (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="https://example.com/icon.png"
                  value={formData.iconUrl}
                  onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>
                  Tỷ lệ hoa hồng mặc định (%) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  required
                  value={formData.defaultCommissionPct}
                  onChange={(e) => setFormData({ ...formData, defaultCommissionPct: e.target.value })}
                />
                <small className="help-text">
                  Mức phí EventTick thu khi bán vé sự kiện thuộc danh mục này (thường từ 5% - 20%).
                </small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Kích hoạt hiển thị trên thanh tìm kiếm & trang chủ</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Huỷ bỏ
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? "Đang lưu..." : editingCat ? "Lưu thay đổi" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
