import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail,
  Send,
  Trash2,
  UserX,
  UserCheck,
  Download,
  Megaphone,
  LayoutTemplate,
  Users,
  Plus,
  Clock,
  Pencil,
} from 'lucide-react';
import type { EmailCampaign, EmailTemplate, NewsletterStats, NewsletterSubscriber } from '../types';
import {
  createEmailCampaign,
  deleteEmailCampaign,
  deleteEmailTemplate,
  deleteNewsletterSubscriber,
  fetchEmailCampaigns,
  fetchEmailOverview,
  fetchEmailTemplates,
  fetchNewsletterSubscribers,
  sendEmailCampaignById,
  setNewsletterSubscriberActive,
  updateEmailCampaign,
  updateEmailTemplate,
} from '../services/newsletterApi';
import { formatBlogDate } from '../services/api';
import EmailContentEditor, {
  CAMPAIGN_MERGE_TOKENS,
  decorateEmailHtml,
  MergeSubjectField,
  tokensForTemplate,
} from './EmailContentEditor';

type Props = {
  token: string;
  onMessage: (msg: string | null) => void;
};

type SubTab = 'overview' | 'audience' | 'campaigns' | 'templates';

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_CAMPAIGN_HTML = '<p>Bonjour {{firstName}},</p>\n<p>Votre annonce Bany Official ici…</p>';

type EmailMarketingRecent = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt?: string | null;
  stats?: EmailCampaign['stats'];
};

export default function NewsletterAdminPanel({ token, onMessage }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [items, setItems] = useState<NewsletterSubscriber[]>([]);
  const [stats, setStats] = useState<NewsletterStats>({ total: 0, active: 0, inactive: 0 });
  const [sources, setSources] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [recent, setRecent] = useState<EmailMarketingRecent[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterQ, setFilterQ] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignHtml, setCampaignHtml] = useState(EMPTY_CAMPAIGN_HTML);
  const [campaignSchedule, setCampaignSchedule] = useState('');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const templateEditorRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!editingCampaignId || subTab !== 'campaigns') return;
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingCampaignId, subTab]);

  useEffect(() => {
    if (!editingTemplate || subTab !== 'templates') return;
    templateEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingTemplate, subTab]);

  const load = async () => {
    setLoading(true);
    try {
      const [overview, subs, camps, tpls] = await Promise.all([
        fetchEmailOverview(token),
        fetchNewsletterSubscribers(token, {
          q: filterQ || undefined,
          source: filterSource || undefined,
        }),
        fetchEmailCampaigns(token),
        fetchEmailTemplates(token),
      ]);
      setStats(overview.audience);
      setRecent(overview.recentCampaigns || []);
      setItems(subs.items);
      setSources(subs.meta?.sources || []);
      setCampaigns(camps.items);
      setTemplates(tpls.items);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur chargement email marketing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const statusLabel = useMemo(
    () =>
      ({
        draft: 'Brouillon',
        scheduled: 'Planifiée',
        sending: 'Envoi…',
        sent: 'Envoyée',
        failed: 'Échec',
        cancelled: 'Annulée',
      }) as Record<string, string>,
    []
  );

  const handleToggle = async (sub: NewsletterSubscriber) => {
    try {
      await setNewsletterSubscriberActive(token, sub.id, !sub.active);
      await load();
      onMessage(null);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet abonné ?')) return;
    try {
      await deleteNewsletterSubscriber(token, id);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const exportCsv = () => {
    const rows = [
      ['email', 'firstName', 'source', 'tags', 'active', 'subscribedAt'],
      ...items.map((s) => [
        s.email,
        s.firstName || '',
        s.source,
        (s.tags || []).join('|'),
        String(s.active),
        s.subscribedAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bany-audience-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetCampaignForm = () => {
    setEditingCampaignId(null);
    setCampaignName('');
    setCampaignSubject('');
    setCampaignHtml(EMPTY_CAMPAIGN_HTML);
    setCampaignSchedule('');
  };

  const startEditCampaign = (campaign: EmailCampaign, asCopy = false) => {
    setEditingCampaignId(asCopy ? null : campaign.id);
    setCampaignName(asCopy ? `${campaign.name} (copie)` : campaign.name);
    setCampaignSubject(campaign.subject);
    setCampaignHtml(campaign.htmlContent || EMPTY_CAMPAIGN_HTML);
    setCampaignSchedule(asCopy ? '' : toDatetimeLocal(campaign.scheduledAt));
    setSubTab('campaigns');
    onMessage(asCopy ? `Copie de « ${campaign.name} » prête à modifier` : `Modification de « ${campaign.name} »`);
  };

  const handleCreateCampaign = async (mode: 'draft' | 'send' | 'schedule') => {
    if (!campaignName.trim() || !campaignSubject.trim() || !campaignHtml.trim()) {
      onMessage('Nom, sujet et contenu requis');
      return;
    }
    setSavingCampaign(true);
    onMessage(null);
    try {
      const payload: {
        name: string;
        subject: string;
        htmlContent: string;
        status?: 'draft' | 'scheduled';
        scheduledAt?: string | null;
        segment: { activeOnly: boolean; sources: string[]; tags: string[] };
      } = {
        name: campaignName.trim(),
        subject: campaignSubject.trim(),
        htmlContent: decorateEmailHtml(campaignHtml),
        segment: { activeOnly: true, sources: [], tags: [] },
      };
      if (mode === 'schedule') {
        payload.status = 'scheduled';
        payload.scheduledAt = new Date(campaignSchedule).toISOString();
      } else if (!editingCampaignId || !campaignSchedule) {
        payload.status = 'draft';
        payload.scheduledAt = null;
      } else {
        payload.scheduledAt = new Date(campaignSchedule).toISOString();
      }
      const saved = editingCampaignId
        ? await updateEmailCampaign(token, editingCampaignId, payload)
        : await createEmailCampaign(token, payload);

      if (mode === 'send') {
        const result = await sendEmailCampaignById(token, saved.id);
        onMessage(`Campagne envoyée : ${result.sent} OK / ${result.failed} échec(s)`);
      } else if (mode === 'schedule') {
        onMessage(editingCampaignId ? 'Campagne mise à jour et planifiée' : 'Campagne planifiée');
      } else {
        onMessage(editingCampaignId ? 'Campagne mise à jour' : 'Brouillon enregistré');
      }

      resetCampaignForm();
      await load();
      setSubTab('campaigns');
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur campagne');
    } finally {
      setSavingCampaign(false);
    }
  };

  const startEditTemplate = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setTemplateName(tpl.name);
    setTemplateSubject(tpl.subject);
    setTemplateHtml(tpl.htmlBody);
    setSubTab('templates');
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!templateName.trim() || !templateSubject.trim() || !templateHtml.trim()) {
      onMessage('Nom, sujet et contenu requis');
      return;
    }
    setSavingTemplate(true);
    onMessage(null);
    try {
      await updateEmailTemplate(token, editingTemplate.id, {
        name: templateName.trim(),
        subject: templateSubject.trim(),
        htmlBody: decorateEmailHtml(templateHtml),
      });
      onMessage(`Template « ${templateName.trim()} » enregistré`);
      setEditingTemplate(null);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendExisting = async (id: string) => {
    if (!window.confirm('Envoyer cette campagne maintenant à tous les abonnés actifs ?')) return;
    setSendingId(id);
    try {
      const result = await sendEmailCampaignById(token, id);
      onMessage(`Campagne envoyée : ${result.sent} OK / ${result.failed} échec(s)`);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Échec envoi');
    } finally {
      setSendingId(null);
    }
  };

  const handleScheduleExisting = async (id: string) => {
    const when = window.prompt('Date/heure ISO (ex: 2026-07-28T18:00)', new Date().toISOString().slice(0, 16));
    if (!when) return;
    try {
      await updateEmailCampaign(token, id, {
        status: 'scheduled',
        scheduledAt: new Date(when).toISOString(),
      });
      onMessage('Campagne planifiée');
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Supprimer cette campagne ?')) return;
    try {
      await deleteEmailCampaign(token, id);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteTemplate = async (id: string, isSystem?: boolean) => {
    if (isSystem) {
      onMessage('Les templates système ne peuvent pas être supprimés');
      return;
    }
    if (!window.confirm('Supprimer ce template ?')) return;
    try {
      await deleteEmailTemplate(token, id);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setCampaignSubject(tpl.subject.includes('{{') ? tpl.subject.replace(/\{\{.*?\}\}/g, '').trim() || tpl.name : tpl.subject);
    setCampaignHtml(tpl.htmlBody);
    setCampaignName(`Campagne — ${tpl.name}`);
    setSubTab('campaigns');
    onMessage(`Template « ${tpl.name} » chargé dans le compositeur`);
  };

  const tabs: { id: SubTab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Vue d’ensemble', icon: Megaphone },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'campaigns', label: 'Campagnes', icon: Send },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="section-label mb-1">Email Marketing</p>
        <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Bany Mail</h1>
        <p className="text-sm text-stone-500 font-body mt-2 max-w-2xl">
          Plateforme d’emailing Bany Official : audience, templates de marque, campagnes planifiées et
          notifications automatiques à la publication d’articles.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-body uppercase tracking-wider transition cursor-pointer ${
              subTab === id
                ? 'text-rose-400 border-b-2 border-rose-500'
                : 'text-stone-500 hover:text-stone-300 border-b-2 border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-stone-500 py-8 text-center">Chargement…</p>}

      {!loading && subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Abonnés actifs', value: stats.active },
              { label: 'Audience totale', value: stats.total },
              { label: 'Templates', value: templates.length },
            ].map((card) => (
              <div key={card.label} className="bg-stone-900 border border-white/5 p-5 space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-rose-400 font-body">{card.label}</p>
                <p className="font-display text-3xl text-stone-100">{card.value.toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>

          <div className="bg-stone-900 border border-white/5 p-5 space-y-4">
            <h2 className="font-display text-lg text-stone-100">Dernières campagnes</h2>
            {recent.length === 0 && <p className="text-sm text-stone-500">Aucune campagne pour l’instant.</p>}
            {recent.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 border-t border-white/5 first:border-0">
                <div>
                  <p className="text-sm text-stone-200">{c.name}</p>
                  <p className="text-xs text-stone-600">
                    {statusLabel[c.status] || c.status}
                    {c.stats ? ` · ${c.stats.sent}/${c.stats.recipients} envoyés` : ''}
                  </p>
                </div>
                <button type="button" className="text-xs text-rose-400 cursor-pointer" onClick={() => setSubTab('campaigns')}>
                  Voir
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSubTab('campaigns')}
              className="bg-rose-500 text-stone-950 font-body text-sm font-semibold px-4 py-4 text-left cursor-pointer hover:bg-rose-400 transition"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Créer une campagne
            </button>
            <button
              type="button"
              onClick={() => setSubTab('audience')}
              className="border border-white/10 text-stone-300 font-body text-sm px-4 py-4 text-left cursor-pointer hover:border-rose-500/40 transition"
            >
              <Users className="w-4 h-4 inline mr-2" />
              Gérer l’audience
            </button>
          </div>
        </div>
      )}

      {!loading && subTab === 'audience' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <input
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Rechercher un email…"
                className="bg-transparent border-b border-white/10 py-2 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50 min-w-[200px]"
              />
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-stone-900 border border-white/10 text-sm text-stone-300 px-3 py-2"
              >
                <option value="">Toutes les sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void load()} className="btn-ghost text-xs py-2 px-3">
                Filtrer
              </button>
            </div>
            <button type="button" onClick={exportCsv} className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="bg-stone-900 border border-white/5 divide-y divide-white/5">
            {items.map((sub) => (
              <div key={sub.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-stone-200 font-body truncate">
                    {sub.firstName ? `${sub.firstName} · ` : ''}
                    {sub.email}
                  </p>
                  <p className="text-xs text-stone-600 font-body">
                    {sub.source} · {formatBlogDate(sub.subscribedAt)}
                    {sub.active ? (
                      <span className="text-emerald-500/80"> · actif</span>
                    ) : (
                      <span className="text-stone-500"> · désabonné</span>
                    )}
                    {(sub.tags || []).length > 0 && <> · {(sub.tags || []).join(', ')}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(sub)}
                    className="text-xs text-stone-400 hover:text-stone-200 inline-flex items-center gap-1.5 px-3 py-2 cursor-pointer"
                  >
                    {sub.active ? (
                      <>
                        <UserX className="w-3.5 h-3.5" /> Désactiver
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" /> Réactiver
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSub(sub.id)}
                    className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 px-3 py-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="py-12 text-center text-stone-500 text-sm">Aucun abonné pour le moment.</p>
            )}
          </div>
        </div>
      )}

      {!loading && subTab === 'campaigns' && (
        <div className="space-y-8">
          <form
            ref={composerRef}
            className="bg-stone-900 border border-white/5 p-5 sm:p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateCampaign('draft');
            }}
          >
            <div className="flex items-center justify-between gap-3 text-stone-300">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-rose-400" />
                <h2 className="font-display text-lg">
                  {editingCampaignId ? 'Modifier la campagne' : 'Compositeur de campagne'}
                </h2>
              </div>
              {editingCampaignId && (
                <button type="button" onClick={resetCampaignForm} className="text-xs text-stone-500 hover:text-stone-200 cursor-pointer">
                  Nouvelle campagne
                </button>
              )}
            </div>
            <p className="text-xs text-stone-600">
              Vous modifiez le texte du mail. Les pastilles colorées sont des variables protégées : elles ne peuvent pas être coupées.
            </p>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Nom interne de la campagne"
              className="w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50"
            />
            <MergeSubjectField
              value={campaignSubject}
              onChange={setCampaignSubject}
              placeholder="Sujet de l’email"
              tokens={CAMPAIGN_MERGE_TOKENS}
            />
            <EmailContentEditor
              value={campaignHtml}
              onChange={setCampaignHtml}
              tokens={CAMPAIGN_MERGE_TOKENS}
              placeholder="Écrivez le message de la campagne…"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={campaignSchedule}
                onChange={(e) => setCampaignSchedule(e.target.value)}
                className="bg-stone-950 border border-white/10 text-sm text-stone-300 px-3 py-2"
              />
              <button
                type="button"
                disabled={savingCampaign}
                onClick={() => void handleCreateCampaign('draft')}
                className="btn-ghost text-xs py-2 px-3"
              >
                {savingCampaign ? '…' : editingCampaignId ? 'Enregistrer' : 'Sauver brouillon'}
              </button>
              <button
                type="button"
                disabled={savingCampaign || !campaignSchedule}
                onClick={() => void handleCreateCampaign('schedule')}
                className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" /> Planifier
              </button>
              <button
                type="button"
                disabled={savingCampaign || stats.active === 0}
                onClick={() => void handleCreateCampaign('send')}
                className="btn-primary text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                {savingCampaign ? '…' : `Envoyer à ${stats.active}`}
              </button>
            </div>
          </form>

          <div className="bg-stone-900 border border-white/5 divide-y divide-white/5">
            <div className="p-4">
              <h3 className="font-display text-base text-stone-100">Historique</h3>
            </div>
            {campaigns.map((c) => (
              <div key={c.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-stone-200">{c.name}</p>
                  <p className="text-xs text-stone-600">
                    {c.subject} · {statusLabel[c.status] || c.status}
                    {c.stats ? ` · ${c.stats.sent}/${c.stats.recipients}` : ''}
                    {c.scheduledAt ? ` · planifiée ${formatBlogDate(c.scheduledAt)}` : ''}
                    {c.sentAt ? ` · envoyée ${formatBlogDate(c.sentAt)}` : ''}
                  </p>
                  {c.errorMessage && <p className="text-xs text-rose-400">{c.errorMessage}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status !== 'sending' && (
                  <button
                    type="button"
                    onClick={() => startEditCampaign(c, c.status === 'sent')}
                    className="text-xs text-stone-200 px-3 py-2 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {c.status === 'sent' ? 'Réutiliser' : 'Modifier'}
                  </button>
                  )}
                  {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && (
                    <>
                      <button
                        type="button"
                        disabled={sendingId === c.id}
                        onClick={() => void handleSendExisting(c.id)}
                        className="text-xs text-rose-400 px-3 py-2 cursor-pointer"
                      >
                        Envoyer
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleScheduleExisting(c.id)}
                        className="text-xs text-stone-400 px-3 py-2 cursor-pointer"
                      >
                        Planifier
                      </button>
                    </>
                  )}
                  {c.status !== 'sending' && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteCampaign(c.id)}
                      className="text-xs text-red-400 px-3 py-2 cursor-pointer"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <p className="py-10 text-center text-stone-500 text-sm">Aucune campagne.</p>
            )}
          </div>
        </div>
      )}

      {!loading && subTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-sm text-stone-500 font-body">
            Ces modèles servent au message de bienvenue, aux articles et aux campagnes. Le texte se modifie directement,
            les variables restent protégées.
          </p>
          {editingTemplate && (
            <form
              ref={templateEditorRef}
              className="bg-stone-900 border border-white/5 p-5 sm:p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveTemplate();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg text-stone-100">Modifier « {editingTemplate.name} »</h2>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="text-xs text-stone-500 hover:text-stone-200 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nom du template"
                className="w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50"
              />
              <MergeSubjectField
                value={templateSubject}
                onChange={setTemplateSubject}
                placeholder="Sujet de l’email"
                tokens={tokensForTemplate(editingTemplate.category, templateSubject, templateHtml)}
              />
              <EmailContentEditor
                value={templateHtml}
                onChange={setTemplateHtml}
                tokens={tokensForTemplate(editingTemplate.category, templateSubject, templateHtml)}
                placeholder="Écrivez le message…"
              />
              <button type="submit" disabled={savingTemplate} className="btn-primary text-xs">
                {savingTemplate ? 'Enregistrement…' : 'Enregistrer le template'}
              </button>
            </form>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-stone-900 border border-white/5 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-stone-100">{tpl.name}</p>
                    <p className="text-xs text-stone-600 uppercase tracking-wider">{tpl.category}</p>
                  </div>
                  {tpl.isSystem && (
                    <span className="text-[10px] uppercase tracking-wider text-rose-400/80">Système</span>
                  )}
                </div>
                <p className="text-sm text-stone-400 truncate">{tpl.subject}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEditTemplate(tpl)} className="btn-primary text-xs">
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="btn-ghost text-xs py-2 px-3"
                  >
                    Utiliser
                  </button>
                  {!tpl.isSystem && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteTemplate(tpl.id, tpl.isSystem)}
                      className="text-xs text-red-400 px-3 py-2 cursor-pointer"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
