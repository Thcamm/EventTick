import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRoleHomePath } from '../routes/paths';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1').replace(/\/v1\/?$/, '');

export default function GoogleAuthButton({
  role = 'CUSTOMER',
  isOrganizerRequest = false,
  organizationName = '',
  text = 'Đăng nhập với Google',
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleClick = () => {
    if (loading) return;

    // Nếu đã có Google SDK OAuth2 trên trình duyệt -> mở popup chọn tài khoản Google thật
    if (GOOGLE_CLIENT_ID && window.google?.accounts?.oauth2) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            setLoading(false);
            if (tokenResponse.error && tokenResponse.error !== 'access_denied') {
              showToast('Lỗi Google: ' + (tokenResponse.error_description || tokenResponse.error));
            }
            return;
          }

          setLoading(true);
          try {
            const res = await loginWithGoogle({
              accessToken: tokenResponse.access_token,
              role,
              isOrganizerRequest: isOrganizerRequest || role === 'ORGANIZER',
              organizationName,
            });

            showToast(res.message || 'Đăng nhập Google thành công!');
            navigate(getRoleHomePath(res.user?.role || 'CUSTOMER'), { replace: true });
          } catch (err) {
            showToast(err.message || 'Xác thực Google thất bại');
          } finally {
            setLoading(false);
          }
        },
        error_callback: (err) => {
          setLoading(false);
          // Nếu người dùng tự đóng popup (popup_closed) thì không báo lỗi
          if (err?.type === 'popup_failed_to_open') {
            // Popup bị trình duyệt chặn -> chuyển sang redirect flow
            const params = new URLSearchParams({ role, redirect: window.location.origin });
            window.location.href = `${BACKEND_BASE}/v1/auth/google?${params}`;
          }
        },
      });

      tokenClient.requestAccessToken();
      return;
    }

    // Fallback: Chuyển hướng trực tiếp qua backend Google OAuth2
    const params = new URLSearchParams({ role, redirect: window.location.origin });
    window.location.href = `${BACKEND_BASE}/v1/auth/google?${params}`;
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={loading}
      className={`w-full py-2.5 px-4 bg-white border border-[#e4e4e7] hover:border-[#09090b] text-[#09090b] text-sm font-semibold rounded-full flex items-center justify-center gap-2.5 shadow-2xs hover:bg-[#fafafa] transition-all disabled:opacity-50 ${className}`}>
      {loading ? (
        <svg className='w-4 h-4 animate-spin shrink-0' fill='none' viewBox='0 0 24 24'>
          <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
          <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
        </svg>
      ) : (
        <svg className='w-4 h-4 shrink-0' viewBox='0 0 24 24'>
          <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
          <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
          <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z' />
          <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z' />
        </svg>
      )}
      <span>{loading ? 'Đang đăng nhập...' : text}</span>
    </button>
  );
}
