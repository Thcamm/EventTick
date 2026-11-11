/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/auth.service';
import { User, Lock, Mail, Phone, Calendar, ShieldCheck, Building2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser, requestOrganizer } = useAuth();
  const { showToast } = useToast();

  const [requestingOrganizer, setRequestingOrganizer] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    dob: '',
    gender: 'OTHER',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setProfileLoading(true);
    authService
      .getProfile()
      .then((res) => {
        if (res?.user) {
          setProfile({
            name: res.user.name || '',
            firstName: res.user.firstName || '',
            lastName: res.user.lastName || '',
            phone: res.user.phone || '',
            dob: res.user.dob ? res.user.dob.substring(0, 10) : '',
            gender: res.user.gender || 'OTHER',
          });
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await authService.updateProfile(profile);
      await refreshUser();
      showToast('Cập nhật thông tin thành công!');
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật hồ sơ');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }

    setPasswordSaving(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showToast('Đổi mật khẩu thành công!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUpgradeOrganizer = async () => {
    const orgName = window.prompt('Nhập tên đơn vị / thương hiệu tổ chức của bạn:');
    if (!orgName || !orgName.trim()) return;

    setRequestingOrganizer(true);
    try {
      await requestOrganizer({ organizationName: orgName.trim() });
      await refreshUser();
      showToast('Nâng cấp lên Nhà tổ chức thành công! Vui lòng nộp hồ sơ KYC.');
    } catch (err) {
      showToast(err.message || 'Không thể gửi yêu cầu nâng cấp');
    } finally {
      setRequestingOrganizer(false);
    }
  };

  return (
    <div className='max-w-3xl mx-auto py-10 px-4 space-y-8'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Tài khoản của tôi</h1>
        <p className='text-sm text-[#71717a] mt-1'>Quản lý thông tin cá nhân và bảo mật tài khoản EventTick</p>
      </div>

      {/* Account Info summary */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='w-14 h-14 rounded-full bg-[#09090b] text-white flex items-center justify-center font-bold text-xl'>
            {(user?.username || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className='text-base font-bold text-[#09090b]'>{user?.full_name || user?.username}</div>
            <div className='text-xs text-[#71717a] flex items-center gap-2 mt-0.5'>
              <Mail size={13} />
              <span>{user?.email}</span>
            </div>
          </div>
        </div>
        <div className='text-right'>
          <span className='px-2.5 py-1 bg-[#f4f4f6] text-[#09090b] text-xs font-semibold rounded-full border border-[#e4e4e7]'>
            Vai trò: {user?.role}
          </span>
        </div>
      </div>

      {/* Nâng cấp Nhà tổ chức (UC01) nếu là CUSTOMER */}
      {user?.role === 'CUSTOMER' && (
        <div className='bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
          <div>
            <div className='text-sm font-bold text-[#09090b] flex items-center gap-2'>
              <Building2 size={16} />
              <span>Bạn muốn tổ chức và phân phối vé sự kiện?</span>
            </div>
            <p className='text-xs text-[#71717a] mt-1 max-w-lg'>
              Nâng cấp tài khoản lên Nhà tổ chức (Organizer) để mở quyền tạo sự kiện, thiết kế sơ đồ ghế ngồi và cấu hình mở bán vé.
            </p>
          </div>
          <button
            type='button'
            onClick={handleUpgradeOrganizer}
            disabled={requestingOrganizer}
            className='px-5 py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors shrink-0'>
            {requestingOrganizer ? 'Đang xử lý...' : 'Nâng cấp lên Nhà tổ chức'}
          </button>
        </div>
      )}

      {/* Personal Info Form */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <h2 className='text-base font-bold text-[#09090b] flex items-center gap-2 mb-4'>
          <User size={18} />
          <span>Thông tin cá nhân</span>
        </h2>

        {profileLoading ? (
          <div className='text-xs text-[#71717a] py-4'>Đang tải thông tin...</div>
        ) : (
          <form onSubmit={handleUpdateProfile} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                  Họ và tên đệm
                </label>
                <input
                  type='text'
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  placeholder='Nguyễn'
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                  Tên
                </label>
                <input
                  type='text'
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  placeholder='Văn A'
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
                />
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                  Số điện thoại
                </label>
                <input
                  type='tel'
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder='0912345678'
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                  Ngày sinh
                </label>
                <input
                  type='date'
                  value={profile.dob}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
                />
              </div>
            </div>

            <button
              type='submit'
              disabled={profileSaving}
              className='px-6 py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
              {profileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        )}
      </div>

      {/* Change Password Form */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <h2 className='text-base font-bold text-[#09090b] flex items-center gap-2 mb-4'>
          <Lock size={18} />
          <span>Đổi mật khẩu</span>
        </h2>

        {passwordError && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className='space-y-4'>
          <div>
            <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
              Mật khẩu hiện tại
            </label>
            <input
              type='password'
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              placeholder='••••••••'
              className='w-full max-w-md px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md'>
            <div>
              <label className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                Mật khẩu mới
              </label>
              <input
                type='password'
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder='••••••••'
                className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
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
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder='••••••••'
                className='w-full px-3.5 py-2.5 bg-[#f4f4f6] rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] border border-transparent transition-all'
              />
            </div>
          </div>

          <button
            type='submit'
            disabled={passwordSaving}
            className='px-6 py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
            {passwordSaving ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
