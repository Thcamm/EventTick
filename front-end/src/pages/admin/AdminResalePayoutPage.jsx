import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "./AdminRefundPage.css";

const money = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n || 0);

/**
 * Chi trả cho người bán lại vé: người mua đã chuyển tiền vào tài khoản EventTick,
 * Admin chuyển khoản cho người bán theo tài khoản họ khai báo rồi bấm "Đã chuyển".
 */
export default function AdminResalePayoutPage() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/resale/payouts", { params: { status } });
      setItems(data.payouts || []);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không tải được danh sách chi trả" });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async (p) => {
    const ref = window.prompt(
      `Đã chuyển ${money(p.payoutAmount)} cho ${p.bank?.accountHolder} (${p.bank?.bankName} - ${p.bank?.accountNo})?\nNhập mã giao dịch ngân hàng để xác nhận:`,
    );
    if (!ref || !ref.trim()) return;
    setBusy(p.id);
    try {
      await api.put(`/admin/resale/payouts/${p.id}/paid`, { payoutRef: ref.trim() });
      setToast({ type: "success", message: "Đã ghi nhận chi trả cho người bán" });
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Không ghi nhận được" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="admin-refund-page">
      <div className="admin-container">
        <div className="page-header">
          <div className="header-breadcrumbs">
            <Link to="/admin/dashboard">Admin Dashboard</Link> <span>/</span> <span>Chi trả vé bán lại</span>
          </div>
          <h1>Chi trả cho người bán lại vé</h1>
          <p className="subtitle">
            Người mua đã thanh toán cho EventTick và đã nhận vé mới. Chuyển khoản số tiền bán cho người bán theo tài khoản họ khai báo, sau đó xác nhận kèm mã giao dịch.
          </p>
        </div>

        {toast && (
          <div className={`toast-banner ${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        <div className="filter-card">
          <div className="filter-group">
            <label>Trạng thái:</label>
            <div className="filter-tabs">
              <button className={status === "PENDING" ? "tab-active" : ""} onClick={() => setStatus("PENDING")}>
                Chờ chuyển tiền
              </button>
              <button className={status === "PAID" ? "tab-active" : ""} onClick={() => setStatus("PAID")}>
                Đã chuyển
              </button>
            </div>
          </div>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="tab-loading">Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="tab-empty">Không có khoản chi trả nào.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Người bán</th>
                    <th>Sự kiện / Đơn mua</th>
                    <th>Tài khoản nhận</th>
                    <th>Số tiền</th>
                    <th style={{ textAlign: "right" }}>{status === "PENDING" ? "Thao tác" : "Mã giao dịch"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="user-cell">
                          <strong>{p.seller?.name || "Người bán"}</strong>
                          <div className="email-sub">{p.seller?.email}</div>
                          <div className="phone-sub">{p.seller?.phone}</div>
                        </div>
                      </td>
                      <td>
                        <strong className="event-title-cell">{p.eventTitle || "—"}</strong>
                        <div className="order-code-sub">{p.tierName} · Đơn #{p.buyerOrderCode || "—"}</div>
                      </td>
                      <td>
                        {p.bank ? (
                          <>
                            <strong>{p.bank.accountHolder}</strong>
                            <div className="email-sub">{p.bank.bankName}</div>
                            <div className="ticket-code-tag">{p.bank.accountNo}</div>
                          </>
                        ) : (
                          <span className="dim-text">Chưa khai báo — liên hệ người bán</span>
                        )}
                      </td>
                      <td className="amount-cell">
                        <strong>{money(p.payoutAmount)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {status === "PENDING" ? (
                          <button className="btn-approve" disabled={busy === p.id} onClick={() => markPaid(p)}>
                            Đã chuyển tiền
                          </button>
                        ) : (
                          <span className="dim-text">
                            {p.payoutRef}
                            <br />
                            {p.paidOutAt ? new Date(p.paidOutAt).toLocaleString("vi-VN") : ""}
                          </span>
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
    </div>
  );
}
