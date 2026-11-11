import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
const EMPTY = { name: '', slug: '', defaultCommissionPct: '10', isActive: true };

/** UC40, UC41: quản lý danh mục sự kiện và mức hoa hồng mặc định theo danh mục. */
export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/categories');
      setItems(r.categories || []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh mục');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(EMPTY);
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({ name: c.name, slug: c.slug, defaultCommissionPct: String(c.default_commission_pct ?? 10), isActive: c.is_active !== false });
    setEditing(c);
  };

  const save = async (e) => {
    e.preventDefault();
    const rate = Number(form.defaultCommissionPct);
    if (!form.name.trim()) return showToast('Nhập tên danh mục');
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return showToast('Hoa hồng mặc định phải từ 0 đến 50 (%)');
    const body = { name: form.name.trim(), defaultCommissionPct: rate, isActive: form.isActive, ...(form.slug.trim() ? { slug: form.slug.trim() } : {}) };
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/admin/categories', body);
      else await api.put(`/admin/categories/${editing._id}`, body);
      showToast('Đã lưu danh mục');
      setEditing(null);
      load();
    } catch (err) {
      showToast(err.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Xoá danh mục "${c.name}"?`)) return;
    try {
      await api.delete(`/admin/categories/${c._id}`);
      showToast('Đã xoá danh mục');
      load();
    } catch (err) {
      showToast(err.message || 'Không xoá được');
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Danh mục sự kiện</h1>
          <p className='text-sm text-[#71717a] mt-1'>Hoa hồng mặc định được dùng khi Admin duyệt sự kiện mà không nhập mức riêng.</p>
        </div>
        <button type='button' className='tb-btn tb-btn-solid' onClick={openNew}>
          <Plus size={15} /> Thêm danh mục
        </button>
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Tên</th>
                <th>Slug</th>
                <th>Hoa hồng mặc định</th>
                <th>Trạng thái</th>
                <th className='text-right pr-4'>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id} className='border-b border-[#f4f4f6] last:border-0'>
                  <td className='p-4 font-semibold'>{c.name}</td>
                  <td className='font-mono text-xs text-[#52525b]'>{c.slug}</td>
                  <td>{c.default_commission_pct ?? 10}%</td>
                  <td>{c.is_active === false ? 'Đã ẩn' : 'Đang dùng'}</td>
                  <td className='text-right pr-4 space-x-2'>
                    <button type='button' aria-label='Sửa' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openEdit(c)}>
                      <Pencil size={13} />
                    </button>
                    <button type='button' aria-label='Xoá' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => remove(c)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setEditing(null)}>
          <form onSubmit={save} className='bg-white rounded-2xl w-full max-w-md p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <h3 className='font-bold'>{editing === 'new' ? 'Thêm danh mục' : 'Sửa danh mục'}</h3>
            <div>
              <label htmlFor='c-name' className={label}>Tên</label>
              <input id='c-name' className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
            </div>
            <div>
              <label htmlFor='c-slug' className={label}>Slug (để trống sẽ tự tạo từ tên)</label>
              <input id='c-slug' className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={100} />
            </div>
            <div>
              <label htmlFor='c-rate' className={label}>Hoa hồng mặc định (%)</label>
              <input id='c-rate' type='number' min='0' max='50' step='0.5' className={inputCls} value={form.defaultCommissionPct} onChange={(e) => setForm({ ...form, defaultCommissionPct: e.target.value })} />
            </div>
            <label className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='checkbox' className='w-4 h-4 accent-[#09090b]' checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang sử dụng
            </label>
            <div className='flex gap-3'>
              <button type='submit' disabled={saving} className='tb-btn tb-btn-solid'>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button type='button' className='tb-btn tb-btn-outline' onClick={() => setEditing(null)}>
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
