'use client';

import { Timeline, TimelineItem } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

export default function AIInsights({ data }: { data: any }) {
  if (!data) return null;
  if (data.error) return <p className="text-red-600">{data.error}</p>;

  return (
    <div className="mt-6 space-y-4">
      {data.suspects?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">👤 Suspects</h3>
          <ul className="space-y-2">
            {data.suspects.map((s: any, i: number) => (
              <li key={i} className="border p-2 rounded bg-white shadow-sm">
                <p><strong>{s.name}</strong> ({s.relevance}%)</p>
                <p className="text-sm text-gray-700">{s.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.findings?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">🔎 Key Findings</h3>
          <ul className="space-y-2">
            {data.findings.map((f: any, i: number) => (
              <li key={i} className="border p-2 rounded bg-white shadow-sm">
                <p><strong>{f.title}</strong> ({f.priority})</p>
                <p className="text-sm text-gray-700">{f.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.connections?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">🧩 Connections</h3>
          <ul className="space-y-2">
            {data.connections.map((c: any, i: number) => (
              <li key={i} className="border p-2 rounded bg-white shadow-sm">
                <p><strong>Type:</strong> {c.type}</p>
                <p className="text-sm text-gray-700">{c.description}</p>
                <p className="text-xs text-gray-500">Confidence: {c.confidence}%</p>
                {c.significance && <p className="text-xs text-gray-500">Significance: {c.significance}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.recommendations?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">✅ Recommendations</h3>
          <ul className="space-y-2">
            {data.recommendations.map((r: any, i: number) => (
              <li key={i} className="border p-2 rounded bg-white shadow-sm">
                <div><strong>Priority:</strong> {r.priority}</div>
                <div><strong>Action:</strong> {r.action}</div>
                <div><strong>Rationale:</strong> {r.rationale}</div>
                <div><strong>Timeline:</strong> {r.timeline}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.overlookedLeads?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">🚩 Overlooked Leads</h3>
          <ul className="space-y-2">
            {data.overlookedLeads.map((lead: any, i: number) => (
              <li key={i} className="border p-2 rounded bg-white shadow-sm">
                <div><strong>Type:</strong> {lead.type}</div>
                <div><strong>Description:</strong> {lead.description}</div>
                <div><strong>Recommended Action:</strong> {lead.recommendedAction}</div>
                <div><strong>Rationale:</strong> {lead.rationale}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.findings?.some(f => f.timeline) && (
        <section>
          <h3 className="text-lg font-semibold mb-2">🕒 Timeline of Key Events</h3>
          <Timeline>
            {data.findings
              .filter(f => f.timeline)
              .map((f, i) => (
                <TimelineItem
                  key={i}
                  date={f.timeline.date || ''}
                  icon={<span>⏱️</span>}
                >
                  <h4>{f.title}</h4>
                  <p>{f.description}</p>
                  <p className="text-xs text-gray-500">{f.timeline.details}</p>
                </TimelineItem>
              ))}
          </Timeline>
        </section>
      )}
    </div>
  );
}
