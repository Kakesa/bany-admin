import type { BlogArticle, BlogCategory, BlogComment } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function mediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = 'Une erreur est survenue';
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; email: string }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCategories(): Promise<BlogCategory[]> {
  return request<BlogCategory[]>('/api/categories');
}

export async function fetchAdminArticles(token: string): Promise<{ items: BlogArticle[] }> {
  return request('/api/articles/admin/all', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createArticle(
  token: string,
  payload: Partial<BlogArticle> & { publishNow?: boolean }
): Promise<BlogArticle> {
  return request('/api/articles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateArticle(
  token: string,
  id: string,
  payload: Partial<BlogArticle> & { publishNow?: boolean }
): Promise<BlogArticle> {
  return request(`/api/articles/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function deleteArticle(token: string, id: string): Promise<void> {
  await request(`/api/articles/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createCategory(
  token: string,
  payload: { name: string; slug?: string; description?: string }
): Promise<BlogCategory> {
  return request('/api/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  token: string,
  id: string,
  payload: { name?: string; slug?: string; description?: string }
): Promise<BlogCategory> {
  return request(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(token: string, id: string): Promise<void> {
  await request(`/api/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchAdminComments(token: string): Promise<{ items: BlogComment[] }> {
  return request('/api/comments/admin/all', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteComment(token: string, id: string): Promise<void> {
  await request(`/api/comments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadImage(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Échec du téléversement');
  }
  const data = await res.json();
  return mediaUrl(data.url);
}

export type SiteStatistic = {
  label: string;
  value: string;
};

export type TimelineMilestone = {
  year: string;
  month: number | null;
  title: string;
  desc: string;
};

export type SiteContent = {
  id: string;
  key: string;
  statistics: SiteStatistic[];
  timeline?: TimelineMilestone[];
  updatedAt?: string;
};

export async function fetchSiteContent(): Promise<SiteContent> {
  return request<SiteContent>('/api/site-content');
}

export async function updateSiteContent(
  token: string,
  payload: { statistics?: SiteStatistic[]; timeline?: TimelineMilestone[] }
): Promise<SiteContent> {
  return request('/api/site-content', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function formatBlogDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
