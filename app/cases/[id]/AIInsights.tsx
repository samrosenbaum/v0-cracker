'use client';

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
                <p><strong>Case ID:</strong> {c.caseId}</p>
                <p className="text-sm text-gray-700">{c.description}</p>
                <p className="text-xs text-gray-500">Confidence: {c.confidence}%</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.recommendations?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">✅ Recommendations</h3>
          <ul className="list-disc list-inside text-sm text-gray-800">
            {data.recommendations.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
