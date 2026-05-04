import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – handle 401 / refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    const msg = error.response?.data?.detail || 'Something went wrong';
    toast.error(msg);
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => {
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  getMe: () => api.get('/auth/me'),
};

// ─── Users ─────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users/', { params }),
  getById: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.post('/users/change-password', data),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};

// ─── Doctors ───────────────────────────────────────
export const doctorsAPI = {
  list: (params) => api.get('/doctors/', { params }),
  getById: (id) => api.get(`/doctors/${id}`),
  createProfile: (data) => api.post('/doctors/profile', data),
  updateProfile: (data) => api.put('/doctors/profile', data),
  getSpecializations: () => api.get('/doctors/specializations'),
  createSpecialization: (data) => api.post('/doctors/specializations', data),
  getSchedules: (doctorId) => api.get(`/doctors/${doctorId}/schedules`),
  createSchedule: (data) => api.post('/doctors/schedules', data),
  updateSchedule: (id, data) => api.put(`/doctors/schedules/${id}`, data),
  deleteSchedule: (id) => api.delete(`/doctors/schedules/${id}`),
  generateSlots: (doctorId, days) => api.post(`/doctors/${doctorId}/generate-slots?days=${days}`),
};

// ─── Appointments ──────────────────────────────────
export const appointmentsAPI = {
  getSlots: (doctorId, dateFrom, dateTo) =>
    api.get(`/appointments/slots/${doctorId}`, { params: { date_from: dateFrom, date_to: dateTo } }),
  create: (data) => api.post('/appointments/', data),
  getMy: (params) => api.get('/appointments/my', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  update: (id, data) => api.patch(`/appointments/${id}`, data),
  blockSlots: (data) => api.post('/appointments/slots/block', data),
};

// ─── Reviews ───────────────────────────────────────
export const reviewsAPI = {
  create: (data) => api.post('/reviews/', data),
  getByDoctor: (doctorId, params) => api.get(`/reviews/doctor/${doctorId}`, { params }),
};

// ─── Notifications ─────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications/', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ─── Dashboard ─────────────────────────────────────
export const dashboardAPI = {
  getPatientStats: () => api.get('/dashboard/patient/stats'),
  getDoctorStats: () => api.get('/dashboard/doctor/stats'),
  getAdminStats: () => api.get('/dashboard/admin/stats'),
  getAppointmentTrends: (days) => api.get(`/dashboard/admin/appointment-trends?days=${days}`),
  getTopDoctors: (limit) => api.get(`/dashboard/admin/top-doctors?limit=${limit}`),
};

export default api;
