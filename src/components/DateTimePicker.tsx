import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface DateTimePickerProps {
  label?: string;
  value: string; // yyyy-MM-ddTHH:mm
  onChange: (value: string) => void;
  min?: Date;
}

const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(value: string) {
  const d = parseValue(value);
  if (!d) return 'Choisir une date';
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DateTimePicker({ label = 'Date de publication', value, onChange, min }: DateTimePickerProps) {
  const selected = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected || new Date());
  const [hours, setHours] = useState(() => (selected ? pad(selected.getHours()) : '09'));
  const [minutes, setMinutes] = useState(() => (selected ? pad(selected.getMinutes()) : '00'));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      setViewDate(selected);
      setHours(pad(selected.getHours()));
      setMinutes(pad(selected.getMinutes()));
    }
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean } | null> = [];

    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - (startOffset - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]!.date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    return cells;
  }, [viewDate]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isDisabled = (date: Date) => {
    if (!min) return false;
    const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return day < minDay;
  };

  const applyDate = (date: Date) => {
    if (isDisabled(date)) return;
    const next = new Date(date);
    next.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
    onChange(toLocalInputValue(next));
  };

  const applyTime = (h: string, m: string) => {
    setHours(h);
    setMinutes(m);
    const base = selected || new Date();
    const next = new Date(base);
    next.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    onChange(toLocalInputValue(next));
  };

  const today = new Date();

  return (
    <div ref={rootRef} className="space-y-2 block relative">
      <span className="text-xs text-stone-500 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 bg-stone-950 border border-white/10 py-2.5 px-3 text-left text-stone-100 hover:border-rose-500/40 transition cursor-pointer"
      >
        <span className={`text-sm font-body ${value ? 'text-stone-100' : 'text-stone-600'}`}>
          {formatDisplay(value)}
        </span>
        <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] sm:w-[320px] border border-white/10 bg-stone-950 shadow-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="p-1.5 text-stone-400 hover:text-stone-100 cursor-pointer"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="font-display text-sm text-stone-100">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="p-1.5 text-stone-400 hover:text-stone-100 cursor-pointer"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] uppercase tracking-wider text-stone-600 py-1">
                {d}
              </span>
            ))}
            {days.map((cell, idx) => {
              if (!cell) return <span key={idx} />;
              const selectedDay = selected && isSameDay(cell.date, selected);
              const isToday = isSameDay(cell.date, today);
              const disabled = isDisabled(cell.date);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyDate(cell.date)}
                  className={`h-9 text-xs font-body transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    selectedDay
                      ? 'bg-rose-500 text-stone-950'
                      : cell.inMonth
                        ? 'text-stone-200 hover:bg-white/5'
                        : 'text-stone-700 hover:bg-white/5'
                  } ${isToday && !selectedDay ? 'ring-1 ring-rose-500/50' : ''}`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <Clock className="w-4 h-4 text-stone-600 shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={(e) => {
                  const h = pad(Math.min(23, Math.max(0, Number(e.target.value) || 0)));
                  applyTime(h, minutes);
                }}
                className="w-14 bg-stone-900 border border-white/10 py-1.5 px-2 text-center text-sm text-stone-100 focus:outline-none focus:border-rose-500/50"
              />
              <span className="text-stone-500">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => {
                  const m = pad(Math.min(59, Math.max(0, Number(e.target.value) || 0)));
                  applyTime(hours, m);
                }}
                className="w-14 bg-stone-900 border border-white/10 py-1.5 px-2 text-center text-sm text-stone-100 focus:outline-none focus:border-rose-500/50"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 5, 0, 0);
                onChange(toLocalInputValue(now));
                setOpen(false);
              }}
              className="text-[11px] text-rose-400 hover:text-rose-300 uppercase tracking-wider cursor-pointer"
            >
              Maintenant
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs text-stone-500 hover:text-stone-300 px-3 py-1.5 cursor-pointer"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary text-xs py-1.5 px-4"
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
