import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Loader2, Upload } from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../../api/client';
import { eventsService } from '../../services/events.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import { inputCls } from '../../components/FormField';
import SeatmapBuilder from '../../features/seatmap/SeatmapBuilder';

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];
const FIELD_TYPES = [
  { v: 'text', t: 'Văn bản ngắn' },
  { v: 'textarea', t: 'Văn bản dài' },
  { v: 'number', t: 'Số' },
  { v: 'select', t: 'Lựa chọn' },
  { v: 'checkbox', t: 'Ô tick' },
];
// datetime-local (giờ máy khách) <-> ISO
const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};
const newTier = (i = 0) => ({ name: '', price: '', quantity: '', zoneType: 'GA', color: COLORS[i % COLORS.length], minPerOrder: 1, maxPerOrder: 6 });
const newSession = () => ({ name: '', startTime: '', endTime: '', tiers: [newTier()] });
const newQuestion = () => ({ key: '', label: '', type: 'text', required: false, optionsText: '' });
const slugKey = (s) => {
  const base = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join('');
  return /^[a-zA-Z]/.test(base) ? base.slice(0, 40) : `q${base}`.slice(0, 40);
};

/**
 * Tạo sự kiện (UC22, UC25, UC26) — 4 bước. Chế độ sửa (/organizer/events/:id/edit) chỉ cho phép sửa
 * những gì backend cho phép theo trạng thái (DRAFT: sửa hết cấu trúc; đã duyệt: chỉ mô tả).
 */
export default function CreateEventPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [params] = useSearchParams();
  const [step, setStep] = useState(() => (params.get('step') === 'seatmap' ? 3 : 1));
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [info, setInfo] = useState({ title: '', category: '', venueName: '', city: '', description: '', organizerInfo: '', allowResale: false, maxResaleMarkupPct: 10 });
  const [banner, setBanner] = useState(null);
  const [legalDoc, setLegalDoc] = useState(null);
  const [hasLegalDoc, setHasLegalDoc] = useState(false);
  const [thumb, setThumb] = useState(null);
  const [sessions, setSessions] = useState([newSession()]);
  const [questions, setQuestions] = useState([]);

  const structural = !editing || status === 'DRAFT';

  useEffect(() => {
    eventsService
      .categories()
      .then((r) => {
        const list = r.categories || [];
        setCategories(list);
        if (!editing && list[0]) setInfo((p) => ({ ...p, category: p.category || list[0].name }));
      })
      .catch(() => {});
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/organizer/events/${id}`)
      .then((r) => {
        const e = r.event;
        setStatus(e.status);
        setHasLegalDoc(Boolean(e.hasLegalDoc));
        setInfo({
          title: e.title || '',
          category: '',
          venueName: e.venueName || '',
          city: e.city || '',
          description: e.description || '',
          organizerInfo: e.organizerInfo || '',
          allowResale: Boolean(e.allowResale),
          maxResaleMarkupPct: e.maxResaleMarkupPct ?? 10,
        });
        setQuestions(
          (e.customFormSchema || []).map((f) => ({ key: f.key, label: f.label, type: f.type, required: Boolean(f.required), optionsText: (f.options || []).join(', ') })),
        );
        setSessions(
          (e.sessions || []).map((s) => ({
            id: s._id,
            name: s.name,
            startTime: toLocalInput(s.startTime),
            endTime: toLocalInput(s.endTime),
            tiers: (s.tiers || []).map((t) => ({
              id: t._id,
              name: t.name,
              price: t.price,
              quantity: t.totalQuantity ?? t.total_quantity ?? t.quantity,
              zoneType: t.zoneType || t.zone_type || 'GA',
              color: t.zoneColor || COLORS[0],
              minPerOrder: t.minPerOrder ?? 1,
              maxPerOrder: t.maxPerOrder ?? 6,
            })),
          })),
        );
      })
      .catch((err) => {
        showToast(err.message || 'Không tải được sự kiện');
        navigate(PATHS.ORGANIZER_EVENTS);
      })
      .finally(() => setLoading(false));
  }, [editing, id, navigate, showToast]);

  const setI = (k) => (e) => setInfo({ ...info, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const upSession = (i, patch) => setSessions((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const upTier = (i, k, patch) =>
    setSessions((p) => p.map((s, j) => (j === i ? { ...s, tiers: s.tiers.map((t, m) => (m === k ? { ...t, ...patch } : t)) } : s)));
  const upQ = (i, patch) => setQuestions((p) => p.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const pickLegalDoc = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
      showToast('Giấy phép phải là ảnh JPG, PNG, WEBP hoặc PDF');
      e.target.value = '';
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Tệp quá lớn (tối đa 10MB)');
      e.target.value = '';
      return;
    }
    setLegalDoc(f);
  };

  const uploadLegalDoc = async (eventId) => {
    const fd = new FormData();
    fd.append('document', legalDoc);
    await api.put(`/organizer/events/${eventId}/legal-doc`, fd);
  };

  const pickImage = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      showToast('Ảnh phải là JPG, PNG hoặc WEBP');
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB)');
      e.target.value = '';
      return;
    }
    setter(f);
  };

  const buildSchema = () =>
    questions.map((q) => ({
      key: q.key.trim() || slugKey(q.label),
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      ...(q.type === 'select' ? { options: q.optionsText.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
    }));

  // Trả về thông báo lỗi của bước, hoặc '' nếu hợp lệ
  const validate = (s, forSubmit) => {
    if (s === 1 && structural) {
      if (!info.title.trim()) return 'Vui lòng nhập tên sự kiện';
      if (!info.venueName.trim()) return 'Vui lòng nhập địa điểm';
      if (!info.city.trim()) return 'Vui lòng nhập thành phố';
      if (!editing && !banner) return 'Vui lòng chọn ảnh bìa sự kiện';
      if (forSubmit && !legalDoc && !hasLegalDoc) return 'Vui lòng tải lên giấy phép tổ chức sự kiện trước khi gửi duyệt';
    }
    if (s === 2 && structural) {
      if (!sessions.length) return 'Cần ít nhất 1 suất diễn';
      for (const [i, se] of sessions.entries()) {
        if (!se.startTime) return `Suất ${i + 1}: chọn giờ bắt đầu`;
        if (se.endTime && new Date(se.endTime) <= new Date(se.startTime)) return `Suất ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`;
        if (forSubmit && new Date(se.startTime) <= new Date()) return `Suất ${i + 1}: giờ bắt đầu phải ở tương lai`;
        if (!se.tiers.length) return `Suất ${i + 1}: cần ít nhất 1 hạng vé`;
        for (const [k, t] of se.tiers.entries()) {
          if (!t.name.trim()) return `Suất ${i + 1}, hạng vé ${k + 1}: nhập tên`;
          if (t.price === '' || Number(t.price) < 0) return `Suất ${i + 1}, hạng vé ${k + 1}: giá không hợp lệ`;
          if (!Number.isInteger(Number(t.quantity)) || Number(t.quantity) < 1) return `Suất ${i + 1}, hạng vé ${k + 1}: số lượng phải ≥ 1`;
          if (Number(t.minPerOrder) > Number(t.maxPerOrder)) return `Suất ${i + 1}, hạng vé ${k + 1}: tối thiểu không được lớn hơn tối đa`;
        }
      }
    }
    if (s === 4 && structural) {
      for (const [i, q] of questions.entries()) {
        if (!q.label.trim()) return `Câu hỏi ${i + 1}: nhập nội dung`;
        if (q.type === 'select' && q.optionsText.split(',').filter((o) => o.trim()).length < 2) return `Câu hỏi ${i + 1}: lựa chọn cần ít nhất 2 phương án (ngăn cách bằng dấu phẩy)`;
      }
      const keys = buildSchema().map((q) => q.key);
      if (new Set(keys).size !== keys.length) return 'Có hai câu hỏi trùng nhau, hãy đổi nội dung một câu';
    }
    return '';
  };

  const next = () => {
    const err = validate(step, false);
    if (err) return showToast(err);
    setStep((s) => s + 1);
  };

  const save = async (asDraft) => {
    for (const s of [1, 2, 4]) {
      const err = validate(s, !asDraft);
      if (err) {
        setStep(s);
        return showToast(err);
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const body = { description: info.description, organizerInfo: info.organizerInfo };
        if (structural) {
          Object.assign(body, {
            title: info.title.trim(),
            venueName: info.venueName.trim(),
            city: info.city.trim(),
            allowResale: info.allowResale,
            maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
            customFormSchema: buildSchema(),
            ...(info.category ? { category: info.category } : {}),
          });
        }
        await api.put(`/organizer/events/${id}`, body);
        if (banner || thumb) {
          const fd = new FormData();
          if (banner) fd.append('backgroundImage', banner);
          if (thumb) fd.append('eventImage', thumb);
          await api.put(`/organizer/events/${id}/images`, fd);
        }
        if (legalDoc && ['DRAFT', 'PENDING'].includes(status)) {
          await uploadLegalDoc(id);
          setHasLegalDoc(true);
          setLegalDoc(null);
        }
        showToast('Đã lưu thay đổi');
      } else {
        const payload = {
          title: info.title.trim(),
          category: info.category,
          venueName: info.venueName.trim(),
          city: info.city.trim(),
          description: info.description,
          organizerInfo: info.organizerInfo,
          allowResale: info.allowResale,
          maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
          customFormSchema: buildSchema(),
          saveAsDraft: true, // luôn tạo bản nháp trước: cần mã sự kiện để tải giấy phép, rồi mới gửi duyệt
          sessions: sessions.map((s) => ({
            name: s.name.trim() || undefined,
            startTime: new Date(s.startTime).toISOString(),
            endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
            tickets: s.tiers.map((t) => ({
              name: t.name.trim(),
              price: Number(t.price),
              totalQuantity: Number(t.quantity),
              zoneType: t.zoneType,
              zoneColor: t.color,
              minPerOrder: Number(t.minPerOrder),
              maxPerOrder: Number(t.maxPerOrder),
            })),
          })),
        };
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload));
        if (banner) fd.append('backgroundImage', banner);
        if (thumb) fd.append('eventImage', thumb);
        const r = await api.post('/events', fd);
        const newId = r.eventId;
        if (legalDoc) {
          try {
            await uploadLegalDoc(newId);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa tải được giấy phép: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
            return;
          }
        }
        if (!asDraft) {
          try {
            await api.post(`/organizer/events/${newId}/submit`, {});
            showToast('Đã gửi Admin duyệt');
            navigate(PATHS.ORGANIZER_EVENTS);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa gửi duyệt được: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
          }
          return;
        }
        showToast(r.message || 'Đã lưu bản nháp');
        // Bản nháp: chuyển thẳng sang sửa, bước Sơ đồ, để tải file SVG + Excel (cần mã sự kiện)
        navigate(`/organizer/events/${newId}/edit?step=seatmap`, { replace: true });
        return;
      }
      navigate(PATHS.ORGANIZER_EVENTS);
    } catch (err) {
      showToast(err.message || 'Không lưu được sự kiện');
    } finally {
      setSaving(false);
    }
  };

  const steps = ['Thông tin', 'Suất diễn & vé', 'Sơ đồ (tùy chọn)', 'Form người tham dự', 'Xem lại'];
  const preview = useMemo(() => DOMPurify.sanitize(info.description || ''), [info.description]);

  if (loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2 py-10'>
        <Loader2 size={16} className='animate-spin' /> Đang tải...
      </div>
    );

  return (
    <div className='max-w-4xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</h1>
        {editing && !structural && (
          <p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2'>
            Sự kiện đã {status === 'PENDING' ? 'gửi duyệt' : 'được duyệt'}, chỉ sửa được mô tả và thông tin tổ chức.
            {status === 'PENDING' && ' Hãy rút lại về bản nháp nếu cần sửa nhiều hơn.'}
          </p>
        )}
      </div>

      <ol className='flex flex-wrap gap-2'>
        {steps.map((t, i) => (
          <li key={t}>
            <button
              type='button'
              onClick={() => (i + 1 < step ? setStep(i + 1) : undefined)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                step === i + 1 ? 'bg-[#09090b] text-white border-[#09090b]' : i + 1 < step ? 'bg-white border-[#09090b] text-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#71717a]'
              }`}>
              {i + 1}. {t}
            </button>
          </li>
        ))}
      </ol>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-5'>
        {step === 1 && (
          <>
            <div>
              <label htmlFor='e-title' className={label}>Tên sự kiện</label>
              <input id='e-title' disabled={!structural} className={inputCls} value={info.title} onChange={setI('title')} maxLength={255} />
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div>
                <label htmlFor='e-cat' className={label}>Danh mục</label>
                <select id='e-cat' disabled={!structural} className={inputCls} value={info.category} onChange={setI('category')}>
                  {editing && <option value=''>(giữ nguyên)</option>}
                  {categories.map((c) => (
                    <option key={c._id || c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor='e-venue' className={label}>Địa điểm</label>
                <input id='e-venue' disabled={!structural} className={inputCls} value={info.venueName} onChange={setI('venueName')} />
              </div>
              <div>
                <label htmlFor='e-city' className={label}>Thành phố</label>
                <input id='e-city' disabled={!structural} className={inputCls} value={info.city} onChange={setI('city')} />
              </div>
            </div>
            <div>
              <label htmlFor='e-desc' className={label}>Mô tả (hỗ trợ HTML cơ bản)</label>
              <textarea id='e-desc' rows={6} className={inputCls} value={info.description} onChange={setI('description')} />
            </div>
            <div>
              <label htmlFor='e-org' className={label}>Thông tin đơn vị tổ chức</label>
              <textarea id='e-org' rows={2} className={inputCls} value={info.organizerInfo} onChange={setI('organizerInfo')} />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              {[
                ['Ảnh bìa (banner)', banner, setBanner],
                ['Ảnh đại diện (thumbnail)', thumb, setThumb],
              ].map(([t, f, setter]) => (
                <div key={t}>
                  <div className={label}>{t}{!editing && t.startsWith('Ảnh bìa') && ' *'}</div>
                  <label className='tb-btn tb-btn-outline cursor-pointer'>
                    <Upload size={14} /> {f ? 'Đổi ảnh' : 'Chọn ảnh'}
                    <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' onChange={pickImage(setter)} />
                  </label>
                  <p className='text-xs text-[#71717a] mt-2'>{f ? f.name : editing ? 'Giữ ảnh hiện tại nếu không chọn' : 'JPG, PNG, WEBP, tối đa 5MB'}</p>
                </div>
              ))}
            </div>
            <div className='border-t border-[#f4f4f6] pt-4 space-y-2'>
              <div className={label}>Giấy phép tổ chức sự kiện (bắt buộc khi gửi duyệt)</div>
              {editing && !['DRAFT', 'PENDING'].includes(status) ? (
                <p className='text-xs text-[#71717a]'>{hasLegalDoc ? 'Đã nộp giấy phép.' : 'Chưa có giấy phép.'} Sự kiện đã được duyệt nên không thay được.</p>
              ) : (
                <>
                  <label className='tb-btn tb-btn-outline cursor-pointer'>
                    <Upload size={14} /> {legalDoc ? 'Đổi tệp' : hasLegalDoc ? 'Thay giấy phép' : 'Chọn tệp'}
                    <input type='file' accept='image/jpeg,image/png,image/webp,application/pdf' className='hidden' onChange={pickLegalDoc} />
                  </label>
                  <p className='text-xs text-[#71717a]'>
                    {legalDoc
                      ? legalDoc.name
                      : hasLegalDoc
                        ? 'Đã có giấy phép trên hệ thống (lưu riêng tư, chỉ Admin duyệt xem được). Chọn tệp mới nếu muốn thay.'
                        : 'Giấy phép biểu diễn / tổ chức sự kiện do cơ quan có thẩm quyền cấp. JPG, PNG, WEBP hoặc PDF, tối đa 10MB.'}
                  </p>
                </>
              )}
            </div>
            <div className='border-t border-[#f4f4f6] pt-4 space-y-3'>
              <label className='flex items-center gap-2.5 text-sm cursor-pointer'>
                <input type='checkbox' disabled={!structural} className='w-4 h-4 accent-[#09090b]' checked={info.allowResale} onChange={setI('allowResale')} />
                Cho phép khách bán lại vé trên chợ chính thức
              </label>
              {info.allowResale && (
                <div className='max-w-xs'>
                  <label htmlFor='e-markup' className={label}>Giá bán lại tối đa (+% so với giá gốc)</label>
                  <input id='e-markup' type='number' min='0' max='100' disabled={!structural} className={inputCls} value={info.maxResaleMarkupPct} onChange={setI('maxResaleMarkupPct')} />
                </div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <div className='space-y-6'>
            {editing && structural && (
              <p className='text-xs text-[#71717a]'>
                Ở chế độ sửa, suất diễn và hạng vé hiển thị để xem. Muốn đổi, hãy dùng chức năng thêm / sửa suất diễn khi sự kiện còn là bản nháp.
              </p>
            )}
            {sessions.map((s, i) => (
              <div key={s.id || i} className='border border-[#e4e4e7] rounded-xl p-4 space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='font-bold'>Suất diễn {i + 1}</h3>
                  {!editing && sessions.length > 1 && (
                    <button type='button' className='text-xs text-red-700 flex items-center gap-1' onClick={() => setSessions((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 size={13} /> Xóa suất
                    </button>
                  )}
                </div>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <div>
                    <label className={label}>Tên suất</label>
                    <input disabled={editing} className={inputCls} value={s.name} onChange={(e) => upSession(i, { name: e.target.value })} placeholder={`Suất diễn ${i + 1}`} />
                  </div>
                  <div>
                    <label className={label}>Bắt đầu</label>
                    <input type='datetime-local' disabled={editing} className={inputCls} value={s.startTime} onChange={(e) => upSession(i, { startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>Kết thúc (tùy chọn)</label>
                    <input type='datetime-local' disabled={editing} className={inputCls} value={s.endTime} onChange={(e) => upSession(i, { endTime: e.target.value })} />
                  </div>
                </div>

                <div className='space-y-3'>
                  {s.tiers.map((t, k) => (
                    <div key={t.id || k} className='grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto] items-end bg-[#f9f9fb] rounded-lg p-3'>
                      <div>
                        <label className={label}>Hạng vé</label>
                        <input disabled={editing} className={inputCls} value={t.name} onChange={(e) => upTier(i, k, { name: e.target.value })} placeholder='VIP, Thường...' />
                      </div>
                      <div>
                        <label className={label}>Giá (₫)</label>
                        <input type='number' min='0' disabled={editing} className={inputCls} value={t.price} onChange={(e) => upTier(i, k, { price: e.target.value })} />
                      </div>
                      <div>
                        <label className={label}>Số lượng</label>
                        <input type='number' min='1' disabled={editing} className={inputCls} value={t.quantity} onChange={(e) => upTier(i, k, { quantity: e.target.value })} />
                      </div>
                      <div>
                        <label className={label}>Loại</label>
                        <select disabled={editing} className={inputCls} value={t.zoneType} onChange={(e) => upTier(i, k, { zoneType: e.target.value })}>
                          <option value='GA'>Vé đứng</option>
                          <option value='SEATED'>Ghế đánh số</option>
                        </select>
                      </div>
                      <div className='flex items-center gap-2'>
                        <input type='color' disabled={editing} value={t.color} onChange={(e) => upTier(i, k, { color: e.target.value })} className='w-9 h-9 rounded border border-[#e4e4e7] bg-white' aria-label='Màu khu' />
                        {!editing && s.tiers.length > 1 && (
                          <button type='button' aria-label='Xóa hạng vé' className='text-red-700' onClick={() => upSession(i, { tiers: s.tiers.filter((_, m) => m !== k) })}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!editing && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => upSession(i, { tiers: [...s.tiers, newTier(s.tiers.length)] })}>
                      <Plus size={13} /> Thêm hạng vé
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!editing && (
              <button type='button' className='tb-btn tb-btn-outline' onClick={() => setSessions((p) => [...p, newSession()])}>
                <Plus size={14} /> Thêm suất diễn
              </button>
            )}
            <p className='text-xs text-[#71717a]'>
              Hạng vé &quot;Ghế đánh số&quot; cần sơ đồ chỗ ngồi: bạn tự tải file SVG + Excel ở bước &quot;Sơ đồ&quot; sau khi lưu bản nháp, không cần qua Admin.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            <h2 className='font-bold'>Sơ đồ chỗ ngồi / chỗ đứng</h2>
            {editing ? (
              <SeatmapBuilder eventId={id} canEdit={['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED'].includes(status)} />
            ) : (
              <div className='text-sm text-[#52525b] space-y-2'>
                <p>
                  Sơ đồ được dựng sau khi sự kiện được lưu (cần mã sự kiện). Hãy bấm <strong>Lưu bản nháp</strong> ở bước cuối: hệ thống sẽ tự chuyển bạn về bước này để tải file SVG + Excel.
                </p>
                <p className='text-xs text-[#71717a]'>Nếu không cần sơ đồ, bỏ qua bước này: khách sẽ chọn hạng vé và số lượng.</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className='space-y-4'>
            <p className='text-sm text-[#52525b]'>Câu hỏi khách phải trả lời khi đặt vé (tối đa 20). Có thể bỏ trống nếu không cần.</p>
            {questions.map((q, i) => (
              <div key={i} className='border border-[#e4e4e7] rounded-xl p-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto]'>
                <div>
                  <label className={label}>Câu hỏi {i + 1}</label>
                  <input disabled={!structural} className={inputCls} value={q.label} onChange={(e) => upQ(i, { label: e.target.value })} placeholder='Ví dụ: Họ tên người tham dự' />
                </div>
                <div>
                  <label className={label}>Kiểu</label>
                  <select disabled={!structural} className={inputCls} value={q.type} onChange={(e) => upQ(i, { type: e.target.value })}>
                    {FIELD_TYPES.map((f) => (
                      <option key={f.v} value={f.v}>
                        {f.t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='flex items-end gap-3'>
                  <label className='flex items-center gap-1.5 text-xs pb-2.5 cursor-pointer'>
                    <input type='checkbox' disabled={!structural} className='w-4 h-4 accent-[#09090b]' checked={q.required} onChange={(e) => upQ(i, { required: e.target.checked })} /> Bắt buộc
                  </label>
                  {structural && (
                    <button type='button' aria-label='Xóa câu hỏi' className='text-red-700 pb-2.5' onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {q.type === 'select' && (
                  <div className='sm:col-span-3'>
                    <label className={label}>Các lựa chọn (ngăn cách bằng dấu phẩy)</label>
                    <input disabled={!structural} className={inputCls} value={q.optionsText} onChange={(e) => upQ(i, { optionsText: e.target.value })} placeholder='S, M, L, XL' />
                  </div>
                )}
              </div>
            ))}
            {structural && questions.length < 20 && (
              <button type='button' className='tb-btn tb-btn-outline' onClick={() => setQuestions((p) => [...p, newQuestion()])}>
                <Plus size={14} /> Thêm câu hỏi
              </button>
            )}
          </div>
        )}

        {step === 5 && (
          <div className='space-y-4 text-sm'>
            <div className='grid gap-3 sm:grid-cols-2'>
              {[
                ['Tên sự kiện', info.title],
                ['Địa điểm', `${info.venueName}, ${info.city}`],
                ['Số suất diễn', sessions.length],
                ['Số hạng vé', sessions.reduce((n, s) => n + s.tiers.length, 0)],
                ['Số câu hỏi', questions.length],
                ['Giấy phép', legalDoc ? legalDoc.name : hasLegalDoc ? 'Đã nộp' : 'Chưa có'],
                ['Bán lại vé', info.allowResale ? `Cho phép, tối đa +${info.maxResaleMarkupPct}%` : 'Không'],
              ].map(([k, v]) => (
                <div key={k} className='bg-[#f9f9fb] rounded-lg p-3'>
                  <div className='text-[11px] uppercase tracking-wider text-[#71717a]'>{k}</div>
                  <div className='font-semibold'>{v || '—'}</div>
                </div>
              ))}
            </div>
            {preview && <div className='border border-[#e4e4e7] rounded-lg p-3 max-h-40 overflow-y-auto' dangerouslySetInnerHTML={{ __html: preview }} />}
            <p className='text-xs text-[#71717a]'>
              {editing
                ? 'Bấm Lưu thay đổi để cập nhật.'
                : 'Lưu nháp để sửa tiếp sau, hoặc Gửi duyệt để Admin xét. Sau khi Admin duyệt, bạn sẽ ký hợp đồng điện tử và sự kiện được mở bán.'}
            </p>
          </div>
        )}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <button type='button' disabled={step === 1} className='tb-btn tb-btn-outline' onClick={() => setStep((s) => s - 1)}>
          Quay lại
        </button>
        <div className='flex flex-wrap gap-3'>
          {step < 5 ? (
            <button type='button' className='tb-btn tb-btn-solid' onClick={next}>
              Tiếp tục
            </button>
          ) : editing ? (
            <button type='button' disabled={saving} className='tb-btn tb-btn-solid' onClick={() => save(true)}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          ) : (
            <>
              <button type='button' disabled={saving} className='tb-btn tb-btn-outline' onClick={() => save(true)}>
                Lưu bản nháp
              </button>
              <button type='button' disabled={saving} className='tb-btn tb-btn-solid' onClick={() => save(false)}>
                {saving ? 'Đang gửi...' : 'Gửi duyệt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
