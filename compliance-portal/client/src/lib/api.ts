import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const campaignApi = {
  list: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: unknown) => api.post('/campaigns', data),
  update: (id: string, data: unknown) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  bulkDelete: (ids: string[]) => api.delete('/campaigns', { data: { ids } }),
  startScan: (id: string) => api.post(`/campaigns/${id}/scan`),
  listScans: (id: string) => api.get(`/campaigns/${id}/scans`),
};

export const scanApi = {
  list: (campaignId?: string) => api.get('/scans', { params: { campaignId } }),
  get: (id: string) => api.get(`/scans/${id}`),
  getResults: (id: string) => api.get(`/scans/${id}/results`),
  getIssues: (id: string, severity?: string) =>
    api.get(`/scans/${id}/issues`, { params: severity ? { severity } : {} }),
  getAuditLog: (id: string, category?: string) =>
    api.get(`/scans/${id}/audit-log`, { params: category ? { category } : {} }),
  getAuditSummary: (id: string) => api.get(`/scans/${id}/audit-log/summary`),
};

export const reportApi = {
  generate: (scanId: string, includeDetails = true) =>
    api.post('/reports/generate', { scanId, includeDetails }),
  list: (params?: { scanId?: string; campaignId?: string }) =>
    api.get('/reports', { params }),
  download: (reportId: string) =>
    window.open(`/api/reports/${reportId}/download`),
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
  getRecentScans: (limit?: number) =>
    api.get('/dashboard/recent-scans', { params: limit ? { limit } : {} }),
};

export const schedulerApi = {
  getStatus: () => api.get('/scheduler/status'),
  getPresets: () => api.get('/scheduler/presets'),
};

export const wcagApi = {
  getCriteria: (level?: string) =>
    api.get('/wcag/criteria', { params: level ? { level } : {} }),
  getCriterion: (id: string) => api.get(`/wcag/criteria/${id}`),
  updateCriterion: (id: string, data: unknown) =>
    api.put(`/wcag/criteria/${id}`, data),
  createCriterion: (data: unknown) => api.post('/wcag/criteria', data),
  deleteCriterion: (id: string) => api.delete(`/wcag/criteria/${id}`),
  getStats: () => api.get('/wcag/stats'),
  getPrinciples: () => api.get('/wcag/principles'),
  getGuidelines: () => api.get('/wcag/guidelines'),
  importFile: (file: File, mode: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return api.post('/wcag/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  confirmImport: (data: unknown) => api.post('/wcag/import/confirm', data),
  exportRules: (format: 'json' | 'csv') =>
    window.open(`/api/wcag/export?format=${format}`),
  getImportHistory: () => api.get('/wcag/imports'),
  resetToDefaults: () => api.post('/wcag/reset'),
};

export default api;
