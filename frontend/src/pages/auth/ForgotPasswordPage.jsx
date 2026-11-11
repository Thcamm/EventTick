import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
      showToast('Đã gửi liên kết khôi phục mật khẩu');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
        <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 text-center shadow-sm'>
          <h2 className='text-xl font-bold text-[#09090b] mb-2'>Kiểm tra email của bạn</h2>
          <p className='text-sm text-[#71717a] mb-6'>
            Nếu email <strong className='text-[#09090b]'>{email}</strong> tồn tại trong hệ thống, chúng tôi đã gửi liên
            kết đặt lại mật khẩu có hiệu lực trong 15 phút.
          </p>
          <Link
            to={PATHS.LOGIN}
            className='inline-block w-full py-2.5 bg-[#09090b] text-white text-sm font-medium rounded-lg hover:bg-[#27272a] transition-colors'>
            Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-bold text-[#09090b] tracking-tight'>Quên mật khẩu?</h1>
          <p className='text-sm text-[#71717a] mt-1'>Nhập email của bạn để nhận liên kết đặt lại mật khẩu</p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Địa chỉ email
            </label>
            <input
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='user@example.com'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-2.5 mt-2 bg-[#09090b] text-white font-medium text-sm rounded-lg hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
            {loading ? 'Đang gửi yêu cầu...' : 'Gửi liên kết khôi phục'}
          </button>
        </form>

        <div className='mt-6 pt-6 border-t border-[#f4f4f6] text-center text-xs text-[#71717a]'>
          Nhớ mật khẩu?{' '}
          <Link to={PATHS.LOGIN} className='font-semibold text-[#09090b] hover:underline'>
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
