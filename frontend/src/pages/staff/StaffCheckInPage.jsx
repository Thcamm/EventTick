/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  Users,
  ShieldCheck,
  Building2,
  BarChart3,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function StaffCheckInPage() {
  const [ticketInput, setTicketInput] = useState('');
  const [selectedGate, setSelectedGate] = useState('GATE_01');
  const [checking, setChecking] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const inputRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const { showToast } = useToast();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Web Audio feedback without external audio files
  const playBeep = (isSuccess) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // Audio context not allowed before user gesture
    }
  };

  const handleCheckIn = async (e) => {
    if (e) e.preventDefault();
    const raw = ticketInput.trim();
    if (!raw) return;

    // Scan lock: prevent duplicate trigger within 1.2s
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1200) {
      return;
    }
    lastScanTimeRef.current = now;

    // Parse potential QR format "CODE.HASH" or raw code
    let code = raw;
    let qrHash = '';
    if (raw.includes('.')) {
      const parts = raw.split('.');
      code = parts[0];
      qrHash = parts[1] || '';
    }

    try {
      setChecking(true);
      const res = await api.post('/booking/check-in', {
        ticketCode: code,
        qrHash: qrHash || undefined,
        gate: selectedGate,
      });

      const scanResult = {
        code: res.ticket?.ticketCode || code,
        eventName: res.ticket?.eventName || 'Sự kiện EventTick',
        zoneName: res.ticket?.zoneName || 'Khu vực khán giả',
        time: new Date().toLocaleTimeString('vi-VN'),
        status: 'VALID',
        message: res.message || 'Check-in thành công!',
      };

      setLastScan(scanResult);
      setRecentScans((prev) => [scanResult, ...prev.slice(0, 9)]);
      playBeep(true);
      showToast(`Hợp lệ: ${scanResult.code}`);
    } catch (err) {
      const scanResult = {
        code: code,
        eventName: '—',
        zoneName: '—',
        time: new Date().toLocaleTimeString('vi-VN'),
        status: 'INVALID',
        message: err.message || 'Mã vé không hợp lệ hoặc đã qua cửa!',
      };

      setLastScan(scanResult);
      setRecentScans((prev) => [scanResult, ...prev.slice(0, 9)]);
      playBeep(false);
      showToast(scanResult.message);
    } finally {
      setChecking(false);
      setTicketInput('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className='max-w-3xl mx-auto space-y-6'>
      {/* Top Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Cổng Soát Vé Trực Tuyến</h1>
          <p className='text-sm text-[#71717a] mt-1'>
            Quét mã QR hoặc mã vạch bằng thiết bị scanner cầm tay hoặc camera.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setSoundEnabled((v) => !v)}
            className='p-2 border border-[#e4e4e7] rounded-full text-[#71717a] hover:text-[#09090b] transition-colors'
            title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <Link
            to={PATHS.STAFF_STATS}
            className='inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e4e4e7] text-[#09090b] text-xs font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
            <BarChart3 size={15} />
            <span>Xem lưu lượng cổng</span>
          </Link>
        </div>
      </div>

      {/* Gate Selector Bar */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Building2 size={16} className='text-[#09090b]' />
          <span className='text-xs font-bold text-[#09090b]'>Cửa kiểm soát hiện tại:</span>
        </div>
        <div className='flex items-center gap-1.5 bg-[#f4f4f6] p-1 rounded-full text-xs font-semibold overflow-x-auto max-w-full scrollbar-none'>
          {[
            { id: 'GATE_01', name: 'Cổng 01 (Chính)' },
            { id: 'GATE_02', name: 'Cổng 02 (VIP)' },
            { id: 'GATE_03', name: 'Cổng 03 (Khán đài)' },
          ].map((gate) => (
            <button
              key={gate.id}
              type='button'
              onClick={() => {
                setSelectedGate(gate.id);
                inputRef.current?.focus();
              }}
              className={`px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
                selectedGate === gate.id
                  ? 'bg-[#09090b] text-white shadow-xs font-bold'
                  : 'text-[#71717a] hover:text-[#09090b]'
              }`}>
              {gate.name}
            </button>
          ))}
        </div>
      </div>

      {/* Input Scanner Form */}
      <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs'>
        <form onSubmit={handleCheckIn} className='space-y-3'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-bold uppercase tracking-wider text-[#09090b] flex items-center gap-1.5'>
              <QrCode size={15} />
              <span>Sẵn sàng nhận tín hiệu quét mã</span>
            </label>
            <span className='text-[11px] text-green-600 font-semibold flex items-center gap-1'>
              <span className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
              <span>Scanner kết nối</span>
            </span>
          </div>

          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3.5 top-3.5 text-[#71717a]' size={18} />
              <input
                ref={inputRef}
                type='text'
                autoFocus
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder='Nhập mã vé hoặc đưa mã QR trước máy quét...'
                className='w-full pl-10 pr-4 py-3 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-sm font-mono text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
              />
            </div>
            <button
              type='submit'
              disabled={checking || !ticketInput.trim()}
              className='px-6 py-3 bg-[#09090b] text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-40 transition-colors flex items-center gap-2 shrink-0'>
              <ShieldCheck size={18} />
              <span>{checking ? 'Đang duyệt...' : 'Check-in'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Result Card */}
      {lastScan && (
        <div
          className={`border-2 rounded-3xl p-6 transition-all ${
            lastScan.status === 'VALID'
              ? 'bg-green-50/70 border-green-500 text-green-950'
              : 'bg-red-50/70 border-red-500 text-red-950'
          }`}>
          <div className='flex items-start gap-4'>
            {lastScan.status === 'VALID' ? (
              <CheckCircle2 size={32} className='text-green-600 shrink-0 mt-0.5' />
            ) : (
              <XCircle size={32} className='text-red-600 shrink-0 mt-0.5' />
            )}
            <div className='space-y-1.5 flex-1'>
              <div className='text-xs font-bold uppercase tracking-wider opacity-80'>
                {lastScan.time} • Cửa: {selectedGate}
              </div>
              <h2 className='text-xl font-extrabold leading-tight'>
                {lastScan.status === 'VALID' ? 'VÉ HỢP LỆ — MỜI KHÁCH VÀO CỔNG' : 'TỪ CHỐI VÀO CỔNG!'}
              </h2>
              <p className='text-sm font-medium'>{lastScan.message}</p>

              {lastScan.status === 'VALID' && (
                <div className='mt-3 pt-3 border-t border-green-200/80 grid grid-cols-2 gap-2 text-xs'>
                  <div>
                    Mã vé: <strong className='font-mono font-bold'>{lastScan.code}</strong>
                  </div>
                  <div>
                    Hạng vé: <strong>{lastScan.zoneName}</strong>
                  </div>
                  <div className='col-span-2'>
                    Sự kiện: <strong>{lastScan.eventName}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Scans Table */}
      {recentScans.length > 0 && (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5 space-y-3'>
          <h3 className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>
            Lịch sử quét gần đây (10 lượt)
          </h3>
          <div className='divide-y divide-[#f4f4f6] text-xs'>
            {recentScans.map((scan, i) => (
              <div key={i} className='py-2.5 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      scan.status === 'VALID' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className='font-mono font-bold text-[#09090b]'>#{scan.code}</span>
                  <span className='text-[#71717a]'>• {scan.zoneName}</span>
                </div>
                <div className='text-[11px] text-[#71717a]'>{scan.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
