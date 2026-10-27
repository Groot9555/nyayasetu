// Empty = same origin (Vite dev proxy forwards /api to the backend). Set e.g. http://localhost:8000 to call the API directly.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, { method = 'GET', body, responseType = 'json', signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the NyayaSetu server. Check your connection or try again shortly.', 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    let errors = [];
    try {
      const data = await res.json();
      if (data?.detail && typeof data.detail === 'string') message = data.detail;
      if (Array.isArray(data?.errors)) {
        errors = data.errors;
        if (errors.length) message = errors.map((e) => e.message).join(' ');
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, errors);
  }
  return responseType === 'blob' ? res.blob() : res.json();
}

export const api = {
  health: () => request('/api/health'),
  ask: (question, language = 'en', signal) => request('/api/ask', { method: 'POST', body: { question, language }, signal }),
  decode: (term, act, language = 'en') =>
    request('/api/legal-decoder', { method: 'POST', body: { term, act: act || null, language } }),
  rightsTopics: () => request('/api/rights-navigator/topics'),
  navigateRights: (topic, description, jurisdiction) =>
    request('/api/rights-navigator', { method: 'POST', body: { topic, description, jurisdiction: jurisdiction || null } }),
  generateComplaint: (fields) => request('/api/complaint-generator', { method: 'POST', body: fields }),
  complaintPdf: (draft, title, filename) =>
    request('/api/complaint-generator/pdf', { method: 'POST', body: { draft, title, filename }, responseType: 'blob' }),
  searchSources: (q, act) =>
    request(`/api/legal-sources/search?q=${encodeURIComponent(q)}${act ? `&act=${encodeURIComponent(act)}` : ''}`),
  listSources: () => request('/api/legal-sources'),
};
