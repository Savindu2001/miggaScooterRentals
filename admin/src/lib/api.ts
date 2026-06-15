import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('migga_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function transformDecimal(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(transformDecimal);
  }
  if (typeof obj === 'object') {
    if ('s' in obj && 'e' in obj && 'd' in obj) {
      const sign = obj.s;
      const exponent = obj.e;
      const digits = obj.d;
      if (Array.isArray(digits) && digits.length > 0) {
        let sum = 0;
        const firstGroupLength = digits[0].toString().length;
        for (let i = 0; i < digits.length; i++) {
          sum += digits[i] * Math.pow(10, exponent - (firstGroupLength - 1) - 7 * i);
        }
        return sign * sum;
      }
    }
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = transformDecimal(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

// Handle global 401 — clear session and redirect to login
api.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = transformDecimal(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('migga_token');
      localStorage.removeItem('migga_user');
      window.location.href = '/signin';
    }
    return Promise.reject(error);
  },
);

export default api;
