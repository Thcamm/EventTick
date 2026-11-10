import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./ResaleEventPage.css";

const REFRESH_MS = 15000;

const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
const fmtSession = (d) =>
  d
    ? new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "long", year: "numeric" })
    : "—";

/** Một câu hỏi trong form của Ban tổ chức (custom_form_schema) */
function FormField({ field, value, onChange }) {
  const common = { id: `f-${field.key}`, value: value ?? "", onChange: (e) => onChange(e.target.value) };
  if (field.type === "textarea") return <textarea rows={3} {...common} />;
  if (field.type === "select") {
    return (
      <select {...common}>
        <option value="">-- Chọn --</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return <input id={`f-${field.key}`} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  return <input type={field.type === "number" ? "number" : "text"} {...common} />;
}

/**
 * Chợ vé bán lại — chọn vé của 1 sự kiện (giao diện giống Ticketbox).
 *  - Mỗi gói = 1 mã RSL…, có nhãn "Bán lẻ" (chọn từng vé) hoặc "Không bán lẻ" (phải mua cả gói).
 *  - Vé đang được người khác thanh toán hiển thị đỏ "Vé đang chờ thanh toán bởi người mua khác" và không chọn được.
 *  - Luồng: chọn vé -> trả lời form BTC -> giữ chỗ 10 phút -> chuyển khoản /payment/:orderId. Không áp dụng voucher.
 */
const ResaleBundlePage = () => {
  const { eventId, bundleCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [answers, setAnswers] = useState({});
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      try {
        const { data: res } = await axiosInstance.get(`/resale/events/${eventId}`);
        setData(res);
        // Bỏ chọn những vé vừa bị người khác giữ / không còn
        setSelected((prev) => {
          const free = new Set(res.bundles.flatMap((b) => b.items.filter((i) => !i.held).map((i) => i.id)));
          const next = new Set([...prev].filter((id) => free.has(id)));
          return next.size === prev.size ? prev : next;
        });
      } catch (err) {
        if (!silent) setError(err.response?.data?.message || "Không tải được danh sách vé bán lại.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS); // cập nhật trạng thái "đang chờ thanh toán"
    return () => clearInterval(t);
  }, [load]);

  const sessionById = useMemo(() => new Map((data?.sessions || []).map((s) => [String(s.id), s])), [data]);

  const bundles = useMemo(() => (data?.bundles || []).filter((b) => b.code === bundleCode), [data, bundleCode]);

  const allItems = useMemo(() => bundles.flatMap((b) => b.items.map((i) => ({ ...i, bundle: b }))), [bundles]);
  const selectedItems = allItems.filter((i) => selected.has(i.id));
  const selectedSession = selectedItems[0]?.bundle.sessionId;
  const total = selectedItems.reduce((s, i) => s + i.resalePrice, 0);
  const formSchema = data?.event?.formSchema || [];

  const freeIds = (b) => b.items.filter((i) => !i.held).map((i) => i.id);
  const bundleBlocked = (b) => !b.allowPartial && b.items.some((i) => i.held); // gói "không bán lẻ" có vé đang bị giữ

  const toggleItem = (b, item) => {
    if (item.held || bundleBlocked(b)) return;
    setSubmitError("");
    setSelected((prev) => {
      let next = new Set(prev);
      if (selectedSession && String(selectedSession) !== String(b.sessionId)) {
        next = new Set(); // đổi suất diễn: bắt đầu lại
        setSubmitError("Các vé trong một đơn phải cùng suất diễn. Đã bỏ chọn vé của suất khác.");
      }
      if (b.allowPartial) {
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      } else {
        // Không bán lẻ: chọn / bỏ cả gói
        const ids = freeIds(b);
        const all = ids.every((id) => next.has(id));
        ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      }
      if (next.size > 10) {
        setSubmitError("Mỗi đơn mua tối đa 10 vé.");
        return prev;
      }
      return next;
    });
  };

  const toggleAll = (b) => {
    if (bundleBlocked(b)) return;
    const ids = freeIds(b);
    if (!ids.length) return;
    setSubmitError("");
    setSelected((prev) => {
      let next = new Set(prev);
      if (selectedSession && String(selectedSession) !== String(b.sessionId)) next = new Set();
      const all = ids.every((id) => next.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const missingRequired = formSchema.filter((f) => {
    if (!f.required) return false;
    const v = answers[f.key];
    return f.type === "checkbox" ? v !== true : !String(v ?? "").trim();
  });
  const canSubmit = selectedItems.length > 0 && agree && missingRequired.length === 0 && !submitting;

  const submit = async () => {
    if (!user) {
      navigate(`${PATHS.LOGIN}?returnTo=/resale/${eventId}/${bundleCode}`);
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data: res } = await axiosInstance.post("/resale/orders", {
        eventId,
        listingIds: selectedItems.map((i) => i.id),
        attendeeFormAnswers: answers,
        agreeTerms: true,
      });
      navigate(`/payment/${res.orderId}`);
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Không giữ được vé, vui lòng thử lại.");
      setSelected(new Set());
      load(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rse-page rse-center">
        <div className="rse-spinner" />
        <p>Đang tải danh sách vé bán lại...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rse-page rse-center">
        <p className="rse-error">{error || "Không tìm thấy sự kiện."}</p>
        <Link to={PATHS.RESALE_MARKET} className="rse-btn-primary">Quay lại Chợ vé</Link>
      </div>
    );
  }

  const ev = data.event;
  const firstSession = sessionById.get(String(bundles[0]?.sessionId)) || data.sessions[0];

  return (
    <div className="rse-page">
      <div className="rse-container">
        <div className="rse-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>›</span>
          <Link to={`/resale/${eventId}`}>Vé bán lại</Link>
          <span>›</span>
          <strong>Chi tiết vé</strong>
        </div>

        <h1 className="rse-title">Danh sách vé bán lại</h1>

        <div className="rse-event-box">
          <div>
            <span className="rse-muted">Sự kiện</span> <strong>{ev.title}</strong>
          </div>
          <Link to={`/event/${ev.id}`} className="rse-link">Xem quy định tham gia sự kiện</Link>
          <div className="rse-event-session">
            <span className="rse-muted">Suất diễn</span> <strong>{fmtSession(firstSession?.startTime)}</strong>
          </div>
        </div>

        {bundles.length === 0 ? (
          <div className="rse-empty">Gói vé này không còn được bán. <Link to={`/resale/${eventId}`} className="rse-link">Xem các vé khác</Link></div>
        ) : (
          bundles.map((b) => {
            const blocked = bundleBlocked(b);
            const free = freeIds(b);
            const count = b.items.filter((i) => selected.has(i.id)).length;
            return (
              <section key={b.code} className="rse-bundle">
                <div className="rse-section-head">
                  <h2>Chọn vé</h2>
                  <span className={`rse-badge ${b.allowPartial ? "is-partial" : "is-whole"}`}>
                    {b.allowPartial ? "Bán lẻ" : "Không bán lẻ"}
                  </span>
                </div>
                <div className="rse-tier">
                  <span aria-hidden="true">🎫</span>
                  <span>{b.tierName}</span>
                  <span className="rse-code">{b.code}</span>
                </div>

                {b.allowPartial && free.length > 0 && (
                  <label className="rse-row rse-row-all">
                    <span>Đã chọn {count}/{b.items.length}</span>
                    <span className="rse-row-right">
                      Chọn tất cả
                      <input type="checkbox" checked={free.length > 0 && free.every((id) => selected.has(id))} onChange={() => toggleAll(b)} />
                    </span>
                  </label>
                )}
                {!b.allowPartial && (
                  <p className="rse-whole-note">Gói {b.items.length} vé này không bán lẻ — bạn cần mua tất cả.</p>
                )}

                {b.items.map((i) => {
                  const heldBlock = i.held || blocked;
                  return (
                    <label
                      key={i.id}
                      className={`rse-card-row ${heldBlock ? "is-held" : ""} ${selected.has(i.id) ? "is-selected" : ""}`}
                    >
                      <div className="rse-row-main">
                        <div>
                          <div>Số thứ tự: <strong>{i.displayCode}</strong>{i.seat ? <> · Ghế <strong>{i.seat}</strong></> : null}</div>
                          <div>
                            Giá bán mỗi vé: <strong className="rse-price">{money(i.resalePrice)}</strong>
                          </div>
                        </div>
                        {!heldBlock && (
                          <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleItem(b, i)} />
                        )}
                      </div>
                      {heldBlock && <div className="rse-held-bar">Vé đang chờ thanh toán bởi người mua khác</div>}
                    </label>
                  );
                })}
              </section>
            );
          })
        )}

        {selectedItems.length > 0 && formSchema.length > 0 && (
          <div className="rse-card">
            <h3>Thông tin người tham dự</h3>
            <p className="rse-muted">Theo yêu cầu của Ban tổ chức</p>
            {formSchema.map((f) => (
              <div key={f.key} className={`rse-field ${f.type === "checkbox" ? "rse-field-inline" : ""}`}>
                <label htmlFor={`f-${f.key}`}>
                  {f.label} {f.required && <span className="rse-req">*</span>}
                </label>
                <FormField field={f} value={answers[f.key]} onChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))} />
              </div>
            ))}
          </div>
        )}

        <label className="rse-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            Tôi đã đọc, hiểu, đồng ý và cam kết tuân thủ các <strong>Quy định sử dụng tính năng Bán lại vé</strong> trên EventTick
          </span>
        </label>

        {selectedItems.length > 0 && (
          <div className="rse-total">
            <span>{selectedItems.length} vé · Vé bán lại không áp dụng mã giảm giá</span>
            <strong>{money(total)}</strong>
          </div>
        )}
        {submitError && <p className="rse-error">{submitError}</p>}

        <button type="button" className="rse-submit" disabled={!canSubmit} onClick={submit}>
          {submitting
            ? "Đang giữ vé..."
            : selectedItems.length === 0
              ? "Vui lòng chọn vé »"
              : missingRequired.length
                ? "Vui lòng trả lời form »"
                : !agree
                  ? "Vui lòng đồng ý quy định »"
                  : `Thanh toán ${money(total)} »`}
        </button>
      </div>
    </div>
  );
};

export default ResaleBundlePage;
