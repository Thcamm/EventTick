/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { ShieldCheck, Users, CalendarDays, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: 'Tổng người dùng', value: '14,250', change: '+12% tháng này', icon: Users },
    { label: 'Sự kiện chờ duyệt', value: '8 sự kiện', change: 'Cần xử lý ngay', icon: CalendarDays, alert: true },
    { label: 'Yêu cầu KYC mới', value: '5 hồ sơ', change: '3 đối tác mới', icon: ShieldCheck, alert: true },
    { label: 'Doanh thu nền tảng (phí)', value: '128.500.000 ₫', change: '+18% so với tháng trước', icon: DollarSign },
  ];

  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Tổng quan hệ thống</h1>
        <p className='text-sm text-[#71717a] mt-1'>
          Xin chào, {user?.full_name || user?.username}. Dưới đây là hoạt động nền tảng hôm nay.
        </p>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
              <div className='flex items-center justify-between text-[#71717a] mb-3'>
                <span className='text-xs font-semibold uppercase tracking-wider'>{s.label}</span>
                <Icon size={18} className='text-[#09090b]' />
              </div>
              <div className='text-2xl font-bold text-[#09090b]'>{s.value}</div>
              <div className={`text-xs mt-2 ${s.alert ? 'text-[#09090b] font-semibold' : 'text-[#71717a]'}`}>
                {s.change}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Pending Events */}
      <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-base font-bold text-[#09090b] flex items-center gap-2'>
            <AlertCircle size={18} />
            <span>Sự kiện cần ban quản trị phê duyệt</span>
          </h2>
          <span className='text-xs text-[#71717a]'>8 sự kiện đang chờ</span>
        </div>

        <div className='divide-y divide-[#f4f4f6]'>
          {[
            {
              title: 'Live Concert: Những Kẻ Mộng Mơ 2026',
              organizer: 'Mây Saigon Media',
              submittedAt: 'Hôm nay 09:30',
              ticketsTotal: 2500,
              commission: '5%',
            },
            {
              title: 'Triển lãm Công nghệ AI Summit VN',
              organizer: 'TechVibe Corp',
              submittedAt: 'Hôm qua 16:15',
              ticketsTotal: 1200,
              commission: '6%',
            },
            {
              title: 'Workshop: Nghệ Thuật Nặn Gốm Bát Tràng',
              organizer: 'Gốm Xưa Studio',
              submittedAt: 'Hôm qua 11:00',
              ticketsTotal: 80,
              commission: '8%',
            },
          ].map((item, i) => (
            <div key={i} className='py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
              <div>
                <div className='font-semibold text-sm text-[#09090b]'>{item.title}</div>
                <div className='text-xs text-[#71717a] mt-0.5'>
                  Bởi <strong>{item.organizer}</strong> • Gửi lúc {item.submittedAt} • Quy mô: {item.ticketsTotal} vé
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  className='px-4 py-1.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
                  Phê duyệt
                </button>
                <button
                  type='button'
                  className='px-4 py-1.5 border border-[#e4e4e7] text-xs font-semibold rounded-full hover:bg-[#f4f4f6] text-[#52525b] transition-colors'>
                  Xem chi tiết
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
