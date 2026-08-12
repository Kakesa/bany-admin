import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, BarChart3, ArrowUp, ArrowDown, Route, X } from 'lucide-react';
import {
  fetchSiteContent,
  updateSiteContent,
  type SiteStatistic,
  type TimelineMilestone,
} from '../services/api';

type Props = {
  token: string;
  onMessage: (msg: string | null) => void;
};

type SubTab = 'statistics' | 'timeline';
type AddModal = 'statistics' | 'timeline' | null;

const MONTHS = [
  { value: '', label: '— Année seule —' },
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];

const emptyStat = (): SiteStatistic => ({ label: '', value: '' });
const emptyMilestone = (): TimelineMilestone => ({
  year: String(new Date().getFullYear()),
  month: null,
  title: '',
  desc: '',
});

function sortTimelineLocal(items: TimelineMilestone[]) {
  return [...items].sort((a, b) => {
    const yearA = Number.parseInt(a.year, 10) || 0;
    const yearB = Number.parseInt(b.year, 10) || 0;
    if (yearA !== yearB) return yearA - yearB;
    return (a.month ?? 0) - (b.month ?? 0);
  });
}

const fieldClass =
  'w-full bg-stone-900 border border-white/10 px-3 py-2.5 text-sm text-stone-100 font-body focus:outline-none focus:border-rose-500/50';
const labelClass = 'block text-[10px] uppercase tracking-wider text-stone-600 font-body mb-1.5';

export default function SiteContentPanel({ token, onMessage }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('statistics');
  const [statistics, setStatistics] = useState<SiteStatistic[]>([]);
  const [timeline, setTimeline] = useState<TimelineMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModal, setAddModal] = useState<AddModal>(null);
  const [draftStat, setDraftStat] = useState<SiteStatistic>(emptyStat);
  const [draftMilestone, setDraftMilestone] = useState<TimelineMilestone>(emptyMilestone);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchSiteContent();
        if (!cancelled) {
          setStatistics(data.statistics || []);
          setTimeline(sortTimelineLocal(data.timeline || []));
        }
      } catch (err) {
        if (!cancelled) {
          onMessage(err instanceof Error ? err.message : 'Impossible de charger le contenu site');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onMessage]);

  useEffect(() => {
    if (!addModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addModal]);

  const openAddStatistics = () => {
    setDraftStat(emptyStat());
    setAddModal('statistics');
  };

  const openAddTimeline = () => {
    setDraftMilestone(emptyMilestone());
    setAddModal('timeline');
  };

  const closeAddModal = () => setAddModal(null);

  const confirmAddStatistics = () => {
    const label = draftStat.label.trim();
    const value = draftStat.value.trim();
    if (!label || !value) {
      onMessage('Valeur et libellé sont requis');
      return;
    }
    setStatistics((prev) => [...prev, { label, value }]);
    closeAddModal();
    onMessage(null);
  };

  const confirmAddTimeline = () => {
    const year = draftMilestone.year.trim();
    const title = draftMilestone.title.trim();
    const desc = draftMilestone.desc.trim();
    if (!year || !title || !desc) {
      onMessage('Année, titre et description sont requis');
      return;
    }
    setTimeline((prev) =>
      sortTimelineLocal([...prev, { year, month: draftMilestone.month, title, desc }])
    );
    closeAddModal();
    onMessage(null);
  };

  const updateStat = (index: number, field: keyof SiteStatistic, value: string) => {
    setStatistics((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const moveStat = (index: number, direction: -1 | 1) => {
    setStatistics((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateMilestone = (
    index: number,
    field: keyof TimelineMilestone,
    value: string | number | null
  ) => {
    setTimeline((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSaveStatistics = async () => {
    setSaving(true);
    onMessage(null);
    try {
      const data = await updateSiteContent(token, { statistics });
      setStatistics(data.statistics || []);
      onMessage('Chiffres clés enregistrés');
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTimeline = async () => {
    setSaving(true);
    onMessage(null);
    try {
      const data = await updateSiteContent(token, { timeline: sortTimelineLocal(timeline) });
      setTimeline(sortTimelineLocal(data.timeline || []));
      onMessage('Parcours enregistré (trié par année puis mois)');
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label mb-1">Contenu site</p>
          <h1 className="font-display text-2xl sm:text-3xl text-stone-100">À propos</h1>
          <p className="mt-2 text-sm text-stone-500 font-body max-w-xl">
            Chiffres clés et parcours affichés sur la page À propos du site public.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {(
          [
            { id: 'statistics' as const, label: 'Chiffres clés', icon: BarChart3 },
            { id: 'timeline' as const, label: 'Parcours', icon: Route },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-body transition cursor-pointer ${
              subTab === id
                ? 'text-stone-100 border-b-2 border-rose-500'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 font-body">Chargement…</p>
      ) : subTab === 'statistics' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn-ghost text-xs py-2 px-3" onClick={openAddStatistics}>
              <Plus className="w-3.5 h-3.5 inline mr-1.5" />
              Ajouter
            </button>
            <button
              type="button"
              className="btn-primary text-xs py-2 px-4"
              onClick={handleSaveStatistics}
              disabled={saving}
            >
              <Save className="w-3.5 h-3.5 inline mr-1.5" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          <div className="border border-white/8 divide-y divide-white/5">
            {statistics.length === 0 && (
              <div className="p-8 text-center text-stone-500 text-sm font-body">
                Aucun chiffre. Cliquez sur « Ajouter ».
              </div>
            )}
            {statistics.map((stat, index) => (
              <div key={index} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label className={labelClass}>Valeur</label>
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => updateStat(index, 'value', e.target.value)}
                    placeholder="450K+"
                    className={`${fieldClass} font-display`}
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className={labelClass}>Libellé</label>
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => updateStat(index, 'label', e.target.value)}
                    placeholder="Auditeurs Mensuels"
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    className="p-2 text-stone-500 hover:text-stone-200 transition disabled:opacity-30"
                    onClick={() => moveStat(index, -1)}
                    disabled={index === 0}
                    aria-label="Monter"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 text-stone-500 hover:text-stone-200 transition disabled:opacity-30"
                    onClick={() => moveStat(index, 1)}
                    disabled={index === statistics.length - 1}
                    aria-label="Descendre"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 text-stone-500 hover:text-rose-400 transition"
                    onClick={() => setStatistics((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500 font-body">
              L’ordre d’affichage suit automatiquement l’année puis le mois.
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost text-xs py-2 px-3" onClick={openAddTimeline}>
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                Ajouter une étape
              </button>
              <button
                type="button"
                className="btn-ghost text-xs py-2 px-3"
                onClick={() => setTimeline((prev) => sortTimelineLocal(prev))}
              >
                Trier maintenant
              </button>
              <button
                type="button"
                className="btn-primary text-xs py-2 px-4"
                onClick={handleSaveTimeline}
                disabled={saving}
              >
                <Save className="w-3.5 h-3.5 inline mr-1.5" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>

          <div className="border border-white/8 divide-y divide-white/5">
            {timeline.length === 0 && (
              <div className="p-8 text-center text-stone-500 text-sm font-body">
                Aucune étape. Cliquez sur « Ajouter une étape ».
              </div>
            )}
            {timeline.map((item, index) => (
              <div key={index} className="p-4 sm:p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Année</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.year}
                      onChange={(e) => updateMilestone(index, 'year', e.target.value)}
                      placeholder="2024"
                      className={`${fieldClass} font-display`}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelClass}>Mois (optionnel)</label>
                    <select
                      value={item.month == null ? '' : String(item.month)}
                      onChange={(e) =>
                        updateMilestone(
                          index,
                          'month',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      className={fieldClass}
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value || 'none'} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className={labelClass}>Titre</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                      placeholder="Studio Bany Talks"
                      className={fieldClass}
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      className="p-2 text-stone-500 hover:text-rose-400 transition"
                      onClick={() => setTimeline((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={item.desc}
                    onChange={(e) => updateMilestone(index, 'desc', e.target.value)}
                    rows={2}
                    placeholder="Décrivez cette étape du parcours…"
                    className={`${fieldClass} resize-y`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/70 cursor-pointer"
            onClick={closeAddModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg bg-stone-900 border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
              <div>
                <p className="section-label mb-1">Nouveau</p>
                <h2 className="font-display text-xl text-stone-100">
                  {addModal === 'statistics' ? 'Chiffre clé' : 'Étape du parcours'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-2 text-stone-500 hover:text-stone-200 hover:bg-white/5 transition cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {addModal === 'statistics' ? (
                <>
                  <div>
                    <label className={labelClass}>Valeur</label>
                    <input
                      type="text"
                      autoFocus
                      value={draftStat.value}
                      onChange={(e) => setDraftStat((d) => ({ ...d, value: e.target.value }))}
                      placeholder="450K+"
                      className={`${fieldClass} font-display`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Libellé</label>
                    <input
                      type="text"
                      value={draftStat.label}
                      onChange={(e) => setDraftStat((d) => ({ ...d, label: e.target.value }))}
                      placeholder="Auditeurs Mensuels"
                      className={fieldClass}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Année</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={draftMilestone.year}
                        onChange={(e) =>
                          setDraftMilestone((d) => ({ ...d, year: e.target.value }))
                        }
                        placeholder="2024"
                        className={`${fieldClass} font-display`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Mois (optionnel)</label>
                      <select
                        value={draftMilestone.month == null ? '' : String(draftMilestone.month)}
                        onChange={(e) =>
                          setDraftMilestone((d) => ({
                            ...d,
                            month: e.target.value === '' ? null : Number(e.target.value),
                          }))
                        }
                        className={fieldClass}
                      >
                        {MONTHS.map((m) => (
                          <option key={m.value || 'none'} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Titre</label>
                    <input
                      type="text"
                      value={draftMilestone.title}
                      onChange={(e) =>
                        setDraftMilestone((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Studio Bany Talks"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      value={draftMilestone.desc}
                      onChange={(e) =>
                        setDraftMilestone((d) => ({ ...d, desc: e.target.value }))
                      }
                      rows={3}
                      placeholder="Décrivez cette étape du parcours…"
                      className={`${fieldClass} resize-y`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/5">
              <button type="button" className="btn-ghost text-xs py-2 px-3" onClick={closeAddModal}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary text-xs py-2 px-4"
                onClick={addModal === 'statistics' ? confirmAddStatistics : confirmAddTimeline}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
