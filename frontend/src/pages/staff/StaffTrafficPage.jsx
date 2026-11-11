/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  RotateCw,
  Search,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function StaffTrafficPage() {
  const [eventId, setEventId] = useState('');
  const [myEvents, setMyEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const { showToast } = useToast();
  const timerRef = useRef(null);

  // Load available events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get('/events/my-event');
        const evs = res.events || res.data || [];
        setMyEvents(evs);
        if (evs.length > 0 && !eventId) {
          setEventId(evs[0]._id || evs[0].id);
        }
      } catch {
        // Fallback: user can manually enter ID
      }
    };
    fetchEvents();
  }, []);

  const fetchStats = async (targetId = eventId) => {
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await api.get(`/booking/staff/events/${targetId}/check-in-stats`);
      setStats(res.stats || null);
      setLastRefreshedAt(new Date());
    } catch (err) {
      showToast(err.message || 'Không thể tải thống kê soát vé');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 6 seconds
  useEffect(() => {
    if (!eventId) return;
    fetchStats(eventId);

    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchStats(eventId);
      }, 6000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [eventId, autoRefresh]);

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      {/* Page Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Giám Sát Lưu Lượng Check-In</h1>
          <p className='text-sm text-[#71717a] mt-1'>
            Theo dõi tốc độ qua cổng, tỷ lệ lấp đầy khán phòng theo thời gian thực (Real-time).
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-[#09090b] text-white border-transparent shadow-xs'
                : 'bg-white border-[#e4e4e7] text-[#71717a] hover:text-[#09090b]'
            }`}>
            {autoRefresh ? '● Đang tự động cập nhật (6s)' : 'Tự cập nhật: Tắt'}
          </button>

          <button
            type='button'
            onClick={() => fetchStats(eventId)}
            disabled={loading}
            className='p-2 bg-white border border-[#e4e4e7] rounded-full text-[#09090b] hover:bg-[#f4f4f6] transition-colors'
            title='Làm mới ngay'>
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Event Selector / Input */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between'>
        <div className='flex items-center gap-2 text-xs font-bold text-[#09090b]'>
          <BarChart3 size={16} />
          <span>Sự kiện theo dõi:</span>
        </div>

        <div className='flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md'>
          {myEvents.length > 0 ? (
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className='w-full px-3 py-2 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs font-semibold outline-none focus:border-[#09090b]'>
              {myEvents.map((ev) => (
                <option key={ev._id || ev.id} value={ev._id || ev.id}>
                  {ev.title || ev.name}
                </option>
              ))}
            </select>
          ) : (
            <div className='flex gap-2 w-full'>
              <input
                type='text'
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder='Nhập mã ID sự kiện (VD: 66a...)'
                className='flex-1 px-3 py-2 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs font-mono outline-none focus:border-[#09090b]'
              />
              <button
                type='button'
                onClick={() => fetchStats(eventId)}
                className='px-4 py-2 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a]'>
                Xem
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Stats Display */}
      {loading && !stats ? (
        <div className='py-20 text-center text-sm text-[#71717a]'>Đang kết nối luồng số liệu soát vé...</div>
      ) : !stats ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>
          Vui lòng chọn hoặc nhập mã sự kiện để xem thông số check-in trực tuyến.
        </div>
      ) : (
        <div className='space-y-6'>
          {/* Progress Bar Header */}
          <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 space-y-4'>
            <div className='flex flex-col sm:flex-row sm:items-baseline justify-between gap-2'>
              <div>
                <span className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Tiến độ vào cổng</span>
                <div className='text-3xl font-extrabold text-[#09090b] mt-1'>
                  {stats.checkInRatePct}%{' '}
                  <span className='text-base font-medium text-[#71717a]'>
                    ({stats.checkedInCount} / {stats.totalTickets} vé)
                  </span>
                </div>
              </div>
              <div className='text-xs text-[#71717a]'>
                Cập nhật lần cuối: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString('vi-VN') : '—'}
              </div>
            </div>

            {/* Gauge Bar */}
            <div className='w-full h-4 bg-[#f4f4f6] rounded-full overflow-hidden p-0.5 border border-[#e4e4e7]'>
              <div
                className='h-full bg-[#09090b] rounded-full transition-all duration-700 ease-out'
                style={{ width: `${Math.min(100, stats.checkInRatePct)}%` }}
              />
            </div>

            {/* 3 Metric Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#f4f4f6]'>
              <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl'>
                <div className='text-xs text-[#71717a] uppercase font-semibold'>Đã vào cổng</div>
                <div className='text-2xl font-extrabold text-[#09090b] mt-1'>{stats.checkedInCount}</div>
                <div className='text-[11px] text-[#71717a] mt-1'>Khán giả đã qua cửa</div>
              </div>

              <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl'>
                <div className='text-xs text-[#71717a] uppercase font-semibold'>Chưa vào cổng</div>
                <div className='text-2xl font-extrabold text-[#09090b] mt-1'>{stats.remainingCount}</div>
                <div className='text-[11px] text-[#71717a] mt-1'>Vé chưa quét mã</div>
              </div>

              <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl'>
                <div className='text-xs text-[#71717a] uppercase font-semibold'>Tổng vé mở bán</div>
                <div className='text-2xl font-extrabold text-[#09090b] mt-1'>{stats.totalTickets}</div>
                <div className='text-[11px] text-[#71717a] mt-1'>Quy mô khán phòng</div>
              </div>
            </div>
          </div>

          {/* Tier Breakdown Table */}
          {stats.tierBreakdown && stats.tierBreakdown.length > 0 && (
            <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-4'>
              <h3 className='text-sm font-bold text-[#09090b] uppercase tracking-wider'>
                Chi tiết lưu lượng theo từng hạng vé
              </h3>

              <div className='overflow-x-auto'>
                <table className='w-full text-xs text-left'>
                  <thead>
                    <tr className='border-b border-[#e4e4e7] text-[#71717a] uppercase text-[11px]'>
                      <th className='py-2.5 px-3'>Hạng vé</th>
                      <th className='py-2.5 px-3 text-right'>Đã vào</th>
                      <th className='py-2.5 px-3 text-right'>Còn lại</th>
                      <th className='py-2.5 px-3 text-right'>Tổng</th>
                      <th className='py-2.5 px-3 text-right'>Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-[#f4f4f6]'>
                    {stats.tierBreakdown.map((t) => {
                      const rate = t.totalTickets > 0 ? Math.round((t.checkedIn / t.totalTickets) * 100) : 0;
                      return (
                        <tr key={t.tierId || t.tierName}>
                          <td className='py-3 px-3 font-bold text-[#09090b]'>{t.tierName}</td>
                          <td className='py-3 px-3 text-right font-semibold text-[#09090b]'>{t.checkedIn}</td>
                          <td className='py-3 px-3 text-right text-[#71717a]'>{t.remaining}</td>
                          <td className='py-3 px-3 text-right font-bold text-[#09090b]'>{t.totalTickets}</td>
                          <td className='py-3 px-3 text-right font-bold text-[#09090b]'>{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Check-Ins Feed */}
          {stats.recentCheckIns && stats.recentCheckIns.length > 0 && (
            <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-3'>
              <h3 className='text-sm font-bold text-[#09090b] uppercase tracking-wider'>
                Dòng sự kiện check-in trực tiếp (10 lượt gần nhất)
              </h3>
              <div className='divide-y divide-[#f4f4f6] text-xs'>
                {stats.recentCheckIns.map((ci, idx) => (
                  <div key={idx} className='py-2.5 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='w-2 h-2 rounded-full bg-[#09090b]' />
                      <span className='font-mono font-bold text-[#09090b]'>#{ci.ticketCode}</span>
                      <span className='text-[#52525b]'>• {ci.tierName}</span>
                    </div>
                    <div className='text-[11px] text-[#71717a]'>
                      {ci.checkedInAt && new Date(ci.checkedInAt).toLocaleTimeString('vi-VN')}{' '}
                      {ci.checkedInBy ? `(${ci.checkedInBy})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
