import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getRoleHomePath } from '../../routes/paths';
import { GOOGLE_AUTH_URL } from '../../services/auth.service';

const ERRORS = {
  google_denied: 'Bạn đã huỷ đăng nhập Google.',
  invalid_state: 'Phiên đăng nhập không hợp lệ, vui lòng thử lại.',
  google_token_failed: 'Không lấy được thông tin từ Google, vui lòng thử lại.',
  google_profile_failed: 'Email Google chưa được xác thực.',
  google_not_configured: 'Máy chủ chưa cấu hình Google OAuth.',
  blocked: 'Tài khoản đã bị khóa.',
  server_error: 'Lỗi máy chủ, vui lòng thử lại.',
};

// Dùng chung cho /login và /register: Google tự tạo tài khoản nếu chưa có.
export default function LoginPage({ mode = 'login' }) {
  const [params] = useSearchParams();
  const [showDemo, setShowDemo] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [demoError, setDemoError] = useState('');
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const code = params.get('error');
  const error = demoError || (code ? ERRORS[code] || 'Đăng nhập thất bại.' : '');

  const handleDemo = async (e) => {
    e.preventDefault();
    setDemoError('');
    setLoading(true);
    try {
      const res = await login(form.username, form.password);
      showToast('Đăng nhập thành công');
      navigate(getRoleHomePath(res.user.role), { replace: true });
    } catch (err) {
      setDemoError(err.message || 'Sai tài khoản hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-bold text-[#09090b] tracking-tight'>{isRegister ? 'Đăng ký' : 'Đăng nhập'}</h1>
          <p className='text-sm text-[#71717a] mt-1'>
            {isRegister
              ? 'Tạo tài khoản EventTick nhanh chóng bằng Gmail'
              : 'Chào mừng bạn quay trở lại với EventTick'}
          </p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>
        )}

        <a
          href={GOOGLE_AUTH_URL}
          data-testid='google-login'
          className='w-full flex items-center justify-center gap-3 py-2.5 border border-[#d4d4d8] rounded-full text-sm font-semibold text-[#09090b] hover:bg-[#f4f4f6] transition-colors'>
          <svg width='18' height='18' viewBox='0 0 48 48' aria-hidden='true'>
            <path fill='#EA4335' d='M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z' />
            <path fill='#4285F4' d='M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z' />
            <path fill='#FBBC05' d='M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z' />
            <path fill='#34A853' d='M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z' />
          </svg>
          Tiếp tục với Google
        </a>
        <p className='text-xs text-[#71717a] text-center mt-3'>
          Chưa có tài khoản? Hệ thống tự tạo khi bạn đăng nhập bằng Gmail lần đầu.
        </p>

        {import.meta.env.DEV && (
          <div className='mt-6 pt-4 border-t border-[#f4f4f6]'>
            <button
              type='button'
              onClick={() => setShowDemo((v) => !v)}
              className='text-xs text-[#71717a] underline hover:text-[#09090b]'>
              {showDemo ? 'Ẩn' : 'Tài khoản demo (chỉ dùng khi phát triển)'}
            </button>
            {showDemo && (
              <form onSubmit={handleDemo} className='space-y-3 mt-3'>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder='demo_user'
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm outline-none'
                />
                <input
                  required
                  type='password'
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder='••••••'
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm outline-none'
                />
                <button
                  type='submit'
                  disabled={loading}
                  className='w-full py-2 bg-[#09090b] text-white text-sm font-semibold rounded-full disabled:opacity-50'>
                  {loading ? 'Đang xử lý...' : 'Đăng nhập demo'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
