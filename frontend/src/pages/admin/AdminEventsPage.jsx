import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Check, X, Calendar, MapPin, Star, Flame, Sparkles, Ban, Upload } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const TABS = [
  { k: 'PENDING', t: 'Chờ duyệt' },
  { k: 'APPROVED', t: 'Chờ ký hợp đồng' },
  { k: 'PUBLISHED', t: 'Đang mở bán' },
  { k: 'CANCELLED', t: 'Đã huỷ' },
  { k: 'CONTRACTS', t: 'Hợp đồng' },
];
const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
const CONTRACT_STATUS = { WAITING_SIGN: 'Chờ ký', SIGNED: 'Đã ký', REJECTED: 'Đã từ chối' };

/** UC39, UC40, UC41, UC43, UC24: duyệt sự kiện + hoa hồng, hợp đồng, nổi bật trang chủ, dựng sơ đồ ghế, hoàn tiền khi huỷ. */
export default function AdminEventsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState(null); // { type: approve|reject|refund|commission|seatmap, target }
  const [form, setForm] = useState({ rate: '', terms: '', reason: '' });
  const [files, setFiles] = useState({ svg: null, xlsx: null });
  const [seatResult, setSeatResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'CONTRACTS') {
        const r = await api.get('/admin/contracts');
        setContracts(r.contracts || r.items || []);
      } else {
        const r = await api.get(`/admin/events?status=${tab}&limit=50`);
        setItems(r.items || []);
      }
    } catch (err) {
      showToast(err.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [tab, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const close = () => {
    setDlg(null);
    setSeatResult(null);
    setFiles({ svg: null, xlsx: null });
  };
  const openDlg = (type, target) => {
    setForm({ rate: target.defaultCommissionPct ?? target.commissionRatePct ?? '10', terms: '', reason: '' });
    setSeatResult(null);
    setDlg({ type, target });
  };

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const r = await fn();
      showToast(okMsg ? okMsg(r) : 'Thành công');
      close();
      await load();
    } catch (err) {
      showToast(err.message || 'Không thực hiện được');
    } finally {
      setBusy('');
    }
  };

  const openLegal = async (e) => {
    try {
      const r = await api.get(`/admin/events/${e._id}/legal-doc`);
      window.open(r.url || `${BASE}/admin/events/${e._id}/legal-doc`, '_blank', 'noopener');
    } catch (err) {
      showToast(err.message || 'Không mở được giấy phép');
    }
  };

  const approve = () => {
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return showToast('Hoa hồng phải từ 0 đến 50 (%)');
    run('approve', () => api.put(`/admin/events/${dlg.target._id}/approve`, { commissionRatePct: rate, ...(form.terms.trim() ? { customTerms: form.terms.trim() } : {}) }), (r) => r.message || 'Đã duyệt sự kiện');
  };
  const reject = () => {
    if (!form.reason.trim()) return showToast('Vui lòng nhập lý do từ chối');
    run('reject', () => api.put(`/admin/events/${dlg.target._id}/reject`, { reason: form.reason.trim() }), () => 'Đã từ chối, sự kiện trở về bản nháp');
  };
  const refund = () => {
    if (!form.reason.trim()) return showToast('Vui lòng nhập lý do huỷ');
    run('refund', () => api.post(`/admin/events/${dlg.target._id}/bulk-refund`, { reason: form.reason.trim() }), (r) => `${r.message}. Hoàn ${money(r.totalRefundAmount)}, đã email ${r.notifiedBuyersCount} khách`);
  };
  const commission = () => {
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return showToast('Hoa hồng phải từ 0 đến 50 (%)');
    run('commission', () => api.put(`/admin/contracts/${dlg.target.id}/commission`, { commissionRatePct: rate }), () => 'Đã cập nhật hoa hồng');
  };
  const feature = (e, patch) => run(`f:${e._id}`, () => api.put(`/admin/events/${e._id}/featured`, patch), () => 'Đã cập nhật trang chủ');

  const submitSeatmap = async (dryRun) => {
    if (!files.svg || !files.xlsx) return showToast('Chọn đủ file SVG và Excel');
    const fd = new FormData();
    fd.append('svgFile', files.svg);
    fd.append('excelFile', files.xlsx);
    setBusy('seat');
    setSeatResult(null);
    try {
      const r = await api.post(`/admin/events/${dlg.target._id}/seatmap${dryRun ? '?dryRun=true' : ''}`, fd);
      setSeatResult({ ok: true, message: r.message, summary: r.summary });
      if (!dryRun) showToast('Đã dựng sơ đồ chỗ ngồi');
    } catch (err) {
      setSeatResult({ ok: false, message: err.message, details: err.data?.details });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Sự kiện & hợp đồng</h1>
        <p className='text-sm text-[#71717a] mt-1'>Duyệt nội dung, đặt hoa hồng, theo dõi hợp đồng và xử lý huỷ sự kiện.</p>
      </div>

      <div className='flex flex-wrap gap-2'>
        {TABS.map(({ k, t }) => (
          <button key={k} type='button' onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${tab === k ? 'bg-[#09090b] text-white border-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#52525b] hover:border-[#09090b]'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : tab === 'CONTRACTS' ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Số hợp đồng</th>
                <th>Sự kiện</th>
                <th>Hoa hồng</th>
                <th>Trạng thái</th>
                <th>Ký lúc</th>
                <th className='text-right pr-4'>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={6} className='p-8 text-center text-[#71717a]'>Chưa có hợp đồng.</td>
                </tr>
              )}
              {contracts.map((c) => (
                <tr key={c.id} className='border-b border-[#f4f4f6] last:border-0'>
                  <td className='p-4 font-mono text-xs'>{c.contractNumber}</td>
                  <td className='font-semibold'>{c.eventTitle || '—'}</td>
                  <td>{c.commissionRatePct}%</td>
                  <td>{CONTRACT_STATUS[c.status] || c.status}</td>
                  <td className='text-xs text-[#52525b]'>{fmt(c.signedAt)}</td>
                  <td className='text-right pr-4 space-x-2'>
                    {c.status === 'WAITING_SIGN' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openDlg('commission', c)}>
                        Sửa hoa hồng
                      </button>
                    )}
                    {c.status === 'SIGNED' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => window.open(`${BASE}/admin/contracts/${c.id}/pdf`, '_blank', 'noopener')}>
                        Tải PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>Không có sự kiện nào.</div>
      ) : (
        <div className='grid gap-4'>
          {items.map((e) => (
            <div key={e._id} className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col sm:flex-row gap-4'>
              <img src={e.bannerUrl} alt='' className='w-full sm:w-40 h-28 rounded-xl object-cover bg-[#f4f4f6] shrink-0' onError={(ev) => { ev.currentTarget.src = '/assets/banners/hero_0.jpg'; }} />
              <div className='flex-1 min-w-0 space-y-2'>
                <h2 className='font-bold'>{e.title}</h2>
                <div className='text-xs text-[#52525b] flex flex-wrap gap-x-4 gap-y-1'>
                  <span className='flex items-center gap-1.5'><Calendar size={12} /> {fmt(e.startTime)}</span>
                  <span className='flex items-center gap-1.5'><MapPin size={12} /> {e.venueName}, {e.city}</span>
                  {e.categoryName && <span>Danh mục: {e.categoryName}</span>}
                  <span>Từ {money(e.lowestPrice)}</span>
                </div>
                <div className='text-xs text-[#71717a]'>Nhà tổ chức: {e.organizerName || '—'} {e.organizerEmail && `(${e.organizerEmail})`}</div>
                {e.rejectionReason && <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>Đã từ chối: {e.rejectionReason}</p>}

                <div className='flex flex-wrap gap-2 pt-1'>
                  <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={!e.hasLegalDoc} onClick={() => openLegal(e)} title={e.hasLegalDoc ? '' : 'Nhà tổ chức chưa nộp giấy phép'}>
                    <FileText size={13} /> Giấy phép
                  </button>
                  {tab === 'PENDING' && (
                    <>
                      <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' onClick={() => openDlg('approve', e)}>
                        <Check size={13} /> Duyệt
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => openDlg('reject', e)}>
                        <X size={13} /> Từ chối
                      </button>
                    </>
                  )}
                  {['PENDING', 'APPROVED', 'PUBLISHED'].includes(tab) && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openDlg('seatmap', e)}>
                      <Upload size={13} /> Sơ đồ ghế
                    </button>
                  )}
                  {tab === 'PUBLISHED' && (
                    <>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isFeaturedBanner: true })} title='Đưa lên banner trang chủ'>
                        <Star size={13} /> Banner
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isTrending: true })}>
                        <Flame size={13} /> Xu hướng
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isSpecial: true })}>
                        <Sparkles size={13} /> Duy nhất
                      </button>
                    </>
                  )}
                  {['APPROVED', 'PUBLISHED'].includes(tab) && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => openDlg('refund', e)}>
                      <Ban size={13} /> Huỷ & hoàn tiền
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dlg && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={close}>
          <div className='bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <h3 className='font-bold'>
              {{ approve: 'Duyệt sự kiện', reject: 'Từ chối sự kiện', refund: 'Huỷ sự kiện & hoàn tiền hàng loạt', commission: 'Sửa hoa hồng hợp đồng', seatmap: 'Dựng sơ đồ chỗ ngồi' }[dlg.type]}
              <span className='block text-sm font-normal text-[#71717a] mt-0.5'>{dlg.target.title || dlg.target.eventTitle}</span>
            </h3>

            {(dlg.type === 'approve' || dlg.type === 'commission') && (
              <div>
                <label htmlFor='ad-rate' className={label}>Hoa hồng nền tảng (%) — từ 0 đến 50</label>
                <input id='ad-rate' type='number' min='0' max='50' step='0.5' className={inputCls} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
            )}
            {dlg.type === 'approve' && (
              <div>
                <label htmlFor='ad-terms' className={label}>Điều khoản bổ sung (tùy chọn)</label>
                <textarea id='ad-terms' rows={3} className={inputCls} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} maxLength={5000} />
                <p className='text-xs text-[#71717a] mt-1.5'>Duyệt xong hệ thống tự tạo hợp đồng chờ nhà tổ chức ký, ký xong sự kiện mới mở bán.</p>
              </div>
            )}
            {(dlg.type === 'reject' || dlg.type === 'refund') && (
              <div>
                <label htmlFor='ad-reason' className={label}>{dlg.type === 'reject' ? 'Lý do từ chối (nhà tổ chức sẽ thấy)' : 'Lý do huỷ (gửi email cho khách đã mua vé)'}</label>
                <textarea id='ad-reason' rows={4} className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={1000} />
                {dlg.type === 'refund' && <p className='text-xs text-red-700 mt-1.5'>Không thể hoàn tác: sự kiện và mọi suất diễn bị huỷ, mọi đơn đã thanh toán chuyển sang hoàn tiền, khách nhận email. Tiền do Admin chuyển khoản thủ công.</p>}
              </div>
            )}

            {dlg.type === 'seatmap' && (
              <div className='space-y-3'>
                <p className='text-xs text-[#52525b]'>
                  Tải 2 file nhà tổ chức gửi: <code>zone_map.svg</code> và <code>seating_manifest.xlsx</code>. Mẫu:{' '}
                  <a className='underline' href={`${BASE}/admin/seatmap/template.svg`}>SVG</a>, <a className='underline' href={`${BASE}/admin/seatmap/template.xlsx`}>Excel</a>. Hạng vé trong Excel phải khớp tên hạng vé của sự kiện.
                </p>
                {[['svg', 'File SVG', '.svg,image/svg+xml'], ['xlsx', 'File Excel', '.xlsx']].map(([k, t, acc]) => (
                  <div key={k}>
                    <label htmlFor={`sm-${k}`} className={label}>{t}</label>
                    <input id={`sm-${k}`} type='file' accept={acc} className='text-sm' onChange={(e) => setFiles({ ...files, [k]: e.target.files?.[0] || null })} />
                  </div>
                ))}
                {seatResult && (
                  <div className={`text-xs rounded-lg px-3 py-2 border ${seatResult.ok ? 'bg-[#f4f4f6] border-[#e4e4e7]' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <div className='font-semibold'>{seatResult.message}</div>
                    {seatResult.details && <pre className='mt-1 whitespace-pre-wrap break-words'>{JSON.stringify(seatResult.details, null, 1).slice(0, 800)}</pre>}
                    {seatResult.summary && <pre className='mt-1 whitespace-pre-wrap break-words'>{JSON.stringify(seatResult.summary, null, 1).slice(0, 600)}</pre>}
                  </div>
                )}
              </div>
            )}

            <div className='flex flex-wrap gap-3 pt-1'>
              {dlg.type === 'seatmap' ? (
                <>
                  <button type='button' className='tb-btn tb-btn-outline' disabled={busy === 'seat'} onClick={() => submitSeatmap(true)}>Kiểm tra trước</button>
                  <button type='button' className='tb-btn tb-btn-solid' disabled={busy === 'seat'} onClick={() => submitSeatmap(false)}>{busy === 'seat' ? 'Đang xử lý...' : 'Dựng sơ đồ'}</button>
                </>
              ) : (
                <button
                  type='button'
                  className='tb-btn tb-btn-solid'
                  disabled={Boolean(busy)}
                  onClick={{ approve, reject, refund, commission }[dlg.type]}>
                  {busy ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              )}
              <button type='button' className='tb-btn tb-btn-outline' onClick={close}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
