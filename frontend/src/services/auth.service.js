import { api } from '../api/client';

export const authService = {
  getMe: () => api.get('/auth'),
  login: (credentials) => api.post('/auth/login', credentials),
  loginWithGoogle: (payload) => api.post('/auth/google', payload),
  register: (payload) => api.post('/auth/register', payload),
  requestOrganizer: (payload) => api.post('/auth/request-organizer', payload),
  logout: () => api.get('/auth/logout'),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  getProfile: () => api.get('/auth/user'),
  updateProfile: (payload) => api.post('/auth/user/my-account', payload),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export default authService;
