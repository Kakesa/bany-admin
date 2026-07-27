import type {
  EmailCampaign,
  EmailMarketingOverview,
  EmailTemplate,
  NewsletterStats,
  NewsletterSubscriber,
} from '../types';

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

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchEmailOverview(token: string): Promise<EmailMarketingOverview> {
  return request('/api/newsletter/overview', { headers: auth(token) });
}

export async function fetchNewsletterSubscribers(
  token: string,
  params?: { q?: string; source?: string; tag?: string; active?: string }
): Promise<{
  items: NewsletterSubscriber[];
  stats: NewsletterStats;
  meta: { sources: string[]; tags: string[] };
}> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.source) qs.set('source', params.source);
  if (params?.tag) qs.set('tag', params.tag);
  if (params?.active) qs.set('active', params.active);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request(`/api/newsletter/subscribers${suffix}`, { headers: auth(token) });
}

export async function setNewsletterSubscriberActive(
  token: string,
  id: string,
  active: boolean
): Promise<NewsletterSubscriber> {
  return request(`/api/newsletter/subscribers/${id}`, {
    method: 'PATCH',
    headers: auth(token),
    body: JSON.stringify({ active }),
  });
}

export async function deleteNewsletterSubscriber(token: string, id: string): Promise<void> {
  await request(`/api/newsletter/subscribers/${id}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

export async function fetchEmailTemplates(token: string): Promise<{ items: EmailTemplate[] }> {
  return request('/api/newsletter/templates', { headers: auth(token) });
}

export async function createEmailTemplate(
  token: string,
  payload: Partial<EmailTemplate>
): Promise<EmailTemplate> {
  return request('/api/newsletter/templates', {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export async function updateEmailTemplate(
  token: string,
  id: string,
  payload: Partial<EmailTemplate>
): Promise<EmailTemplate> {
  return request(`/api/newsletter/templates/${id}`, {
    method: 'PUT',
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export async function deleteEmailTemplate(token: string, id: string): Promise<void> {
  await request(`/api/newsletter/templates/${id}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

export async function fetchEmailCampaigns(token: string): Promise<{ items: EmailCampaign[] }> {
  return request('/api/newsletter/campaigns', { headers: auth(token) });
}

export async function createEmailCampaign(
  token: string,
  payload: Partial<EmailCampaign> & { htmlContent: string; subject: string; name: string }
): Promise<EmailCampaign> {
  return request('/api/newsletter/campaigns', {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export async function updateEmailCampaign(
  token: string,
  id: string,
  payload: Partial<EmailCampaign>
): Promise<EmailCampaign> {
  return request(`/api/newsletter/campaigns/${id}`, {
    method: 'PUT',
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}

export async function deleteEmailCampaign(token: string, id: string): Promise<void> {
  await request(`/api/newsletter/campaigns/${id}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

export async function sendEmailCampaignById(
  token: string,
  id: string
): Promise<{ sent: number; failed: number; total: number }> {
  return request(`/api/newsletter/campaigns/${id}/send`, {
    method: 'POST',
    headers: auth(token),
  });
}

/** Legacy one-shot */
export async function sendNewsletterCampaign(
  token: string,
  payload: { subject: string; message: string }
): Promise<{ sent: number; failed: number; total: number }> {
  return request('/api/newsletter/campaign', {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(payload),
  });
}
