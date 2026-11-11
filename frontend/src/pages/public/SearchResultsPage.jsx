import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Search, SlidersHorizontal, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { eventsService, toCard } from '../../services/events.service';
import { inputCls } from '../../components/FormField';

const LIMIT = 12;
const SORTS = [
  { v: 'newest', label: 'Mới nhất' },
  { v: 'date_asc', label: 'Sắp diễn ra' },
  { v: 'price_asc', label: 'Giá thấp đến cao' },
  { v: 'price_desc', label: 'Giá cao đến thấp' },
];

/** /search?q=&category=&city=&sort=&minPrice=&maxPrice=&page= — kết quả lấy từ GET /v1/events/search. */
export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const city = params.get('city') || '';
  const sort = params.get('sort') || 'newest';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const page = Math.max(1, parseInt(params.get('page'), 10) || 1);

  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState({ events: [], total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState(q);
  const [price, setPrice] = useState({ min: minPrice, max: maxPrice });

  useEffect(() => {
    eventsService
      .categories()
      .then((r) => setCategories(r.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => setText(q), [q]);
  useEffect(() => setPrice({ min: minPrice, max: maxPrice }), [minPrice, maxPrice]);

  const byId = useMemo(() => Object.fromEntries(categories.map((c) => [c._id || c.id, c.slug])), [categories]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    eventsService
      .search({ q, category, city, sort, minPrice, maxPrice, page, limit: LIMIT })
      .then((r) => alive && setResult({ events: r.events || [], total: r.total || 0, totalPages: r.totalPages || 0 }))
      .catch((e) => alive && setError(e.message || 'Không tải được kết quả tìm kiếm'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, category, city, sort, minPrice, maxPrice, page]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '1', ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };
  const goPage = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clearAll = () => setParams(new URLSearchParams());
  const hasFilter = q || category || city || minPrice || maxPrice || sort !== 'newest';

  const cards = result.events.map((e) => toCard(e, byId));

  return (
    <div className='tb-container py-8'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim() });
        }}
        className='flex gap-3 mb-6'>
        <div className='relative flex-1'>
          <Search size={17} className='absolute left-4 top-3 text-[#71717a]' />
          <input
            className='w-full pl-11 pr-4 py-2.5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-full text-sm outline-none focus:bg-white focus:border-[#09090b]'
            placeholder='Tìm theo tên sự kiện, thành phố, địa điểm...'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button type='submit' className='tb-btn tb-btn-solid'>
          Tìm kiếm
        </button>
      </form>

      <div className='grid gap-6 lg:grid-cols-[260px_1fr]'>
        <aside className='bg-white border border-[#e4e4e7] rounded-2xl p-5 h-fit space-y-5'>
          <div className='flex items-center justify-between'>
            <h2 className='font-bold flex items-center gap-2'>
              <SlidersHorizontal size={16} /> Bộ lọc
            </h2>
            {hasFilter && (
              <button type='button' onClick={clearAll} className='text-xs underline text-[#71717a] hover:text-[#09090b]'>
                Xóa lọc
              </button>
            )}
          </div>

          <div>
            <label htmlFor='s-cat' className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Danh mục
            </label>
            <select id='s-cat' className={inputCls} value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value=''>Tất cả</option>
              {categories.map((c) => (
                <option key={c._id || c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor='s-city' className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Thành phố
            </label>
            <select id='s-city' className={inputCls} value={city} onChange={(e) => update({ city: e.target.value })}>
              <option value=''>Toàn quốc</option>
              {['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className='text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Khoảng giá (₫)</div>
            <div className='flex items-center gap-2'>
              <input type='number' min='0' className={inputCls} placeholder='Từ' value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} />
              <input type='number' min='0' className={inputCls} placeholder='Đến' value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value })} />
            </div>
            <button type='button' className='tb-btn tb-btn-outline tb-btn-sm w-full mt-2' onClick={() => update({ minPrice: price.min, maxPrice: price.max })}>
              Áp dụng giá
            </button>
          </div>
        </aside>

        <section>
          <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
            <p className='text-sm text-[#52525b]'>
              {loading ? 'Đang tìm...' : `${result.total} sự kiện`}
              {q && (
                <>
                  {' '}
                  cho &quot;<strong>{q}</strong>&quot;
                </>
              )}
            </p>
            <select aria-label='Sắp xếp' className={`${inputCls} !w-auto`} value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {error && <div className='p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>}

          {loading ? (
            <div className='py-16 text-[#71717a] flex items-center justify-center gap-2'>
              <Loader2 size={16} className='animate-spin' /> Đang tải...
            </div>
          ) : cards.length === 0 && !error ? (
            <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center space-y-3'>
              <p className='font-bold'>Không tìm thấy sự kiện phù hợp</p>
              <p className='text-sm text-[#71717a]'>Thử đổi từ khóa hoặc bỏ bớt bộ lọc.</p>
              {hasFilter && (
                <button type='button' onClick={clearAll} className='tb-btn tb-btn-outline'>
                  Xóa tất cả bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className='events-grid'>
              {cards.map((ev) => (
                <Link key={ev.id} to={`/events/${ev.id}`} className='event-card'>
                  <div className='card-thumb-wrap'>
                    <img
                      src={ev.image}
                      alt={ev.name}
                      className='card-thumb'
                      loading='lazy'
                      onError={(e) => {
                        e.currentTarget.src = '/assets/banners/hero_0.jpg';
                      }}
                    />
                  </div>
                  <div className='card-body'>
                    <div className='card-date-row'>
                      <Calendar size={13} />
                      <span>{ev.date}</span>
                    </div>
                    <h3 className='card-title'>{ev.name}</h3>
                    <div className='card-footer-row'>
                      <div className='card-price-group'>
                        <span className='card-price-label'>Giá từ</span>
                        <span className='card-price-val'>{ev.price}</span>
                      </div>
                      <div className='card-city'>
                        <MapPin size={12} />
                        <span>{ev.city}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {result.totalPages > 1 && (
            <div className='flex items-center justify-center gap-3 mt-8'>
              <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label='Trang trước'>
                <ChevronLeft size={15} />
              </button>
              <span className='text-sm'>
                Trang <strong>{page}</strong> / {result.totalPages}
              </span>
              <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={page >= result.totalPages} onClick={() => goPage(page + 1)} aria-label='Trang sau'>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
