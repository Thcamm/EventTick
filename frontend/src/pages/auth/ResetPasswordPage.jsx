import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
        <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 text-center shadow-sm'>
          <h2 className='text-xl font-bold text-[#09090b] mb-2'>Liên kết không hợp lệ</h2>
          <p className='text-sm text-[#71717a] mb-6'>
            Thiếu mã xác thực đặt lại mật khẩu. Vui lòng yêu cầu lại liên kết mới.
          </p>
          <Link
            to={PATHS.FORGOT_PASSWORD}
            className='inline-block w-full py-2.5 bg-[#09090b] text-white text-sm font-medium rounded-lg hover:bg-[#27272a] transition-colors'>
            Gửi lại yêu cầu
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword: form.newPassword });
      showToast('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
      navigate(PATHS.LOGIN, { replace: true });
    } catch (err) {
      setError(err.message || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-bold text-[#09090b] tracking-tight'>Đặt lại mật khẩu</h1>
          <p className='text-sm text-[#71717a] mt-1'>Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Mật khẩu mới
            </label>
            <input
              type='password'
              required
              minLength={6}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder='••••••••'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Xác nhận mật khẩu mới
            </label>
            <input
              type='password'
              required
              minLength={6}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder='••••••••'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-2.5 mt-2 bg-[#09090b] text-white font-medium text-sm rounded-lg hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
