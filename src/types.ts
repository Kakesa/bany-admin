export type BlogArticleStatus = 'draft' | 'scheduled' | 'published';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount?: number;
}

export interface BlogSeo {
  metaTitle: string;
  metaDescription: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  gallery: string[];
  youtubeUrl?: string;
  author: string;
  authorTitle?: string;
  categoryId: string;
  category?: BlogCategory | null;
  tags: string[];
  status: BlogArticleStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  readingTimeMinutes: number;
  likes: number;
  commentCount: number;
  featured: boolean;
  seo: BlogSeo;
  createdAt: string;
  updatedAt: string;
}

export interface BlogComment {
  id: string;
  articleId: string;
  parentId?: string | null;
  author: string;
  email?: string;
  content: string;
  likes: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  articleTitle?: string;
  articleSlug?: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  source: string;
  tags?: string[];
  active: boolean;
  subscribedAt: string;
  consentAt?: string | null;
  lastNotifiedAt?: string | null;
  welcomeSentAt?: string | null;
}

export interface NewsletterStats {
  total: number;
  active: number;
  inactive: number;
}

export type EmailTemplateCategory = 'welcome' | 'article' | 'announcement' | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  category: EmailTemplateCategory | string;
  subject: string;
  previewText?: string;
  htmlBody: string;
  textBody?: string;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type EmailCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent?: string;
  status: EmailCampaignStatus | string;
  templateId?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  segment?: {
    sources?: string[];
    tags?: string[];
    activeOnly?: boolean;
  };
  stats?: {
    recipients: number;
    sent: number;
    failed: number;
  };
  createdBy?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailMarketingOverview {
  audience: NewsletterStats;
  templates: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    subject: string;
    status: string;
    sentAt?: string | null;
    stats?: EmailCampaign['stats'];
  }>;
}
