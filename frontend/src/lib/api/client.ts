
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Request interceptor: додаємо токен до всіх запитів
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor: обробляємо помилки авторизації
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Якщо отримали 401, видаляємо токен
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Можна також перенаправити на сторінку логіну, але зараз просто видаляємо токен
    }
    return Promise.reject(error);
  }
);
