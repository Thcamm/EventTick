import { useEffect, useRef, useState } from 'react';
import { User, Mail, Camera, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/auth.service';
import { api } from '../../api/client';
import { inputCls } from '../../components/FormField';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1').replace(/\/v1\/?$/, '');
const resolveAvatar = (u) => (u ? (/^https?:/.test(u) ? u : `${API_ORIGIN}${u}`) : '');
const ROLE_LABEL = { CUSTOMER: 'Khách hàng', ORGANIZER: 'Nhà tổ chức', STAFF: 'Nhân viên soát vé', ADMIN: 'Quản trị viên' };

/** Tài khoản đăng nhập bằng Google: email do Google xác thực nên không sửa; không có mật khẩu để đổi. */
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [profile, setProfile] = useState({ lastName: '', firstName: '', phone: '', dob: '', gender: 'OTHER' });
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    authService
      .getProfile()
      .then((res) => {
        if (!alive || !res?.user) return;
        const u = res.user;
        setProfile({
          lastName: u.lastName || '',
          firstName: u.firstName || '',
          phone: u.phone || '',
          dob: u.dob ? String(u.dob).substring(0, 10) : '',
          gender: u.gender || 'OTHER',
        });
        setAvatar(u.avatarUrl || '');
      })
      .catch(() => showToast('Không tải được thông tin tài khoản'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showToast]);

  const save = async (e) => {
    e.preventDefault();
    if (profile.phone && !/^[0-9+\s]{8,15}$/.test(profile.phone.trim())) {
      showToast('Số điện thoại không hợp lệ');
      return;
    }
    setSaving(true);
    try {
      await authService.updateProfile(profile);
      await refreshUser();
      showToast('Cập nhật thông tin thành công');
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast('Ảnh đại diện phải là JPG, PNG hoặc WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB)');
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      const res = await api.post('/user/profile/avatar', fd);
      if (res.avatarUrl) setAvatar(res.avatarUrl);
      await refreshUser();
      showToast('Đã cập nhật ảnh đại diện');
    } catch (err) {
      showToast(err.message || 'Không tải được ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
  const displayName = user?.name || user?.username || 'Tài khoản';

  return (
    <div className='max-w-3xl mx-auto py-10 px-4 space-y-8'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Tài khoản của tôi</h1>
        <p className='text-sm text-[#71717a] mt-1'>Quản lý thông tin cá nhân tài khoản EventTick</p>
      </div>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <div className='relative'>
            {avatar ? (
              <img src={resolveAvatar(avatar)} alt='Ảnh đại diện' className='w-16 h-16 rounded-full object-cover border border-[#e4e4e7]' referrerPolicy='no-referrer' />
            ) : (
              <div className='w-16 h-16 rounded-full bg-[#09090b] text-white flex items-center justify-center font-bold text-2xl'>
                {displayName[0].toUpperCase()}
              </div>
            )}
            <button
              type='button'
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className='absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-[#e4e4e7] flex items-center justify-center hover:bg-[#f4f4f6] disabled:opacity-50'
              title='Đổi ảnh đại diện'
              aria-label='Đổi ảnh đại diện'>
              <Camera size={13} />
            </button>
            <input ref={fileRef} type='file' accept='image/jpeg,image/png,image/webp' className='hidden' onChange={uploadAvatar} />
          </div>
          <div>
            <div className='text-base font-bold text-[#09090b]'>{displayName}</div>
            <div className='text-xs text-[#71717a] flex items-center gap-2 mt-0.5'>
              <Mail size={13} />
              <span>{user?.email}</span>
            </div>
            {uploading && <div className='text-xs text-[#71717a] mt-1'>Đang tải ảnh lên...</div>}
          </div>
        </div>
        <span className='px-2.5 py-1 bg-[#f4f4f6] text-[#09090b] text-xs font-semibold rounded-full border border-[#e4e4e7] flex items-center gap-1.5'>
          <ShieldCheck size={13} /> {ROLE_LABEL[user?.role] || user?.role}
        </span>
      </div>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6'>
        <h2 className='text-base font-bold text-[#09090b] flex items-center gap-2 mb-4'>
          <User size={18} />
          <span>Thông tin cá nhân</span>
        </h2>

        {loading ? (
          <div className='text-xs text-[#71717a] py-4'>Đang tải thông tin...</div>
        ) : (
          <form onSubmit={save} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label htmlFor='p-last' className={label}>Họ và tên đệm</label>
                <input id='p-last' className={inputCls} value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} placeholder='Nguyễn' />
              </div>
              <div>
                <label htmlFor='p-first' className={label}>Tên</label>
                <input id='p-first' className={inputCls} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} placeholder='Văn A' />
              </div>
            </div>

            <div>
              <label htmlFor='p-email' className={label}>Email (từ Google)</label>
              <input id='p-email' className={`${inputCls} opacity-60 cursor-not-allowed`} value={user?.email || ''} disabled readOnly />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <div>
                <label htmlFor='p-phone' className={label}>Số điện thoại</label>
                <input id='p-phone' type='tel' className={inputCls} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder='0912345678' />
              </div>
              <div>
                <label htmlFor='p-dob' className={label}>Ngày sinh</label>
                <input id='p-dob' type='date' className={inputCls} max={new Date().toISOString().slice(0, 10)} value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} />
              </div>
              <div>
                <label htmlFor='p-gender' className={label}>Giới tính</label>
                <select id='p-gender' className={inputCls} value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
                  <option value='MALE'>Nam</option>
                  <option value='FEMALE'>Nữ</option>
                  <option value='OTHER'>Khác</option>
                </select>
              </div>
            </div>

            <button type='submit' disabled={saving} className='tb-btn tb-btn-solid' style={{ height: 42, padding: '0 24px' }}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
