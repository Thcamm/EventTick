import { useCallback, useEffect, useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import SeatMapView from './SeatMapView';
import { colorSections } from './colors';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';

/**
 * Organizer tự dựng sơ đồ chỗ ngồi / chỗ đứng cho sự kiện của mình (không qua Admin).
 * Đầu vào: zone_map.svg (khu "SEC_…", sân khấu "STAGE_…") + seating_manifest.xlsx (khu, hàng, số ghế, sức chứa khu đứng GA).
 * "Kiểm tra trước" chạy thử và vẽ ra xem trước, chưa lưu gì.
 * canEdit=false khi sự kiện đã huỷ / kết thúc: chỉ xem. Đang mở bán mà đã có vé bán / đang giữ thì backend trả 409.
 */
export default function SeatmapBuilder({ eventId, canEdit, onSaved }) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState(null); // sơ đồ đang lưu
  const [loading, setLoading] = useState(true);
  const [svg, setSvg] = useState(null);
  const [xlsx, setXlsx] = useState(null);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null); // { ok, message, details, summary, preview }

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/organizer/events/${eventId}/seatmap`);
      setCurrent(r.hasMap ? r : null);
    } catch (err) {
      showToast(err.message || 'Không tải được sơ đồ hiện tại');
    } finally {
      setLoading(false);
    }
  }, [eventId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (dryRun) => {
    if (!svg || !xlsx) return showToast('Hãy chọn đủ 2 file: SVG và Excel');
    const fd = new FormData();
    fd.append('svgFile', svg);
    fd.append('excelFile', xlsx);
    setBusy(dryRun ? 'check' : 'save');
    setResult(null);
    try {
      const r = await api.post(`/organizer/events/${eventId}/seatmap${dryRun ? '?dryRun=true' : ''}`, fd);
      if (dryRun) setResult({ ok: true, message: r.message, summary: r.summary, preview: { svgContent: r.svgContent, seats: r.seats, sections: r.summary?.sections } });
      else {
        showToast('Đã lưu sơ đồ');
        setResult({ ok: true, message: r.message, summary: r.summary });
        setSvg(null);
        setXlsx(null);
        await load();
        onSaved?.();
      }
    } catch (err) {
      setResult({ ok: false, message: err.message, details: err.data?.details });
    } finally {
      setBusy('');
    }
  };

  const previewSections = result?.preview?.sections
    ? colorSections(result.preview.sections.map((s) => ({ ...s, status: 'AVAILABLE', available: s.capacity, total: s.capacity, price: 0 })))
    : [];

  if (loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2'>
        <Loader2 size={16} className='animate-spin' /> Đang tải sơ đồ...
      </div>
    );

  return (
    <div className='space-y-5'>
      <div className='text-sm text-[#52525b] space-y-1.5'>
        <p>
          Sơ đồ là <strong>tùy chọn</strong>. Nếu có, khách nhìn thấy mặt bằng thật của sự kiện: khu <strong>ghế ngồi</strong> chọn từng ghế, khu{' '}
          <strong>chỗ đứng</strong> bấm vào khu để chọn số lượng. Nếu không có, khách chọn hạng vé và số lượng như bình thường.
        </p>
        <p>
          Cần 2 file: <code>zone_map.svg</code> (khu có id bắt đầu <code>SEC_</code>, sân khấu <code>STAGE_</code>) và <code>seating_manifest.xlsx</code> (mỗi khu: loại
          SEATED hoặc GA, hạng vé, hàng và số ghế, hoặc sức chứa cho khu đứng).
        </p>
        <p className='flex flex-wrap gap-3'>
          <a className='underline inline-flex items-center gap-1' href={`${BASE}/organizer/seatmap/template.svg`}>
            <Download size={13} /> File SVG mẫu
          </a>
          <a className='underline inline-flex items-center gap-1' href={`${BASE}/organizer/seatmap/template.xlsx`}>
            <Download size={13} /> File Excel mẫu
          </a>
        </p>
        <p className='text-xs text-[#71717a]'>
          Tên hạng vé trong cột <code>Tier_Name</code> phải trùng tên hạng vé bạn đã tạo ở bước &quot;Suất diễn &amp; vé&quot;, và có ở mọi suất diễn. Mỗi khu đứng cần một hạng vé riêng.
        </p>
      </div>

      {current ? (
        <div className='border border-[#e4e4e7] rounded-xl p-4 space-y-2'>
          <div className='flex items-center gap-2 font-semibold text-sm'>
            <CheckCircle2 size={16} /> Đã có sơ đồ cho sự kiện này
          </div>
          <ul className='text-xs text-[#52525b] grid gap-1 sm:grid-cols-2'>
            {(current.summary?.sections || []).map((s) => (
              <li key={s.sectionId}>
                <strong>{s.name}</strong> — {s.type === 'GA' ? `chỗ đứng, sức chứa ${s.capacity}` : `${s.capacity} ghế, ${s.rows} hàng`} · hạng {s.tierName}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='border border-dashed border-[#d4d4d8] rounded-xl p-4 text-sm text-[#71717a]'>Chưa có sơ đồ. Sự kiện đang dùng chế độ chọn hạng vé và số lượng.</div>
      )}

      {canEdit ? (
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            {[
              ['svg', 'File SVG mặt bằng', '.svg,image/svg+xml', svg, setSvg],
              ['xlsx', 'File Excel khu / ghế', '.xlsx', xlsx, setXlsx],
            ].map(([k, t, accept, file, setter]) => (
              <div key={k}>
                <label htmlFor={`sb-${k}`} className={label}>{t}</label>
                <label className='tb-btn tb-btn-outline cursor-pointer'>
                  <Upload size={14} /> {file ? 'Đổi tệp' : 'Chọn tệp'}
                  <input id={`sb-${k}`} type='file' accept={accept} className='hidden' onChange={(e) => setter(e.target.files?.[0] || null)} />
                </label>
                <p className='text-xs text-[#71717a] mt-2 break-all'>{file ? file.name : 'Chưa chọn (tối đa 5MB)'}</p>
              </div>
            ))}
          </div>
          <div className='flex flex-wrap gap-3'>
            <button type='button' className='tb-btn tb-btn-outline' disabled={Boolean(busy)} onClick={() => send(true)}>
              {busy === 'check' ? 'Đang kiểm tra...' : 'Kiểm tra trước'}
            </button>
            <button type='button' className='tb-btn tb-btn-solid' disabled={Boolean(busy)} onClick={() => send(false)}>
              {busy === 'save' ? 'Đang dựng...' : current ? 'Thay bằng sơ đồ này' : 'Dựng sơ đồ'}
            </button>
          </div>
        </div>
      ) : (
        <p className='text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2'>
          Sự kiện đã được duyệt hoặc mở bán nên không tự thay sơ đồ được. Hãy liên hệ Admin nếu cần đổi.
        </p>
      )}

      {result && (
        <div className={`rounded-xl border p-4 text-sm space-y-2 ${result.ok ? 'bg-[#f9f9fb] border-[#e4e4e7]' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className='flex items-start gap-2 font-semibold'>
            {result.ok ? <CheckCircle2 size={16} className='mt-0.5' /> : <AlertTriangle size={16} className='mt-0.5' />}
            <span>{result.message}</span>
          </div>
          {result.details && (
            <ul className='text-xs list-disc pl-5 space-y-0.5'>
              {Array.isArray(result.details)
                ? result.details.map((d, i) => <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>)
                : Object.entries(result.details).map(([k, v]) => (
                    <li key={k}>
                      <strong>{k}:</strong> {typeof v === 'string' ? v : JSON.stringify(v)}
                    </li>
                  ))}
            </ul>
          )}
          {result.summary && (
            <p className='text-xs text-[#52525b]'>
              {result.summary.sections?.length} khu · {result.summary.seatedPerSession} ghế mỗi suất · {result.summary.gaCapacity} chỗ đứng · {result.summary.sessions} suất diễn
            </p>
          )}
        </div>
      )}

      {result?.preview?.svgContent && (
        <div className='space-y-2'>
          <div className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>Xem trước (chưa lưu)</div>
          <SeatMapView svgContent={result.preview.svgContent} sections={previewSections} seats={result.preview.seats || []} />
        </div>
      )}
    </div>
  );
}
