import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchSiteContent, updateSiteContent, type SiteStatistic } from '../services/api';

type Props = {
  token: string;
  onMessage: (msg: string | null) => void;
};

export default function SiteContentPanel({ token, onMessage }: Props) {
  const [statistics, setStatistics] = useState<SiteStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchSiteContent();
        if (!cancelled) setStatistics(data.statistics || []);
      } catch (err) {
        if (!cancelled) {
          onMessage(err instanceof Error ? err.message : 'Impossible de charger les chiffres clés');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onMessage]);

  const updateRow = (index: number, field: keyof SiteStatistic, value: string) => {
    setStatistics((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => {
    setStatistics((prev) => [...prev, { label: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    setStatistics((prev) => prev.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setStatistics((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label mb-1">Contenu site</p>
          <h1 className="font-display text-2xl sm:text-3xl text-stone-100">Chiffres clés</h1>
          <p className="mt-2 text-sm text-stone-500 font-body max-w-xl">
            Ces valeurs s’affichent dans la section « Chiffres clés » de la page À propos sur le site public.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost text-xs py-2 px-3" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            Ajouter
          </button>
          <button
            type="button"
            className="btn-primary text-xs py-2 px-4"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <Save className="w-3.5 h-3.5 inline mr-1.5" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 font-body">Chargement…</p>
      ) : (
        <div className="border border-white/8 divide-y divide-white/5">
          {statistics.length === 0 && (
            <div className="p-8 text-center text-stone-500 text-sm font-body">
              <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Aucun chiffre. Cliquez sur « Ajouter » pour en créer.
            </div>
          )}
          {statistics.map((stat, index) => (
            <div key={index} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase tracking-wider text-stone-600 font-body mb-1.5">
                  Valeur
                </label>
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => updateRow(index, 'value', e.target.value)}
                  placeholder="450K+"
                  className="w-full bg-stone-900 border border-white/10 px-3 py-2.5 text-sm text-stone-100 font-display focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[10px] uppercase tracking-wider text-stone-600 font-body mb-1.5">
                  Libellé
                </label>
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => updateRow(index, 'label', e.target.value)}
                  placeholder="Auditeurs Mensuels"
                  className="w-full bg-stone-900 border border-white/10 px-3 py-2.5 text-sm text-stone-100 font-body focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="sm:col-span-3 flex items-center gap-1 sm:justify-end">
                <button
                  type="button"
                  className="p-2 text-stone-500 hover:text-stone-200 transition disabled:opacity-30"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                  aria-label="Monter"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-2 text-stone-500 hover:text-stone-200 transition disabled:opacity-30"
                  onClick={() => moveRow(index, 1)}
                  disabled={index === statistics.length - 1}
                  aria-label="Descendre"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-2 text-stone-500 hover:text-rose-400 transition"
                  onClick={() => removeRow(index)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
