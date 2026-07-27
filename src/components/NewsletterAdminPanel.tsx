import React, { useEffect, useState } from 'react';
import { Mail, Send, Trash2, UserX, UserCheck, Download } from 'lucide-react';
import type { NewsletterStats, NewsletterSubscriber } from '../types';
import {
  deleteNewsletterSubscriber,
  fetchNewsletterSubscribers,
  sendNewsletterCampaign,
  setNewsletterSubscriberActive,
} from '../services/newsletterApi';
import { formatBlogDate } from '../services/api';

type Props = {
  token: string;
  onMessage: (msg: string | null) => void;
};

export default function NewsletterAdminPanel({ token, onMessage }: Props) {
  const [items, setItems] = useState<NewsletterSubscriber[]>([]);
  const [stats, setStats] = useState<NewsletterStats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchNewsletterSubscribers(token);
      setItems(data.items);
      setStats(data.stats);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur chargement newsletter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const handleToggle = async (sub: NewsletterSubscriber) => {
    try {
      await setNewsletterSubscriberActive(token, sub.id, !sub.active);
      await load();
      onMessage(null);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet abonné ?')) return;
    try {
      await deleteNewsletterSubscriber(token, id);
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      onMessage('Sujet et message requis');
      return;
    }
    if (!window.confirm(`Envoyer cette newsletter à ${stats.active} abonné(s) actif(s) ?`)) return;

    setSending(true);
    onMessage(null);
    try {
      const result = await sendNewsletterCampaign(token, {
        subject: subject.trim(),
        message: message.trim(),
      });
      onMessage(`Newsletter envoyée : ${result.sent} OK, ${result.failed} échec(s)`);
      setSubject('');
      setMessageText('');
      await load();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Échec envoi');
    } finally {
      setSending(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['email', 'source', 'active', 'subscribedAt', 'lastNotifiedAt'],
      ...items.map((s) => [
        s.email,
        s.source,
        String(s.active),
        s.subscribedAt,
        s.lastNotifiedAt || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bany-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label mb-1">Abonnés</p>
          <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Newsletter</h1>
          <p className="text-sm text-stone-500 font-body mt-2">
            Les abonnés sont notifiés automatiquement à chaque nouvel article publié. Tu peux aussi envoyer une annonce manuelle (épisodes, studio, etc.).
          </p>
        </div>
        <button type="button" onClick={exportCsv} className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-2">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Actifs', value: stats.active },
          { label: 'Désabonnés', value: stats.inactive },
        ].map((card) => (
          <div key={card.label} className="bg-stone-900 border border-white/5 p-5 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-rose-400 font-body">{card.label}</p>
            <p className="font-display text-3xl text-stone-100">{card.value.toLocaleString('fr-FR')}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="bg-stone-900 border border-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-stone-300">
          <Mail className="w-4 h-4 text-rose-400" />
          <h2 className="font-display text-lg">Envoyer une annonce</h2>
        </div>
        <label className="block space-y-2">
          <span className="text-[11px] uppercase tracking-wider text-stone-600 font-body">Sujet</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50"
            placeholder="Nouvel épisode Bany Talks — …"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-[11px] uppercase tracking-wider text-stone-600 font-body">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessageText(e.target.value)}
            rows={6}
            className="w-full bg-transparent border border-white/10 px-4 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50 resize-y min-h-[140px] font-body"
            placeholder="Annoncez un épisode, un enregistrement studio, une ressource…"
          />
        </label>
        <button type="submit" disabled={sending || stats.active === 0} className="btn-primary text-xs">
          {sending ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-stone-950 border-t-transparent animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {sending ? 'Envoi…' : `Envoyer à ${stats.active} abonné(s)`}
        </button>
      </form>

      <div className="bg-stone-900 border border-white/5 divide-y divide-white/5">
        {loading && <p className="py-12 text-center text-stone-500 text-sm">Chargement…</p>}
        {!loading &&
          items.map((sub) => (
            <div
              key={sub.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-stone-200 font-body truncate">{sub.email}</p>
                <p className="text-xs text-stone-600 font-body">
                  {sub.source} · {formatBlogDate(sub.subscribedAt)}
                  {sub.active ? (
                    <span className="text-emerald-500/80"> · actif</span>
                  ) : (
                    <span className="text-stone-500"> · désabonné</span>
                  )}
                  {sub.lastNotifiedAt && <> · notifié {formatBlogDate(sub.lastNotifiedAt)}</>}
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
                  onClick={() => handleDelete(sub.id)}
                  className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 px-3 py-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        {!loading && items.length === 0 && (
          <p className="py-12 text-center text-stone-500 text-sm">Aucun abonné pour le moment.</p>
        )}
      </div>
    </div>
  );
}
