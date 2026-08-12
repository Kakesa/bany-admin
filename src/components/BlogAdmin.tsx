import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  Send,
  Clock,
  LogOut,
  ImagePlus,
  X,
  LayoutDashboard,
  FileText,
  Tags,
  CalendarDays,
  Search,
  Bell,
  Menu,
  Shield,
  Star,
  LayoutList,
  LayoutGrid,
  MessageCircle,
  ExternalLink,
  Mail,
  BarChart3,
} from 'lucide-react';
import type { BlogArticle, BlogArticleStatus, BlogCategory, BlogComment } from '../types';
import {
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  deleteComment,
  fetchAdminArticles,
  fetchAdminComments,
  fetchCategories,
  formatBlogDate,
  mediaUrl,
  updateArticle,
  updateCategory,
  uploadImage,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from './DateTimePicker';
import ActionsMenu from './ActionsMenu';
import RichTextEditor from './RichTextEditor';
import NewsletterAdminPanel from './NewsletterAdminPanel';
import SiteContentPanel from './SiteContentPanel';

export type AdminTab = 'dashboard' | 'articles' | 'categories' | 'calendar' | 'comments' | 'newsletter' | 'site-content';

interface BlogAdminProps {
  initialTab?: AdminTab;
}

const TAB_PATH: Record<AdminTab, string> = {
  dashboard: '/dashboard',
  articles: '/articles',
  categories: '/categories',
  calendar: '/calendar',
  comments: '/comments',
  newsletter: '/newsletter',
  'site-content': '/site-content',
};

const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:3000';

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  gallery: string[];
  youtubeUrl: string;
  author: string;
  authorTitle: string;
  categoryId: string;
  tags: string;
  status: BlogArticleStatus;
  scheduledAt: string;
  featured: boolean;
};

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const emptyForm = (categories: BlogCategory[]): FormState => ({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  gallery: [],
  youtubeUrl: '',
  author: 'Bany',
  authorTitle: 'Founder & CEO – Yolo Group | Honorary Doctor (Entrepreneurship & Host of Bany Talks)',
  categoryId: categories[0]?.id || '',
  tags: '',
  status: 'draft',
  scheduledAt: '',
  featured: false,
});

function articleToForm(article: BlogArticle): FormState {
  return {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    coverImage: article.coverImage,
    gallery: article.gallery || [],
    youtubeUrl: article.youtubeUrl || '',
    author: article.author,
    authorTitle:
      article.authorTitle ||
      'Founder & CEO – Yolo Group | Honorary Doctor (Entrepreneurship & Host of Bany Talks)',
    categoryId: article.categoryId,
    tags: (article.tags || []).join(', '),
    status: article.status,
    scheduledAt: article.scheduledAt ? article.scheduledAt.slice(0, 16) : '',
    featured: article.featured,
  };
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function BlogAdmin({ initialTab = 'dashboard' }: BlogAdminProps) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogArticle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm([]));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [articlesView, setArticlesView] = useState<'list' | 'cards'>('list');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', slug: '' });
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<BlogCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const loadData = async (authToken: string) => {
    setLoading(true);
    try {
      const [arts, cats, coms] = await Promise.all([
        fetchAdminArticles(authToken),
        fetchCategories(),
        fetchAdminComments(authToken).catch(() => ({ items: [] as BlogComment[] })),
      ]);
      setArticles(arts.items);
      setCategories(cats);
      setComments(coms.items);
      setForm((prev) => ({ ...prev, categoryId: prev.categoryId || cats[0]?.id || '' }));
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('token')) {
        logout();
        navigate('/login', { replace: true });
      }
      setMessage(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData(token);
  }, [token]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const goTab = (id: AdminTab) => {
    setTab(id);
    setSidebarOpen(false);
    navigate(TAB_PATH[id]);
  };

  const stats = useMemo(() => {
    const published = articles.filter((a) => a.status === 'published').length;
    const drafts = articles.filter((a) => a.status === 'draft').length;
    const scheduled = articles.filter((a) => a.status === 'scheduled').length;
    const featured = articles.filter((a) => a.featured).length;
    return { total: articles.length, published, drafts, scheduled, featured };
  }, [articles]);

  const categoryBars = useMemo(() => {
    return categories
      .map((cat) => ({
        name: cat.name,
        count: articles.filter((a) => a.categoryId === cat.id || a.category?.id === cat.id).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [categories, articles]);

  const maxBar = Math.max(1, ...categoryBars.map((b) => b.count));

  const statusTrend = useMemo(() => {
    const months: { key: string; label: string; published: number; drafts: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const published = articles.filter((a) => {
        if (!a.publishedAt && a.status !== 'published') return false;
        const pd = new Date(a.publishedAt || a.createdAt);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth() && a.status === 'published';
      }).length;
      const drafts = articles.filter((a) => {
        const cd = new Date(a.createdAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() && a.status === 'draft';
      }).length;
      months.push({ key, label, published, drafts });
    }
    return months;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        a.category?.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [articles, search]);

  const scheduledDates = useMemo(() => {
    const map = new Map<string, BlogArticle[]>();
    for (const a of articles) {
      const iso = a.scheduledAt || a.publishedAt;
      if (!iso) continue;
      const key = new Date(iso).toDateString();
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [articles]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(categories));
    setShowFormModal(true);
    setMessage(null);
  };

  const openEdit = (article: BlogArticle) => {
    setEditingId(article.id);
    setForm(articleToForm(article));
    setShowFormModal(true);
    setMessage(null);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingId(null);
  };

  const updateTitle = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      // Nouveau : slug auto. Modification : on conserve le slug existant.
      slug: editingId ? prev.slug : slugify(title),
    }));
  };

  const payloadFromForm = (status: BlogArticleStatus) => {
    const slug = form.slug.trim() || slugify(form.title);
    return {
      title: form.title,
      slug,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      gallery: form.gallery,
      youtubeUrl: form.youtubeUrl || undefined,
      author: form.author,
      authorTitle: form.authorTitle,
      categoryId: form.categoryId,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status,
      scheduledAt:
        status === 'scheduled' && form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
      publishedAt: status === 'published' ? new Date().toISOString() : null,
      featured: form.featured,
      publishNow: status === 'published',
      seo: {
        metaTitle: form.title,
        metaDescription: form.excerpt,
        ogImage: form.coverImage,
      },
    };
  };

  const handleSave = async (mode?: 'draft' | 'schedule' | 'publish') => {
    if (!form.title.trim() || !form.content.replace(/<[^>]+>/g, '').trim()) {
      setMessage('Titre et contenu sont obligatoires');
      return;
    }

    const status: BlogArticleStatus = mode
      ? mode === 'draft'
        ? 'draft'
        : mode === 'schedule'
          ? 'scheduled'
          : 'published'
      : form.status;

    if (status === 'scheduled' && !form.scheduledAt) {
      setForm((prev) => ({ ...prev, status: 'scheduled' }));
      setMessage('Choisissez une date de publication pour programmer l’article');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      setForm((prev) => ({
        ...prev,
        slug: prev.slug.trim() || slugify(prev.title),
        status,
      }));

      const payload = payloadFromForm(status);

      if (editingId) {
        await updateArticle(token, editingId, payload);
        setMessage('Article mis à jour');
      } else {
        await createArticle(token, payload);
        setMessage('Article créé');
      }
      closeFormModal();
      await loadData(token);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteArticle(token, deleteTarget.id);
      setDeleteTarget(null);
      await loadData(token);
      setMessage('Article supprimé');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async (file: File, target: 'cover' | 'gallery') => {
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      if (target === 'cover') {
        setForm((f) => ({ ...f, coverImage: url }));
      } else {
        setForm((f) => ({ ...f, gallery: [...f.gallery, url] }));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload échoué');
    } finally {
      setUploading(false);
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', slug: '' });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: BlogCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || '', slug: cat.slug });
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setMessage('Le nom de la catégorie est obligatoire');
      return;
    }
    setSavingCategory(true);
    setMessage(null);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        slug: categoryForm.slug.trim() || slugify(categoryForm.name),
      };
      if (editingCategory) {
        await updateCategory(token, editingCategory.id, payload);
        setMessage('Catégorie mise à jour');
      } else {
        await createCategory(token, payload);
        setMessage('Catégorie créée');
      }
      setShowCategoryModal(false);
      await loadData(token);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur catégorie');
    } finally {
      setSavingCategory(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true);
    try {
      await deleteCategory(token, deleteCategoryTarget.id);
      setDeleteCategoryTarget(null);
      await loadData(token);
      setMessage('Catégorie supprimée');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setDeletingCategory(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    try {
      await deleteComment(token, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setMessage('Commentaire supprimé');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const statusLabel = useMemo(
    () =>
      ({
        draft: 'Brouillon',
        scheduled: 'Programmé',
        published: 'Publié',
      }) as Record<BlogArticleStatus, string>,
    []
  );

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'articles', label: 'Articles', icon: FileText },
    { id: 'categories', label: 'Catégories', icon: Tags },
    { id: 'comments', label: 'Commentaires', icon: MessageCircle },
    { id: 'newsletter', label: 'Bany Mail', icon: Mail },
    { id: 'site-content', label: 'Contenu site', icon: BarChart3 },
    { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
  ];

  if (!token) {
    return null;
  }

  const calCells = monthMatrix(calMonth.getFullYear(), calMonth.getMonth());
  const maxTrend = Math.max(1, ...statusTrend.flatMap((m) => [m.published, m.drafts]));

  return (
    <section className="bg-stone-950 min-h-screen text-stone-100">
      <div className="min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-stone-900 border-r border-white/5 flex flex-col transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-6 flex items-center gap-3 border-b border-white/5">
            <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-br from-rose-500 to-rose-300">
              <div className="w-full h-full rounded-full bg-stone-900 flex items-center justify-center text-sm font-display text-rose-400">
                B
              </div>
            </div>
            <div>
              <p className="font-display text-sm text-stone-100">Bany Admin</p>
              <p className="text-[11px] text-stone-600 font-body">Blog Officiel</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-body transition cursor-pointer ${
                  tab === id
                    ? 'bg-white/5 text-stone-100 border-l-2 border-rose-500'
                    : 'text-stone-500 hover:text-stone-200 hover:bg-white/[0.03] border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-2">
            <a
              href={`${PUBLIC_SITE}/#/blog`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-stone-500 hover:text-stone-200 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" /> Voir le site
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-stone-500 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            aria-label="Fermer le menu"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <div className="flex flex-col min-w-0 min-h-screen lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 px-4 sm:px-6 py-4 lg:py-5 flex items-center gap-4">
            <button
              type="button"
              className="lg:hidden text-white p-1.5 cursor-pointer"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1 max-w-xl mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) goTab('articles');
                }}
                placeholder="Rechercher un article, un auteur, une catégorie…"
                className="w-full rounded-full bg-white text-[#111111] placeholder:text-[#737373] pl-10 pr-4 py-2.5 text-sm focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 text-white">
              <button type="button" className="p-1.5 opacity-90 hover:opacity-100 cursor-pointer" aria-label="Notifications">
                <Bell className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-display">
                A
              </div>
            </div>
          </header>

          <div className="flex-1 pt-10 sm:pt-12 lg:pt-14 px-4 sm:px-6 lg:px-8 pb-10 space-y-8 bg-stone-950">
            {message && (
              <div
                className={`text-sm font-body border px-4 py-3 ${
                  /erreur|impossible|échou|requis|obligatoire|échec/i.test(message)
                    ? 'text-rose-400 border-rose-500/20 bg-rose-500/5'
                    : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                }`}
              >
                {message}
              </div>
            )}

            {/* DASHBOARD */}
            {tab === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-1">Vue d'ensemble</p>
                    <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Dashboard</h1>
                  </div>
                  <button type="button" onClick={openCreate} className="btn-primary text-xs">
                    <Plus className="w-3.5 h-3.5" /> Nouvel article
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { label: 'Articles', value: stats.total, hint: 'total' },
                    { label: 'Publiés', value: stats.published, hint: 'en ligne' },
                    { label: 'Brouillons', value: stats.drafts, hint: 'en cours' },
                    { label: 'Commentaires', value: comments.length, hint: 'reçus' },
                  ].map((card) => (
                    <div key={card.label} className="bg-stone-900 border border-white/5 p-5 space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-rose-400 font-body">{card.label}</p>
                      <p className="font-display text-3xl text-stone-100">{card.value.toLocaleString('fr-FR')}</p>
                      <p className="text-xs text-stone-600 font-body">{card.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  {/* Bar chart categories */}
                  <div className="xl:col-span-4 bg-stone-900 border border-white/5 p-5 space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-rose-400 mb-1">Catégories</p>
                      <h3 className="font-display text-lg text-stone-100">Répartition</h3>
                    </div>
                    <div className="flex items-end gap-3 h-40">
                      {categoryBars.map((bar) => (
                        <div key={bar.name} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div
                            className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-sm"
                            style={{ height: `${Math.max(8, (bar.count / maxBar) * 100)}%` }}
                            title={`${bar.name}: ${bar.count}`}
                          />
                          <span className="text-[10px] text-stone-600 truncate w-full text-center">{bar.name.slice(0, 4)}</span>
                        </div>
                      ))}
                      {categoryBars.length === 0 && (
                        <p className="text-sm text-stone-600 self-center mx-auto">Aucune donnée</p>
                      )}
                    </div>
                  </div>

                  {/* Line-ish trend */}
                  <div className="xl:col-span-5 bg-stone-900 border border-white/5 p-5 space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-rose-400 mb-1">Activité</p>
                      <h3 className="font-display text-lg text-stone-100">6 derniers mois</h3>
                    </div>
                    <div className="relative h-40">
                      <svg viewBox="0 0 300 120" className="w-full h-full" preserveAspectRatio="none">
                        <polyline
                          fill="none"
                          stroke="#ef3b3b"
                          strokeWidth="2.5"
                          points={statusTrend
                            .map((m, i) => `${(i / Math.max(1, statusTrend.length - 1)) * 300},${120 - (m.published / maxTrend) * 100}`)
                            .join(' ')}
                        />
                        <polyline
                          fill="none"
                          stroke="#f16464"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                          opacity="0.7"
                          points={statusTrend
                            .map((m, i) => `${(i / Math.max(1, statusTrend.length - 1)) * 300},${120 - (m.drafts / maxTrend) * 100}`)
                            .join(' ')}
                        />
                      </svg>
                      <div className="flex justify-between mt-2">
                        {statusTrend.map((m) => (
                          <span key={m.key} className="text-[10px] text-stone-600 uppercase">
                            {m.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Publiés
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400" /> Brouillons
                      </span>
                    </div>
                  </div>

                  {/* Donuts */}
                  <div className="xl:col-span-3 bg-stone-900 border border-white/5 p-5 space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-rose-400 mb-1">Statuts</p>
                      <h3 className="font-display text-lg text-stone-100">Mix</h3>
                    </div>
                    <div className="flex items-center justify-around gap-2">
                      {[
                        { label: 'Publiés', value: stats.published, total: Math.max(1, stats.total), color: '#ef3b3b' },
                        { label: 'À la une', value: stats.featured, total: Math.max(1, stats.total), color: '#f16464' },
                      ].map((ring) => {
                        const pct = Math.round((ring.value / ring.total) * 100);
                        const r = 28;
                        const c = 2 * Math.PI * r;
                        const offset = c - (pct / 100) * c;
                        return (
                          <div key={ring.label} className="flex flex-col items-center gap-2">
                            <svg width="72" height="72" className="-rotate-90">
                              <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                              <circle
                                cx="36"
                                cy="36"
                                r={r}
                                fill="none"
                                stroke={ring.color}
                                strokeWidth="6"
                                strokeDasharray={c}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="text-[10px] text-stone-500 text-center">
                              {ring.label}
                              <br />
                              <strong className="text-stone-200">{pct}%</strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  {/* Recent articles */}
                  <div className="xl:col-span-7 bg-stone-900 border border-white/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg text-stone-100">Articles récents</h3>
                      <button type="button" onClick={() => goTab('articles')} className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer">
                        Voir tout
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {articles.slice(0, 5).map((article) => (
                        <div key={article.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-stone-200 truncate font-body">{article.title}</p>
                            <p className="text-[11px] text-stone-600">
                              {statusLabel[article.status]}
                              {article.category ? ` · ${article.category.name}` : ''}
                            </p>
                          </div>
                          <ActionsMenu
                            onEdit={() => openEdit(article)}
                            onDelete={() => setDeleteTarget(article)}
                          />
                        </div>
                      ))}
                      {articles.length === 0 && <p className="text-sm text-stone-600 py-6 text-center">Aucun article</p>}
                    </div>
                  </div>

                  {/* Mini calendar */}
                  <div className="xl:col-span-5 bg-stone-900 border border-white/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg text-stone-100">
                        {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </h3>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="p-1 text-stone-500 hover:text-stone-200 cursor-pointer"
                          onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="p-1 text-stone-500 hover:text-stone-200 cursor-pointer"
                          onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                        <span key={`${d}-${i}`} className="text-[10px] text-rose-400 py-1 font-body">
                          {d}
                        </span>
                      ))}
                      {calCells.map((cell, idx) => {
                        if (!cell) return <span key={idx} className="h-8" />;
                        const hits = scheduledDates.get(cell.date.toDateString()) || [];
                        const hasScheduled = hits.some((a) => a.status === 'scheduled');
                        const hasPublished = hits.some((a) => a.status === 'published');
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => goTab('calendar')}
                            className={`h-8 text-xs font-body rounded-full transition cursor-pointer ${
                              hasScheduled
                                ? 'bg-rose-500 text-stone-950'
                                : hasPublished
                                  ? 'bg-rose-500/30 text-rose-200'
                                  : 'text-stone-400 hover:bg-white/5'
                            }`}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-stone-600 font-body">
                      <span className="text-rose-400">●</span> Programmé &nbsp;
                      <span className="text-rose-300/60">●</span> Publié
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ARTICLES */}
            {tab === 'articles' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-1">Contenu</p>
                    <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Articles</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex border border-white/10 bg-stone-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => setArticlesView('list')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-body transition cursor-pointer ${
                          articlesView === 'list'
                            ? 'bg-rose-500 text-stone-950'
                            : 'text-stone-500 hover:text-stone-200'
                        }`}
                        aria-label="Vue liste"
                        title="Liste"
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                        Liste
                      </button>
                      <button
                        type="button"
                        onClick={() => setArticlesView('cards')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-body transition cursor-pointer ${
                          articlesView === 'cards'
                            ? 'bg-rose-500 text-stone-950'
                            : 'text-stone-500 hover:text-stone-200'
                        }`}
                        aria-label="Vue cartes"
                        title="Cartes"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Cards
                      </button>
                    </div>
                    <button type="button" onClick={openCreate} className="btn-primary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Nouvel article
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p className="text-stone-500 text-sm">Chargement…</p>
                ) : filteredArticles.length === 0 ? (
                  <p className="py-12 text-center text-stone-500 text-sm">Aucun article trouvé.</p>
                ) : articlesView === 'list' ? (
                  <div className="bg-stone-900 border border-white/5 divide-y divide-white/5">
                    {filteredArticles.map((article) => (
                      <div key={article.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                        <div className="flex items-start gap-4 min-w-0">
                          {article.coverImage ? (
                            <img
                              src={mediaUrl(article.coverImage)}
                              alt=""
                              className="w-16 h-12 object-cover border border-white/10 shrink-0 hidden sm:block"
                            />
                          ) : (
                            <div className="w-16 h-12 bg-stone-850 border border-white/10 shrink-0 hidden sm:block" />
                          )}
                          <div className="space-y-1 min-w-0">
                            <p className="font-display text-stone-100 truncate">{article.title}</p>
                            <p className="text-xs text-stone-600 font-body">
                              {statusLabel[article.status]}
                              {article.publishedAt ? ` · ${formatBlogDate(article.publishedAt)}` : ''}
                              {article.category ? ` · ${article.category.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ActionsMenu
                            onEdit={() => openEdit(article)}
                            onDelete={() => setDeleteTarget(article)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredArticles.map((article) => (
                      <article
                        key={article.id}
                        className="group bg-stone-900 border border-white/5 overflow-hidden flex flex-col hover:border-rose-500/30 transition"
                      >
                        <div className="relative aspect-[16/10] bg-stone-850 overflow-hidden">
                          {article.coverImage ? (
                            <img
                              src={mediaUrl(article.coverImage)}
                              alt=""
                              className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-stone-900 to-stone-800" />
                          )}
                          <div className="absolute top-3 right-3">
                            <div className="bg-stone-950/80 border border-white/10">
                              <ActionsMenu
                                onEdit={() => openEdit(article)}
                                onDelete={() => setDeleteTarget(article)}
                              />
                            </div>
                          </div>
                          <span
                            className={`absolute top-3 left-3 text-[10px] uppercase tracking-wider px-2 py-1 font-body ${
                              article.status === 'published'
                                ? 'bg-rose-500 text-stone-950'
                                : article.status === 'scheduled'
                                  ? 'bg-amber-500/90 text-stone-950'
                                  : 'bg-stone-800 text-stone-300'
                            }`}
                          >
                            {statusLabel[article.status]}
                          </span>
                        </div>
                        <div className="p-4 space-y-3 flex-1 flex flex-col">
                          {article.category && (
                            <p className="text-[11px] uppercase tracking-wider text-rose-400 font-body">
                              {article.category.name}
                            </p>
                          )}
                          <h3 className="font-display text-lg text-stone-100 leading-snug line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-xs text-stone-500 font-body leading-relaxed line-clamp-2 flex-1">
                            {article.excerpt || 'Aucun résumé'}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] text-stone-600 font-body">
                            <span>{article.author}</span>
                            <span>
                              {article.publishedAt
                                ? formatBlogDate(article.publishedAt)
                                : article.scheduledAt
                                  ? formatBlogDate(article.scheduledAt)
                                  : '—'}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CATEGORIES */}
            {tab === 'categories' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-1">Organisation</p>
                    <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Catégories</h1>
                  </div>
                  <button type="button" onClick={openCreateCategory} className="btn-primary text-xs">
                    <Plus className="w-3.5 h-3.5" /> Nouvelle catégorie
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => {
                    const count = articles.filter((a) => a.categoryId === cat.id || a.category?.id === cat.id).length;
                    return (
                      <div key={cat.id} className="bg-stone-900 border border-white/5 p-5 space-y-2 relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <h3 className="font-display text-lg text-stone-100">{cat.name}</h3>
                            <p className="text-[11px] text-stone-600 font-mono truncate">/{cat.slug}</p>
                          </div>
                          <ActionsMenu
                            onEdit={() => openEditCategory(cat)}
                            onDelete={() => setDeleteCategoryTarget(cat)}
                          />
                        </div>
                        <p className="text-xs text-stone-600 font-body leading-relaxed">{cat.description || 'Aucune description'}</p>
                        <p className="text-sm text-rose-400 font-body pt-2">
                          {count} article{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  })}
                  {categories.length === 0 && (
                    <p className="text-sm text-stone-500 col-span-full py-8 text-center">Aucune catégorie.</p>
                  )}
                </div>
              </div>
            )}

            {/* COMMENTS */}
            {tab === 'comments' && (
              <div className="space-y-6">
                <div>
                  <p className="section-label mb-1">Modération</p>
                  <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Commentaires</h1>
                  <p className="text-sm text-stone-500 font-body mt-2">
                    {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-stone-900 border border-white/5 divide-y divide-white/5">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 font-body">
                          <span className="text-stone-300">{comment.author}</span>
                          {comment.parentId && (
                            <span className="text-rose-400/70">réponse</span>
                          )}
                          <span>·</span>
                          <span>{formatBlogDate(comment.createdAt)}</span>
                          {(comment.likes ?? 0) > 0 && (
                            <>
                              <span>·</span>
                              <span>{comment.likes} j’aime</span>
                            </>
                          )}
                          {comment.articleTitle && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400/80 truncate">{comment.articleTitle}</span>
                            </>
                          )}
                        </div>
                        <p className={`text-sm text-stone-400 font-body leading-relaxed whitespace-pre-wrap ${comment.parentId ? 'pl-3 border-l border-white/10' : ''}`}>
                          {comment.content}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 px-3 py-2 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="py-12 text-center text-stone-500 text-sm">Aucun commentaire pour le moment.</p>
                  )}
                </div>
              </div>
            )}

            {/* NEWSLETTER */}
            {tab === 'newsletter' && token && (
              <NewsletterAdminPanel token={token} onMessage={setMessage} />
            )}

            {tab === 'site-content' && token && (
              <SiteContentPanel token={token} onMessage={setMessage} />
            )}

            {/* CALENDAR */}
            {tab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-1">Planning</p>
                    <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Calendrier éditorial</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs py-2 px-3"
                      onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                    >
                      Mois précédent
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs py-2 px-3"
                      onClick={() => setCalMonth(new Date())}
                    >
                      Aujourd'hui
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs py-2 px-3"
                      onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                    >
                      Mois suivant
                    </button>
                  </div>
                </div>

                <div className="bg-stone-900 border border-white/5 p-5 lg:p-8">
                  <h3 className="font-display text-xl text-stone-100 mb-6 capitalize">
                    {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                      <div key={d} className="text-center text-[11px] uppercase tracking-wider text-rose-400 py-2">
                        {d}
                      </div>
                    ))}
                    {calCells.map((cell, idx) => {
                      if (!cell) return <div key={idx} className="min-h-24 border border-transparent" />;
                      const hits = scheduledDates.get(cell.date.toDateString()) || [];
                      return (
                        <div key={idx} className="min-h-24 border border-white/5 bg-stone-950/50 p-2 space-y-1">
                          <span className="text-xs text-stone-500">{cell.day}</span>
                          {hits.slice(0, 2).map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => openEdit(a)}
                              className={`block w-full text-left text-[10px] truncate px-1.5 py-1 cursor-pointer ${
                                a.status === 'scheduled'
                                  ? 'bg-rose-500 text-stone-950'
                                  : 'bg-rose-500/20 text-rose-200'
                              }`}
                            >
                              {a.title}
                            </button>
                          ))}
                          {hits.length > 2 && (
                            <span className="text-[10px] text-stone-600">+{hits.length - 2}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-stone-900 border border-white/5 p-4 flex items-center gap-3 text-sm text-stone-500">
                  <Shield className="w-4 h-4 text-rose-500 shrink-0" />
                  Les dates programmées et publiées apparaissent ici. Cliquez un article pour le modifier.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal création / modification */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Fermer"
            onClick={closeFormModal}
          />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-stone-900 border border-white/10 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-stone-900/95 backdrop-blur border-b border-white/5 px-5 py-4">
              <h2 className="font-display text-xl text-stone-100">
                {editingId ? "Modifier l'article" : 'Créer un article'}
              </h2>
              <button type="button" onClick={closeFormModal} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 lg:p-6 space-y-6">
              {message && (
                <div className="text-sm text-rose-400 font-body border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                  {message}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <label className="space-y-2 block lg:col-span-2">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Titre</span>
                  <input
                    value={form.title}
                    onChange={(e) => updateTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                  />
                </label>

                <label className="space-y-2 block lg:col-span-2">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Résumé</span>
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    rows={2}
                    className="w-full bg-transparent border border-white/10 p-3 text-stone-100 focus:outline-none focus:border-rose-500/50 text-sm"
                  />
                </label>

                <div className="space-y-2 block lg:col-span-2">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Contenu</span>
                  <RichTextEditor
                    key={editingId || 'new'}
                    value={form.content}
                    onChange={(content) => setForm({ ...form, content })}
                    placeholder="Écrivez votre article… gras, italique, titres, listes, images…"
                    onUploadImage={async (file) => {
                      try {
                        return await uploadImage(token, file);
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : 'Upload image échoué');
                        throw err;
                      }
                    }}
                  />
                </div>

                <label className="space-y-2 block">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Auteur</span>
                  <input
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                  />
                </label>

                <label className="space-y-2 block lg:col-span-2">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Titre / fonction</span>
                  <input
                    value={form.authorTitle}
                    onChange={(e) => setForm({ ...form, authorTitle: e.target.value })}
                    placeholder="Founder & CEO – Yolo Group | …"
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50 text-sm"
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Catégorie</span>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full bg-stone-950 border border-white/10 py-2 px-3 text-stone-100 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 block">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Tags (virgules)</span>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Vidéo YouTube</span>
                  <input
                    value={form.youtubeUrl}
                    onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                    placeholder="URL ou embed"
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                  />
                </label>

                <div className="space-y-3">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Image de couverture</span>
                  <input
                    value={form.coverImage}
                    onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                    placeholder="URL"
                    className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                  />
                  <label className="btn-ghost text-xs inline-flex cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    {uploading ? 'Upload…' : 'Téléverser'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, 'cover');
                      }}
                    />
                  </label>
                  {form.coverImage && (
                    <img src={mediaUrl(form.coverImage)} alt="" className="h-24 object-cover border border-white/10" />
                  )}
                </div>

                <div className="space-y-3">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Galerie</span>
                  <label className="btn-ghost text-xs inline-flex cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" /> Ajouter des images
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, 'gallery');
                      }}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {form.gallery.map((src) => (
                      <div key={src} className="relative">
                        <img src={mediaUrl(src)} alt="" className="h-16 w-20 object-cover border border-white/10" />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, gallery: form.gallery.filter((g) => g !== src) })}
                          className="absolute -top-1 -right-1 bg-stone-950 text-stone-300 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="space-y-2 block">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Statut</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BlogArticleStatus })}
                    className="w-full bg-stone-950 border border-white/10 py-2 px-3 text-stone-100"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="scheduled">Programmé</option>
                    <option value="published">Publié</option>
                  </select>
                </label>

                {form.status === 'scheduled' && (
                  <DateTimePicker
                    label="Date de publication"
                    value={form.scheduledAt}
                    onChange={(scheduledAt) => setForm({ ...form, scheduledAt })}
                    min={new Date()}
                  />
                )}

                <label className="flex items-center gap-3 text-sm text-stone-400 pt-6">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    className="accent-rose-500"
                  />
                  <Star className="w-3.5 h-3.5 text-rose-400" />
                  Mettre à la une
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
                <button type="button" disabled={saving} onClick={() => handleSave()} className="btn-primary text-xs">
                  <Save className="w-3.5 h-3.5" /> {editingId ? 'Enregistrer' : 'Créer'}
                </button>
                <button type="button" disabled={saving} onClick={() => handleSave('draft')} className="btn-ghost text-xs">
                  Brouillon
                </button>
                <button type="button" disabled={saving} onClick={() => handleSave('schedule')} className="btn-ghost text-xs">
                  <Clock className="w-3.5 h-3.5" /> Programmer
                </button>
                <button type="button" disabled={saving} onClick={() => handleSave('publish')} className="btn-ghost text-xs">
                  <Send className="w-3.5 h-3.5" /> Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Fermer"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md bg-stone-900 border border-white/10 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="section-label">Suppression</p>
                <h3 className="font-display text-xl text-stone-100">Supprimer cet article ?</h3>
                <p className="text-sm text-stone-500 font-body leading-relaxed">
                  « {deleteTarget.title} » sera définitivement supprimé. Cette action est irréversible.
                </p>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost text-xs" disabled={deleting}>
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal catégorie */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Fermer"
            onClick={() => setShowCategoryModal(false)}
          />
          <div className="relative w-full max-w-md bg-stone-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
              <h2 className="font-display text-xl text-stone-100">
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h2>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <label className="space-y-2 block">
                <span className="text-xs text-stone-500 uppercase tracking-wider">Nom</span>
                <input
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm((prev) => ({
                      ...prev,
                      name,
                      slug: editingCategory ? prev.slug : slugify(name),
                    }));
                  }}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-stone-100 focus:outline-none focus:border-rose-500/50"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-xs text-stone-500 uppercase tracking-wider">Description</span>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-transparent border border-white/10 p-3 text-stone-100 focus:outline-none focus:border-rose-500/50 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-ghost text-xs" disabled={savingCategory}>
                  Annuler
                </button>
                <button type="button" onClick={saveCategory} disabled={savingCategory} className="btn-primary text-xs">
                  {savingCategory ? 'Enregistrement…' : editingCategory ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression catégorie */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Fermer"
            onClick={() => setDeleteCategoryTarget(null)}
          />
          <div className="relative w-full max-w-md bg-stone-900 border border-white/10 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="section-label">Suppression</p>
                <h3 className="font-display text-xl text-stone-100">Supprimer cette catégorie ?</h3>
                <p className="text-sm text-stone-500 font-body leading-relaxed">
                  « {deleteCategoryTarget.name} » sera définitivement supprimée.
                  Impossible si des articles y sont encore liés.
                </p>
              </div>
              <button type="button" onClick={() => setDeleteCategoryTarget(null)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button type="button" onClick={() => setDeleteCategoryTarget(null)} className="btn-ghost text-xs" disabled={deletingCategory}>
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={deletingCategory}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingCategory ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
