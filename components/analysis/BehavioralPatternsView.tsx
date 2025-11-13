'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Brain, Filter, MessageSquare, Target, Users } from 'lucide-react';
import type { BehaviorPattern } from '@/lib/cold-case-analyzer';
import { cleanText, displayText, formatPercent, clamp01 } from '@/lib/display-utils';

interface BehavioralPatternsViewProps {
  patterns: BehaviorPattern[];
}

interface SanitizedPattern extends BehaviorPattern {
  personName: string;
  patterns: BehaviorPattern['patterns'];
  recommendedFollowUp: string[];
}

export default function BehavioralPatternsView({ patterns }: BehavioralPatternsViewProps) {
  const [minSuspicion, setMinSuspicion] = useState(0.4);
  const [search, setSearch] = useState('');

  const sanitized = useMemo(() => {
    return patterns
      .map<SanitizedPattern>(pattern => ({
        ...pattern,
        personName: displayText(pattern.personName, 'Unnamed interviewee'),
        patterns: (pattern.patterns || []).filter(entry => Boolean(cleanText(entry.description))),
        recommendedFollowUp: (pattern.recommendedFollowUp || [])
          .map(entry => cleanText(entry))
          .filter((entry): entry is string => Boolean(entry)),
        overallAssessment: displayText(pattern.overallAssessment, 'Assessment not provided'),
      }))
      .filter(entry => entry.patterns.length > 0);
  }, [patterns]);

  const filtered = useMemo(() => {
    return sanitized.filter(entry => {
      const matchesThreshold = entry.patterns.some(item => item.suspicionLevel >= minSuspicion);
      const matchesSearch = !search
        ? true
        : entry.personName.toLowerCase().includes(search.toLowerCase());
      return matchesThreshold && matchesSearch;
    });
  }, [sanitized, minSuspicion, search]);

  const avgSuspicion = useMemo(() => {
    const scores = sanitized.flatMap(entry => entry.patterns.map(pattern => pattern.suspicionLevel));
    if (!scores.length) return 0;
    return scores.reduce((acc, score) => acc + score, 0) / scores.length;
  }, [sanitized]);

  const highRiskCount = useMemo(
    () => sanitized.filter(entry => entry.patterns.some(pattern => pattern.suspicionLevel >= 0.7)).length,
    [sanitized],
  );

  const totalFlags = sanitized.reduce((acc, entry) => acc + entry.patterns.length, 0);

  const suspicionPercent = formatPercent(clamp01(avgSuspicion));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            High-Risk Subjects
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{highRiskCount}</p>
          <p className="text-xs text-amber-700">Showing people with patterns ≥ 70% suspicion</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-800 text-sm font-semibold">
            <Brain className="h-4 w-4" />
            Average Suspicion
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">{suspicionPercent}</p>
          <div className="mt-2 h-2 w-full rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${clamp01(avgSuspicion) * 100}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-2 text-purple-800 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" />
            Pattern Flags
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-900">{totalFlags}</p>
          <p className="text-xs text-purple-700">Behavioral clues captured across interviews</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            Suspicion threshold
            <span className="font-semibold text-gray-900">{Math.round(minSuspicion * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(minSuspicion * 100)}
            onChange={event => setMinSuspicion(Number(event.target.value) / 100)}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200"
          />
          <input
            type="search"
            placeholder="Search interviewees"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(entry => (
          <div key={entry.personName} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-500">Interviewee</p>
                <p className="text-xl font-semibold text-gray-900">{entry.personName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                  {entry.patterns.length} pattern{entry.patterns.length === 1 ? '' : 's'} detected
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                  Top concern{' '}
                  {entry.patterns[0]?.type.replace(/_/g, ' ') ?? 'not specified'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {entry.patterns.map(pattern => (
                <div key={`${entry.personName}-${pattern.type}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Users className="h-4 w-4 text-gray-500" />
                      {pattern.type.replace(/_/g, ' ')}
                    </div>
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium">
                      {formatPercent(pattern.suspicionLevel)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{pattern.description}</p>
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    {pattern.examples.slice(0, 2).map((example, index) => (
                      <p key={index} className="rounded bg-gray-50 p-2">“{example}”</p>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Psychological note: {pattern.psychologicalNote}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-red-500"
                      style={{ width: `${clamp01(pattern.suspicionLevel) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {entry.recommendedFollowUp.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                <div className="flex items-center gap-2 font-semibold">
                  <Target className="h-4 w-4" />
                  Follow-up actions
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {entry.recommendedFollowUp.map(action => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-gray-600">
            No interviews meet the current filters. Try lowering the suspicion slider or clearing the search.
          </div>
        )}
      </div>
    </div>
  );
}
