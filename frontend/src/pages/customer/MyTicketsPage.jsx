import { Ticket, QrCode, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';

export default function MyTicketsPage() {
  return (
    <div className='max-w-4xl mx-auto py-10 px-4 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Vé của tôi</h1>
        <p className='text-sm text-[#71717a] mt-1'>Quản lý vé điện tử và mã QR check-in sự kiện</p>
      </div>

      {/* Empty / Placeholder tickets list */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-10 text-center space-y-4'>
        <div className='w-12 h-12 rounded-full bg-[#f4f4f6] text-[#09090b] flex items-center justify-center mx-auto'>
          <Ticket size={24} />
        </div>
        <div>
          <h2 className='text-lg font-bold text-[#09090b]'>Bạn chưa có vé sự kiện nào</h2>
          <p className='text-sm text-[#71717a] max-w-md mx-auto mt-1'>
            Khám phá hàng trăm sự kiện âm nhạc, nghệ thuật, thể thao hấp dẫn trên EventTick và sở hữu vé chính thức ngay.
          </p>
        </div>
        <Link
          to={PATHS.HOME}
          className='inline-flex items-center gap-2 px-5 py-2.5 bg-[#09090b] text-white text-sm font-medium rounded-xl hover:bg-[#27272a] transition-colors'>
          <span>Khám phá sự kiện</span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
