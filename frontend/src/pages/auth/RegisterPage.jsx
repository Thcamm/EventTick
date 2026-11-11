import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setRegisteredEmail(form.email);
      showToast('Đăng ký tài khoản thành công! Vui lòng xác thực email.');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
        <div className='w-full max-w-105 bg-white border border-[#e4e4e7] rounded-2xl p-8 text-center shadow-sm'>
          <div className='w-12 h-12 bg-[#f4f4f6] text-[#09090b] rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg'>
            ✉
          </div>
          <h2 className='text-xl font-bold text-[#09090b] mb-2'>Kiểm tra hộp thư của bạn</h2>
          <p className='text-sm text-[#71717a] mb-6'>
            Chúng tôi đã gửi link xác thực đến <strong className='text-[#09090b]'>{registeredEmail}</strong>. Vui lòng
            bấm vào liên kết trong email để kích hoạt tài khoản.
          </p>
          <Link
            to={PATHS.LOGIN}
            className='inline-block w-full py-2.5 bg-[#09090b] text-white text-sm font-medium rounded-lg hover:bg-[#27272a] transition-colors'>
            Đến trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4'>
      <div className='w-full max-w-110 bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-bold text-[#09090b] tracking-tight'>Tạo tài khoản</h1>
          <p className='text-sm text-[#71717a] mt-1'>Trải nghiệm đặt vé và quản lý sự kiện trên EventTick</p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>{error}</div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Bạn tham gia với vai trò
            </label>
            <div className='grid grid-cols-2 gap-2'>
              <button
                type='button'
                onClick={() => setForm({ ...form, role: 'CUSTOMER' })}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  form.role === 'CUSTOMER'
                    ? 'border-[#09090b] bg-[#09090b] text-white'
                    : 'border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#f4f4f6]'
                }`}>
                Khán giả mua vé
              </button>
              <button
                type='button'
                onClick={() => setForm({ ...form, role: 'ORGANIZER' })}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  form.role === 'ORGANIZER'
                    ? 'border-[#09090b] bg-[#09090b] text-white'
                    : 'border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#f4f4f6]'
                }`}>
                Ban tổ chức sự kiện
              </button>
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Username
            </label>
            <input
              type='text'
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder='johndoe'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Email</label>
            <input
              type='email'
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder='user@example.com'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Mật khẩu
            </label>
            <input
              type='password'
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder='••••••••'
              className='w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all'
            />
          </div>

          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Xác nhận mật khẩu
            </label>
            <input
              type='password'
              required
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
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>

        <div className='mt-6 pt-6 border-t border-[#f4f4f6] text-center text-xs text-[#71717a]'>
          Đã có tài khoản?{' '}
          <Link to={PATHS.LOGIN} className='font-semibold text-[#09090b] hover:underline'>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
