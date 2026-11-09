import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import SeatMapView from "@/features/seatmap/SeatMapView";
import { colorSections } from "@/features/seatmap/colors";
import "./AdminSeatmapPage.css";

const IMPORTABLE = ["DRAFT", "PENDING", "APPROVED", "PUBLISHED"];

/** Admin dựng sơ đồ chỗ ngồi: nhận zone_map.svg + seating_manifest.xlsx từ Organizer, kiểm tra, xem trước, lưu. */
const AdminSeatmapPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [svgFile, setSvgFile] = useState(null);
  const [xlsFile, setXlsFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message, details, preview: {svgContent, summary}, saved }
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    axiosInstance
      .get("/admin/events", { params: { limit: 100 } })
      .then((r) => setEvents((r.data.items || []).filter((e) => IMPORTABLE.includes(e.status))))
      .catch(() => setEvents([]));
  }, [user]);

  useEffect(() => {
    setCurrent(null);
    setResult(null);
    if (!eventId) return;
    axiosInstance
      .get(`/admin/events/${eventId}/seatmap`)
      .then((r) => setCurrent(r.data.hasMap ? r.data : null))
      .catch(() => setCurrent(null));
  }, [eventId]);

  const run = async (dryRun) => {
    if (!eventId || !svgFile || !xlsFile) {
      setResult({ ok: false, message: "Hãy chọn sự kiện và đủ 2 file (SVG + Excel)." });
      return;
    }
    const fd = new FormData();
    fd.append("svgFile", svgFile);
    fd.append("excelFile", xlsFile);
    setBusy(true);
    try {
      const r = await axiosInstance.post(`/admin/events/${eventId}/seatmap`, fd, { params: dryRun ? { dryRun: true } : {} });
      if (dryRun) {
        setResult({ ok: true, message: r.data.message, preview: { svgContent: r.data.svgContent, summary: r.data.summary, seats: r.data.seats } });
      } else {
        setResult({ ok: true, saved: true, message: r.data.message, preview: null });
        const c = await axiosInstance.get(`/admin/events/${eventId}/seatmap`);
        setCurrent(c.data.hasMap ? c.data : null);
      }
    } catch (e) {
      setResult({ ok: false, message: e.response?.data?.message || "Không gửi được yêu cầu", details: e.response?.data?.details });
    } finally {
      setBusy(false);
    }
  };

  const previewSections = useMemo(() => {
    const src = result?.preview?.summary?.sections;
    if (!src) return [];
    return colorSections(src.map((s) => ({ ...s, sectionId: s.sectionId, status: "AVAILABLE", price: 0, available: s.capacity, total: s.capacity, color: null })));
  }, [result]);

  if (authLoading) return null;
  if (user?.role !== "ADMIN") return <Navigate to={PATHS.HOME} replace />;

  const detailLines = (d) =>
    d
      ? [
          d.onlyInSvg?.length && `Có trong SVG nhưng thiếu trong Excel: ${d.onlyInSvg.join(", ")}`,
          d.onlyInExcel?.length && `Có trong Excel nhưng thiếu trong SVG: ${d.onlyInExcel.join(", ")}`,
          ...(d.errors || []),
          ...(d.missingTiers || []).map((m) => `Suất "${m.session}" chưa có hạng vé: ${m.tiers.join(", ")}`),
          d.tiers?.length && `Hạng vé: ${d.tiers.join(", ")}`,
        ].filter(Boolean)
      : [];

  const summary = result?.preview?.summary;

  return (
    <div className="asm-page">
      <h1>Dựng sơ đồ chỗ ngồi</h1>
      <p className="asm-hint">
        Nhận 2 file từ Nhà tổ chức: <b>zone_map.svg</b> (khu có id <code>SEC_…</code>, sân khấu <code>STAGE_…</code>) và{" "}
        <b>seating_manifest.xlsx</b> (số ghế từng khu). Hạng vé phải được Organizer tạo trước; cột <code>Tier_Name</code> nối khu với hạng vé.
        File mẫu:{" "}
        <a href="/v1/admin/seatmap/template.svg" download>zone_map.svg</a> ·{" "}
        <a href="/v1/admin/seatmap/template.xlsx" download>seating_manifest.xlsx</a>
      </p>

      <div className="asm-form">
        <label>
          Sự kiện
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— Chọn sự kiện —</option>
            {events.map((e) => (
              <option key={e._id} value={e._id}>{e.title} ({e.status})</option>
            ))}
          </select>
        </label>
        <label>
          File SVG
          <input type="file" accept=".svg,image/svg+xml" onChange={(e) => setSvgFile(e.target.files[0] || null)} />
        </label>
        <label>
          File Excel
          <input type="file" accept=".xlsx" onChange={(e) => setXlsFile(e.target.files[0] || null)} />
        </label>
        <div className="asm-actions">
          <button type="button" disabled={busy} onClick={() => run(true)}>Kiểm tra &amp; xem trước</button>
          <button type="button" className="primary" disabled={busy || !result?.preview} onClick={() => run(false)}>
            Lưu sơ đồ
          </button>
        </div>
        {current && !result?.saved && (
          <p className="asm-note">Sự kiện này đã có sơ đồ. Lưu mới sẽ thay thế toàn bộ ghế cũ (chỉ được khi chưa bán / giữ vé).</p>
        )}
      </div>

      {result && (
        <div className={`asm-msg ${result.ok ? "ok" : "err"}`}>
          <strong>{result.message}</strong>
          {detailLines(result.details).length > 0 && (
            <ul>{detailLines(result.details).map((l, i) => <li key={i}>{l}</li>)}</ul>
          )}
        </div>
      )}

      {summary && (
        <>
          <div className="asm-summary">
            {summary.sessions} suất diễn · {summary.seatedPerSession} ghế đánh số mỗi suất · {summary.gaCapacity} vé đứng
          </div>
          <table className="asm-table">
            <thead><tr><th>Khu</th><th>Loại</th><th>Hạng vé</th><th>Sức chứa</th><th>Số hàng</th></tr></thead>
            <tbody>
              {summary.sections.map((s) => (
                <tr key={s.sectionId}>
                  <td>{s.name} <small>({s.sectionId})</small></td>
                  <td>{s.type === "GA" ? "Vé đứng" : "Ghế ngồi"}</td>
                  <td>{s.tierName}</td>
                  <td>{s.capacity}</td>
                  <td>{s.type === "GA" ? "—" : s.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="asm-preview">
            <SeatMapView svgContent={result.preview.svgContent} sections={previewSections} seats={result.preview.seats || []} />
          </div>
        </>
      )}

      {!summary && current && (
        <>
          <h2>Sơ đồ hiện tại</h2>
          <div className="asm-summary">Cập nhật {new Date(current.updatedAt).toLocaleString("vi-VN")}</div>
          <div className="asm-preview">
            <SeatMapView
              svgContent={current.svgContent}
              sections={colorSections(current.summary.sections.map((s) => ({ ...s, status: "AVAILABLE", price: 0, available: s.capacity, total: s.capacity })))}
              seats={current.seats || []}
            />
          </div>
        </>
      )}

      <p><Link to={PATHS.HOME}>← Về trang chủ</Link></p>
    </div>
  );
};

export default AdminSeatmapPage;
