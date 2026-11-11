import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/auth.service';
import { PATHS, getRoleHomePath } from '../../routes/paths';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const { login, unverifiedEmail, setUnverifiedEmail } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form.username, form.password);
      showToast('Đăng nhập thành công');
      navigate(getRoleHomePath(res.user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Tài khoản hoặc mật khẩu không chính xác');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      await authService.resendVerification(unverifiedEmail);
      showToast('Email kích hoạt đã được gửi lại. Vui lòng kiểm tra hộp thư.');
    } catch (err) {
      showToast(err.message || 'Không thể gửi lại email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-bold text-[#09090b] tracking-tight'>Đăng nhập</h1>
          <p className='text-sm text-[#71717a] mt-1'>Chào mừng bạn quay trở lại với EventTick</p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>
        )}

        {unverifiedEmail && (
          <div className='mb-4 p-3.5 bg-[#f9f9fb] border border-[#e4e4e7] text-[#09090b] text-xs rounded-xl flex flex-col gap-2'>
            <span>Tài khoản {unverifiedEmail} chưa kích hoạt email.</span>
            <button
              type='button'
              onClick={handleResendVerification}
              disabled={resending}
              className='text-xs font-semibold text-left underline disabled:opacity-60 hover:text-black'>
              {resending ? 'Đang gửi...' : 'Gửi lại link kích hoạt email'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Username hoặc Email
            </label>
            <input
              type='text'
              required
              value={form.username}
              onChange={(e) => {
                setForm({ ...form, username: e.target.value });
                if (unverifiedEmail) setUnverifiedEmail(null);
              }}
              placeholder='user@example.com'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <div>
            <div className='flex items-center justify-between mb-1.5'>
              <label className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>Mật khẩu</label>
              <Link to={PATHS.FORGOT_PASSWORD} className='text-xs text-[#71717a] hover:text-[#09090b] underline'>
                Quên mật khẩu?
              </Link>
            </div>
            <input
              type='password'
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder='••••••••'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-2.5 mt-2 bg-[#09090b] text-white font-semibold text-sm rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <div className='mt-6 pt-6 border-t border-[#f4f4f6] text-center text-xs text-[#71717a]'>
          Chưa có tài khoản?{' '}
          <Link to={PATHS.REGISTER} className='font-semibold text-[#09090b] hover:underline'>
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
