import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Vẽ QR ngay trên trình duyệt (không gửi mã vé / chữ ký ra dịch vụ bên ngoài). value = "<ticketCode>.<qrHash>" */
export default function TicketQr({ value, size = 220, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return src ? (
    <img src={src} alt='Mã QR của vé' width={size} height={size} className={className} />
  ) : (
    <div style={{ width: size, height: size }} className={`bg-[#f4f4f6] rounded-lg ${className}`} />
  );
}
