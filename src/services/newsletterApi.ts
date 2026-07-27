import type { NewsletterStats, NewsletterSubscriber } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

export async function fetchNewsletterSubscribers(
  token: string
): Promise<{ items: NewsletterSubscriber[]; stats: NewsletterStats }> {
  return request('/api/newsletter/subscribers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setNewsletterSubscriberActive(
  token: string,
  id: string,
  active: boolean
): Promise<NewsletterSubscriber> {
  return request(`/api/newsletter/subscribers/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
}

export async function deleteNewsletterSubscriber(token: string, id: string): Promise<void> {
  await request(`/api/newsletter/subscribers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendNewsletterCampaign(
  token: string,
  payload: { subject: string; message: string }
): Promise<{ sent: number; failed: number; total: number }> {
  return request('/api/newsletter/campaign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
