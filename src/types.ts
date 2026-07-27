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
  source: string;
  active: boolean;
  subscribedAt: string;
  lastNotifiedAt?: string | null;
}

export interface NewsletterStats {
  total: number;
  active: number;
  inactive: number;
}
