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

// Static mode (e.g. Netlify): run the retrieval engine in the browser instead of calling the backend.
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
let enginePromise;

async function local(fn, ...args) {
  enginePromise ??= import('../local/engine.js');
  const engine = await enginePromise;
  try {
    return await engine[fn](...args);
  } catch (err) {
    if (err instanceof engine.ValidationError) throw new ApiError(err.message, 422);
    throw new ApiError('Could not load the legal search engine in your browser. Check your connection and try again.', 0);
  }
}

const remoteApi = {
  warmup: () => {},
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

const localApi = {
  warmup: () => {
    enginePromise ??= import('../local/engine.js');
    enginePromise.then((e) => e.warmup()).catch(() => {});
  },
  health: () => local('health'),
  ask: (question) => local('ask', question),
  decode: (term, act) => local('decode', term, act || null),
  rightsTopics: () => local('rightsTopics'),
  navigateRights: (topic, description) => local('navigateRights', topic, description),
  generateComplaint: (fields) => local('generateComplaint', fields),
  complaintPdf: (draft, title) => local('complaintPdf', draft, title),
  searchSources: (q, act) => local('searchSources', q, act),
  listSources: () => local('listSources'),
};

export const api = STATIC_MODE ? localApi : remoteApi;

// Download progress of the in-browser engine (static mode only); returns an unsubscribe function.
export function subscribeEngine(fn) {
  if (!STATIC_MODE) return () => {};
  let unsubscribe = () => {};
  let cancelled = false;
  enginePromise ??= import('../local/engine.js');
  enginePromise.then((e) => {
    if (!cancelled) unsubscribe = e.subscribe(fn);
  }).catch(() => {});
  return () => {
    cancelled = true;
    unsubscribe();
  };
}
