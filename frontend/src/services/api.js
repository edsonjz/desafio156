const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('desafio156_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('desafio156_token', token);
  } else {
    localStorage.removeItem('desafio156_token');
  }
}

export function removeToken() {
  localStorage.removeItem('desafio156_token');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Erro na API (${res.status}): A rota não retornou um JSON válido.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        removeToken();
        window.dispatchEvent(new Event('auth_expired'));
      }
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export async function apiUpload(endpoint, formData) {
  const token = getToken();
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData
    });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Erro na API (${res.status}): A rota não retornou um JSON válido.`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    throw err;
  }
}
