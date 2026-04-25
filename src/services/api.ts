import axios from 'axios';

// Use your local IPv4 address - update if needed
// <<<<<<< HEAD
const BASE_URL = 'https://inspection-audit-app-backend.onrender.com/';
// =======
// const BASE_URL = 'https://inspection-audit-app-backend.onrender.com';
// >>>>>>> feat/pdf

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default API;
