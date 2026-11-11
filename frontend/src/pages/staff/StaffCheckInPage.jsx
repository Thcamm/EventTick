import { useState } from 'react';
import { QrCode, Search, CheckCircle2, XCircle, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function StaffCheckInPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [checkedCount, setCheckedCount] = useState(142);
  const { showToast } = useToast();

  const handleCheckIn = (e) => {
    e.preventDefault();
    if (!ticketCode.trim()) return;

    setChecking(true);
    setTimeout(() => {
      // Demo logic for checking ticket code
      const isOk = !ticketCode.toUpperCase().includes('FAIL');
      const scanResult = {
        code: ticketCode.trim().toUpperCase(),
        time: new Date().toLocaleTimeString('vi-VN'),
        status: isOk ? 'VALID' : 'INVALID',
        holder: isOk ? 'Nguyễn Văn A' : 'Không xác định',
        seat: isOk ? 'Ghế A-04 (VIP Diamond)' : '—',
        eventName: '[CONCERT] ANH TRAI VƯỢT NGÀN CHÔNG GAI 2026',
      };

      setLastScan(scanResult);
      if (isOk) {
        setCheckedCount((c) => c + 1);
        showToast(`Check-in thành công: ${scanResult.code}`);
      } else {
        showToast('Mã vé không hợp lệ hoặc đã qua cửa!');
      }
      setTicketCode('');
      setChecking(false);
    }, 400);
  };

  return (
    <div className='max-w-2xl mx-auto space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Cổng Soát Vé Trực Tuyến</h1>
        <p className='text-sm text-[#71717a] mt-1'>
          Quét mã QR hoặc nhập thủ công mã vé điện tử của khán giả để qua cổng soát vé.
        </p>
      </div>

      {/* Counter bar */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-[#09090b] text-white flex items-center justify-center'>
            <Users size={18} />
          </div>
          <div>
            <div className='text-xs font-semibold text-[#71717a] uppercase'>Đã vào cổng hôm nay</div>
            <div className='text-2xl font-bold text-[#09090b]'>{checkedCount} lượt</div>
          </div>
        </div>
        <div className='text-xs text-[#71717a] text-right'>
          <div>Cửa kiểm soát: <strong>Gate 02 (VIP & CAT-1)</strong></div>
          <div className='text-green-600 font-semibold mt-0.5'>Trạng thái: Sẵn sàng kết nối scanner</div>
        </div>
      </div>

      {/* Manual & QR input form */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <form onSubmit={handleCheckIn} className='space-y-4'>
          <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b]'>
            Nhập mã vé hoặc quét qua thiết bị Scanner
          </label>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3.5 top-3.5 text-[#71717a]' size={18} />
              <input
                type='text'
                autoFocus
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                placeholder='Nhập mã vé (VD: TCKT-8823-99)...'
                className='w-full pl-10 pr-4 py-3 bg-[#f4f4f6] rounded-xl text-sm font-mono text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
              />
            </div>
            <button
              type='submit'
              disabled={checking || !ticketCode.trim()}
              className='px-5 py-3 bg-[#09090b] text-white text-sm font-semibold rounded-xl hover:bg-[#27272a] disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0'>
              <QrCode size={18} />
              <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra vé'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Last Scan Result Display */}
      {lastScan && (
        <div
          className={`border rounded-2xl p-6 transition-all ${
            lastScan.status === 'VALID'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
          <div className='flex items-center gap-3 mb-4'>
            {lastScan.status === 'VALID' ? (
              <CheckCircle2 size={24} className='text-green-600 shrink-0' />
            ) : (
              <XCircle size={24} className='text-red-600 shrink-0' />
            )}
            <div>
              <h3 className='text-lg font-bold leading-tight'>
                {lastScan.status === 'VALID' ? 'VÉ HỢP LỆ — MỜI VÀO CỔNG' : 'VÉ KHÔNG HỢP LỆ HOẶC ĐÃ CHECK-IN'}
              </h3>
              <p className='text-xs opacity-80'>Thời gian quét: {lastScan.time}</p>
            </div>
          </div>

          <div className='text-xs space-y-1.5 pt-3 border-t border-current/15'>
            <div>Mã vé: <strong className='font-mono'>{lastScan.code}</strong></div>
            <div>Khán giả: <strong>{lastScan.holder}</strong></div>
            <div>Vị trí: <strong>{lastScan.seat}</strong></div>
            <div>Sự kiện: <strong>{lastScan.eventName}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
