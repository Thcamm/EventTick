import { api } from '../api/client';

export const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1'}/auth/google`;

export const authService = {
  getMe: () => api.get('/auth'),
  login: (credentials) => api.post('/auth/login', credentials),
  register: (payload) => api.post('/auth/register', payload),
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
