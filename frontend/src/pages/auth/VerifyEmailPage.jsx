import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { PATHS } from '../../routes/paths';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Mã xác thực không hợp lệ hoặc thiếu thông tin.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Kích hoạt tài khoản thành công!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
      });
  }, [token]);

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 text-center shadow-sm'>
        {status === 'loading' && (
          <div className='flex flex-col items-center justify-center py-8'>
            <Loader2 className='w-10 h-10 animate-spin text-[#09090b] mb-4' />
            <h2 className='text-lg font-bold text-[#09090b]'>Đang xác thực email...</h2>
            <p className='text-xs text-[#71717a] mt-1'>Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {status === 'success' && (
          <div className='flex flex-col items-center justify-center'>
            <div className='w-12 h-12 bg-[#09090b] text-white rounded-full flex items-center justify-center mb-4 shadow-xs'>
              <CheckCircle2 className='w-7 h-7' />
            </div>
            <h2 className='text-xl font-bold text-[#09090b] mb-2'>Kích hoạt thành công</h2>
            <p className='text-sm text-[#71717a] mb-6'>{message}</p>
            <Link
              to={PATHS.LOGIN}
              className='w-full py-2.5 bg-[#09090b] text-white text-sm font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
              Đăng nhập ngay
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className='flex flex-col items-center justify-center'>
            <div className='w-12 h-12 bg-[#f4f4f6] text-[#09090b] border border-[#e4e4e7] rounded-full flex items-center justify-center mb-4'>
              <XCircle className='w-7 h-7' />
            </div>
            <h2 className='text-xl font-bold text-[#09090b] mb-2'>Xác thực thất bại</h2>
            <p className='text-sm text-[#71717a] mb-6'>{message}</p>
            <Link
              to={PATHS.LOGIN}
              className='w-full py-2.5 border border-[#e4e4e7] text-[#09090b] text-sm font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
