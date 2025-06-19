'use client';

import { Timeline as VerticalTimeline, TimelineItem } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import Timeline from '@/components/Timeline'; // Add your custom Timeline
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

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
          <h3 className="text-lg font-semibold mb-2">🧾 Evidence Table</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Title</th>
                  <th className="p-2 border">Category</th>
                  <th className="p-2 border">Confidence</th>
                  <th className="p-2 border">Priority</th>
                  <th className="p-2 border">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.findings.map((f: any, i: number) => (
                  <tr key={i} className={f.priority === "CRITICAL" ? "bg-red-50" : ""}>
                    <td className="p-2 border">{f.title}</td>
                    <td className="p-2 border">{f.category}</td>
                    <td className="p-2 border">{f.confidence}</td>
                    <td className="p-2 border">{f.priority}</td>
                    <td className="p-2 border">{f.investigativeAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <Timeline events={
            data.findings
              .filter(f => f.timeline)
              .map(f => ({
                date: f.timeline?.date || f.timeline || new Date().toISOString(),
                description: f.description || f.title || '',
                type: f.category || 'event'
              }))
          } />
        </section>
      )}

      {data.suspects?.length > 0 && data.connections?.length > 0 && (() => {
        // Create valid nodes
        const validNodes = data.suspects
          .filter((s: any) => s && s.id && s.name) // Filter out invalid nodes
          .map((s: any) => ({
            id: String(s.id), // Ensure ID is a string
            name: s.name,
            status: s.status || 'unknown',
            priority: s.priority || 'low',
          }));

        // Get all valid node IDs for reference checking
        const validNodeIds = new Set(validNodes.map(n => n.id));

        // Create valid links
        const validLinks = data.connections
          .filter((c: any) => {
            // Check if connection object exists and has required properties
            if (!c || !c.source || !c.target) return false;
            
            // Convert to strings and check if both nodes exist
            const sourceId = String(c.source);
            const targetId = String(c.target);
            
            return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
          })
          .map((c: any) => ({
            source: String(c.source),
            target: String(c.target),
            label: c.type || 'connection',
          }));

        console.log('Valid nodes:', validNodes);
        console.log('Valid links:', validLinks);

        // Only render if we have both nodes and links
        if (validNodes.length === 0) {
          return (
            <section>
              <h3 className="text-lg font-semibold mb-2">🌐 Network View</h3>
              <p className="text-gray-500">No valid suspects found for network visualization.</p>
            </section>
          );
        }

        return (
          <section>
            <h3 className="text-lg font-semibold mb-2">🌐 Network View</h3>
            <ForceGraph2D
              graphData={{
                nodes: validNodes,
                links: validLinks,
              }}
              nodeLabel="name"
              nodeAutoColorBy="status"
              linkLabel="label"
              width={600}
              height={350}
            />
          </section>
        );
      })()}
    </div>
  );
}