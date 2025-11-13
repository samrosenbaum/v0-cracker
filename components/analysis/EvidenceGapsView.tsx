'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Filter, Layers, Target } from 'lucide-react';
import type { EvidenceGap } from '@/lib/cold-case-analyzer';
import { displayText, formatPercent, clamp01 } from '@/lib/display-utils';

interface EvidenceGapsViewProps {
  gaps: EvidenceGap[];
}

const priorityOrder: EvidenceGap['priority'][] = ['critical', 'high', 'medium', 'low'];

const priorityStyles: Record<EvidenceGap['priority'], string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function EvidenceGapsView({ gaps }: EvidenceGapsViewProps) {
  const [priorityFilter, setPriorityFilter] = useState<'all' | EvidenceGap['priority']>('all');
  const [search, setSearch] = useState('');

  const sanitized = useMemo(() => {
    return gaps
      .map(gap => ({
        ...gap,
        category: gap.category,
        gapDescription: displayText(gap.gapDescription, 'Gap description not provided'),
        whyItMatters: displayText(gap.whyItMatters, 'Significance not provided'),
        howToFill: displayText(gap.howToFill, 'Action not available'),
        estimatedEffort: displayText(gap.estimatedEffort, 'Effort not documented'),
      }))
      .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
  }, [gaps]);

  const filtered = useMemo(() => {
    return sanitized.filter(gap => {
      if (priorityFilter !== 'all' && gap.priority !== priorityFilter) {
        return false;
      }
      if (search) {
        const normalized = search.toLowerCase();
        return (
          gap.category.toLowerCase().includes(normalized) ||
          gap.gapDescription.toLowerCase().includes(normalized) ||
          gap.whyItMatters.toLowerCase().includes(normalized)
        );
      }
      return true;
    });
  }, [sanitized, priorityFilter, search]);

  const counts = useMemo(() => {
    return sanitized.reduce(
      (acc, gap) => {
        acc[gap.priority] += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 },
    );
  }, [sanitized]);

  const breakthroughAverage = useMemo(() => {
    if (!sanitized.length) return 0;
    return sanitized.reduce((acc, gap) => acc + clamp01(gap.potentialBreakthroughValue), 0) / sanitized.length;
  }, [sanitized]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {priorityOrder.map(priority => (
          <div key={priority} className="rounded-lg border bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{priority} priority</div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{counts[priority]}</p>
            <p className="text-xs text-gray-500">gaps to close</p>
          </div>
        ))}
        <div className="rounded-lg border bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-white/80">Avg. breakthrough potential</p>
          <p className="mt-2 text-3xl font-semibold">{formatPercent(breakthroughAverage)}</p>
          <p className="text-xs text-white/80">Re-run high-value gaps quarterly</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            Priority
            <select
              value={priorityFilter}
              onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)}
              className="rounded-lg border px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              {priorityOrder.map(priority => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            placeholder="Search categories or notes"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(gap => (
          <div key={`${gap.category}-${gap.gapDescription}`} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Category</p>
                <p className="text-lg font-semibold text-gray-900">{gap.category}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityStyles[gap.priority]}`}>
                {gap.priority}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-800">{gap.gapDescription}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Why it matters
                </div>
                <p className="mt-2 text-xs text-slate-600">{gap.whyItMatters}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  <Target className="h-4 w-4" />
                  How to fill
                </div>
                <p className="mt-2 text-xs text-slate-600">{gap.howToFill}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  <Layers className="h-4 w-4" />
                  Effort & value
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Effort: <span className="font-semibold text-slate-900">{gap.estimatedEffort}</span>
                </p>
                <p className="text-xs text-slate-600">Breakthrough: {formatPercent(gap.potentialBreakthroughValue)}</p>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-600"
                    style={{ width: `${clamp01(gap.potentialBreakthroughValue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-gray-600">
            No gaps match these filters yet. Try selecting another priority level.
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-slate-900 p-4 text-white">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Next best moves</p>
            <p className="mt-1 text-sm text-white/80">
              Re-run collection plans for the top two critical gaps and sync results with the forensic task force dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
