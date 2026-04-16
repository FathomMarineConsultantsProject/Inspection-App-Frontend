import axios from 'axios';

// Use your local IPv4 address - update if needed
const BASE_URL = 'https://inspection-audit-app-backend.onrender.com/';

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
export function setAuthToken(token: string | null) {
  if (token) {
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common['Authorization'];
  }
}

export default API;