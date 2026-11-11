/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();
  const { user: currentAdmin } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (selectedRole) params.set('role', selectedRole);
      if (selectedStatus) params.set('status', selectedStatus);

      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.users || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [page, search, selectedRole, selectedStatus]);

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      showToast(`Đã cập nhật vai trò thành công: ${newRole}`);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật quyền người dùng');
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const confirmMsg =
      newStatus === 'BLOCKED'
        ? `Bạn có chắc muốn KHÓA tài khoản ${user.username}? Người dùng sẽ không thể đăng nhập.`
        : `MỞ KHÓA tài khoản ${user.username}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.put(`/admin/users/${user.id}/status`, { status: newStatus });
      showToast(`Đã chuyển trạng thái sang ${newStatus}`);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Không thể thay đổi trạng thái');
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Title */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Quản Lý Người Dùng &amp; Phân Quyền</h1>
        <p className='text-sm text-[#71717a] mt-1'>
          Quản lý tài khoản toàn hệ thống, khóa tài khoản vi phạm và phân quyền vai trò.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between'>
        <div className='relative w-full md:w-80'>
          <Search size={16} className='absolute left-3.5 top-3 text-[#71717a]' />
          <input
            type='text'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder='Tìm kiếm username, email, tên, SĐT...'
            className='w-full pl-9 pr-4 py-2 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs outline-none focus:border-[#09090b]'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2 w-full md:w-auto text-xs'>
          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPage(1);
            }}
            className='px-3 py-2 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl outline-none font-semibold text-[#52525b]'>
            <option value=''>Tất cả vai trò</option>
            <option value='CUSTOMER'>Khách hàng (CUSTOMER)</option>
            <option value='ORGANIZER'>Ban tổ chức (ORGANIZER)</option>
            <option value='STAFF'>Nhân viên soát vé (STAFF)</option>
            <option value='ADMIN'>Quản trị viên (ADMIN)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className='px-3 py-2 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl outline-none font-semibold text-[#52525b]'>
            <option value=''>Tất cả trạng thái</option>
            <option value='ACTIVE'>Đang hoạt động (ACTIVE)</option>
            <option value='BLOCKED'>Đã bị khóa (BLOCKED)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xs font-bold text-[#71717a] uppercase tracking-wider'>
            Tổng cộng: {total} người dùng
          </span>
          <div className='text-xs text-[#71717a]'>Trang {page} / {totalPages}</div>
        </div>

        {loading ? (
          <div className='py-16 text-center text-xs text-[#71717a]'>Đang nạp danh sách tài khoản...</div>
        ) : users.length === 0 ? (
          <div className='py-16 text-center text-xs text-[#71717a] border border-dashed border-[#e4e4e7] rounded-2xl'>
            Không tìm thấy người dùng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs text-left'>
              <thead>
                <tr className='border-b border-[#e4e4e7] text-[#71717a] uppercase text-[11px]'>
                  <th className='py-3 px-3'>Người dùng</th>
                  <th className='py-3 px-3'>Thông tin liên hệ</th>
                  <th className='py-3 px-3'>Vai trò (Role)</th>
                  <th className='py-3 px-3 text-center'>Trạng thái</th>
                  <th className='py-3 px-3 text-right'>Thao tác</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[#f4f4f6]'>
                {users.map((u) => {
                  const isSelf = String(u.id) === String(currentAdmin?.id);
                  return (
                    <tr key={u.id} className='hover:bg-[#f9f9fb]/50 transition-colors'>
                      <td className='py-3.5 px-3'>
                        <div className='font-bold text-[#09090b]'>{u.fullName || u.username}</div>
                        <div className='text-[11px] font-mono text-[#71717a]'>@{u.username}</div>
                      </td>

                      <td className='py-3.5 px-3 text-[#52525b]'>
                        <div>{u.email}</div>
                        <div className='text-[11px] text-[#71717a]'>{u.phone || 'Chưa có SĐT'}</div>
                      </td>

                      <td className='py-3.5 px-3'>
                        {isSelf ? (
                          <span className='px-3 py-1 bg-[#09090b] text-white rounded-full font-bold text-[10px]'>
                            {u.role} (Bạn)
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className='px-2.5 py-1 bg-[#f4f4f6] border border-[#e4e4e7] rounded-lg text-xs font-semibold outline-none focus:border-[#09090b] cursor-pointer'>
                            <option value='CUSTOMER'>CUSTOMER</option>
                            <option value='ORGANIZER'>ORGANIZER</option>
                            <option value='STAFF'>STAFF</option>
                            <option value='ADMIN'>ADMIN</option>
                          </select>
                        )}
                      </td>

                      <td className='py-3.5 px-3 text-center'>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            u.status === 'ACTIVE'
                              ? 'bg-[#09090b] text-white'
                              : 'bg-[#f4f4f6] text-[#52525b] border border-[#e4e4e7]'
                          }`}>
                          {u.status}
                        </span>
                      </td>

                      <td className='py-3.5 px-3 text-right'>
                        {!isSelf && (
                          <button
                            type='button'
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              u.status === 'ACTIVE'
                                ? 'border border-[#e4e4e7] text-[#09090b] hover:bg-[#f4f4f6]'
                                : 'bg-[#09090b] text-white hover:bg-[#27272a]'
                            }`}>
                            {u.status === 'ACTIVE' ? (
                              <>
                                <Lock size={12} />
                                <span>Khóa</span>
                              </>
                            ) : (
                              <>
                                <Unlock size={12} />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between pt-4 border-t border-[#f4f4f6] text-xs'>
            <button
              type='button'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className='inline-flex items-center gap-1 px-3.5 py-1.5 border border-[#e4e4e7] rounded-full disabled:opacity-30 hover:bg-[#f4f4f6]'>
              <ChevronLeft size={14} />
              <span>Trang trước</span>
            </button>

            <span className='font-semibold text-[#09090b]'>
              {page} / {totalPages}
            </span>

            <button
              type='button'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className='inline-flex items-center gap-1 px-3.5 py-1.5 border border-[#e4e4e7] rounded-full disabled:opacity-30 hover:bg-[#f4f4f6]'>
              <span>Trang sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
