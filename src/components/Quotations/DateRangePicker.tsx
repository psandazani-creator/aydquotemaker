// src/components/Quotations/DateRangePicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import './DateRangePicker.css';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (startDate: string | null, endDate: string | null) => void;
  placeholder?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(d: Date) {
  return d.toDateString() === new Date().toDateString();
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function inRange(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  return d > start && d < end;
}

function fmtDisplay(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // Convert Sunday=0 to Monday=0 offset
  const offset = (firstDay.getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let i = 1; i <= total; i++) cells.push(new Date(year, month, i));
  return cells;
}

const QUICK_OPTIONS = [
  {
    label: 'Today',
    icon: '⚡',
    get: () => { const t = new Date(); return { s: t, e: t }; },
  },
  {
    label: 'Yesterday',
    icon: '↩',
    get: () => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return { s: d, e: d };
    },
  },
  {
    label: 'Last 7 days',
    icon: '7',
    get: () => {
      const e = new Date();
      const s = new Date(); s.setDate(s.getDate() - 6);
      return { s, e };
    },
  },
  {
    label: 'Last 30 days',
    icon: '30',
    get: () => {
      const e = new Date();
      const s = new Date(); s.setDate(s.getDate() - 29);
      return { s, e };
    },
  },
  {
    label: 'This month',
    icon: '📅',
    get: () => {
      const now = new Date();
      return { s: new Date(now.getFullYear(), now.getMonth(), 1), e: now };
    },
  },
  {
    label: 'Last month',
    icon: '◀',
    get: () => {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { s, e };
    },
  },
];

export function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  placeholder = 'Select date range',
}: DateRangePickerProps) {
  const today = new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  const [selStart, setSelStart] = useState<Date | null>(
    startDate ? new Date(startDate) : today
  );
  const [selEnd, setSelEnd] = useState<Date | null>(
    endDate ? new Date(endDate) : today
  );
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const [manualFrom, setManualFrom] = useState(startDate || toYMD(today));
  const [manualTo, setManualTo] = useState(endDate || toYMD(today));

  const ref = useRef<HTMLDivElement>(null);

  // Emit today on first mount if no dates provided
  useEffect(() => {
    if (!startDate && !endDate) onDateChange(toYMD(today), toYMD(today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep manual inputs in sync
  useEffect(() => {
    if (selStart) setManualFrom(toYMD(selStart));
    if (selEnd) setManualTo(toYMD(selEnd));
  }, [selStart, selEnd]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPicking(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayText = () => {
    if (selStart && selEnd) {
      if (sameDay(selStart, selEnd)) return fmtDisplay(selStart);
      return `${fmtDisplay(selStart)} – ${fmtDisplay(selEnd)}`;
    }
    if (selStart) return `${fmtDisplay(selStart)} → pick end`;
    return placeholder;
  };

  const handleDayClick = (date: Date) => {
    if (!picking || picking === 'start') {
      setSelStart(date);
      setSelEnd(null);
      setPicking('end');
      setActiveQuick(null);
    } else {
      if (selStart && date < selStart) {
        setSelStart(date);
        setSelEnd(null);
        setPicking('end');
      } else {
        setSelEnd(date);
        setPicking(null);
        onDateChange(toYMD(selStart!), toYMD(date));
        setTimeout(() => setIsOpen(false), 120);
      }
      setActiveQuick(null);
    }
  };

  const handleQuick = (opt: typeof QUICK_OPTIONS[number]) => {
    const { s, e } = opt.get();
    setSelStart(s);
    setSelEnd(e);
    setPicking(null);
    setActiveQuick(opt.label);
    onDateChange(toYMD(s), toYMD(e));
    setTimeout(() => setIsOpen(false), 150);
  };

  const handleApply = () => {
    const s = new Date(manualFrom);
    const e = new Date(manualTo);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      setSelStart(s);
      setSelEnd(e);
      onDateChange(manualFrom, manualTo);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setSelStart(null);
    setSelEnd(null);
    setPicking(null);
    setActiveQuick(null);
    setManualFrom('');
    setManualTo('');
    onDateChange(null, null);
  };

  const prevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const cells = getDaysInMonth(month.getFullYear(), month.getMonth());

  const dayClass = (date: Date) => {
    const classes = ['drp-day'];
    if (isToday(date)) classes.push('drp-today');
    if (selStart && sameDay(date, selStart)) classes.push('drp-sel-start');
    if (selEnd && sameDay(date, selEnd)) classes.push('drp-sel-end');
    if (selStart && selEnd && inRange(date, selStart, selEnd)) classes.push('drp-in-range');
    else if (selStart && !selEnd && hovered && date > selStart && date <= hovered)
      classes.push('drp-in-range');
    if (selStart && selEnd && (sameDay(date, selStart) || sameDay(date, selEnd)))
      classes.push('drp-sel-edge');
    return classes.join(' ');
  };

  return (
    <div className="drp-wrap" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        className={`drp-trigger ${isOpen ? 'drp-trigger--open' : ''}`}
        onClick={() => { setIsOpen(o => !o); setPicking('start'); }}
        aria-label="Open date picker"
      >
        <svg className="drp-trigger-icon" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 2v3M14 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="drp-trigger-text">{displayText()}</span>
        <svg className={`drp-trigger-chevron ${isOpen ? 'drp-trigger-chevron--up' : ''}`} viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="drp-panel" role="dialog" aria-modal="true">
          <div className="drp-panel-inner">

            {/* ── Quick select ── */}
            <div className="drp-quick">
              <p className="drp-section-label">Quick select</p>
              <div className="drp-quick-list">
                {QUICK_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`drp-quick-btn ${activeQuick === opt.label ? 'drp-quick-btn--active' : ''}`}
                    onClick={() => handleQuick(opt)}
                  >
                    <span className="drp-quick-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="drp-divider" />

            {/* ── Calendar ── */}
            <div className="drp-cal">
              {/* Month nav */}
              <div className="drp-cal-nav">
                <button type="button" className="drp-nav-btn" onClick={prevMonth} aria-label="Previous month">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="drp-cal-title">
                  {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" className="drp-nav-btn" onClick={nextMonth} aria-label="Next month">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Weekdays */}
              <div className="drp-weekdays">
                {WEEKDAYS.map(d => <span key={d} className="drp-weekday">{d}</span>)}
              </div>

              {/* Days grid */}
              <div className="drp-days">
                {cells.map((date, i) =>
                  date ? (
                    <button
                      key={i}
                      type="button"
                      className={dayClass(date)}
                      onClick={() => handleDayClick(date)}
                      onMouseEnter={() => picking === 'end' && setHovered(date)}
                      onMouseLeave={() => setHovered(null)}
                      aria-label={date.toDateString()}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <span key={i} className="drp-day-empty" />
                  )
                )}
              </div>

              {/* Picking hint */}
              <p className="drp-hint">
                {picking === 'start' && 'Click a start date'}
                {picking === 'end' && 'Now click an end date'}
                {!picking && selStart && selEnd && `${fmtDisplay(selStart)} – ${fmtDisplay(selEnd)}`}
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="drp-divider" />

            {/* ── Manual entry ── */}
            <div className="drp-manual">
              <p className="drp-section-label">Or enter manually</p>
              <div className="drp-manual-row">
                <div className="drp-manual-field">
                  <label className="drp-manual-label">From</label>
                  <input
                    type="date"
                    className="drp-manual-input"
                    value={manualFrom}
                    max={manualTo || undefined}
                    onChange={e => setManualFrom(e.target.value)}
                  />
                </div>
                <div className="drp-manual-sep">→</div>
                <div className="drp-manual-field">
                  <label className="drp-manual-label">To</label>
                  <input
                    type="date"
                    className="drp-manual-input"
                    value={manualTo}
                    min={manualFrom || undefined}
                    onChange={e => setManualTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="drp-footer">
              <button type="button" className="drp-btn-clear" onClick={handleClear}>
                Clear
              </button>
              <button
                type="button"
                className="drp-btn-apply"
                onClick={handleApply}
                disabled={!manualFrom || !manualTo}
              >
                Apply
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
