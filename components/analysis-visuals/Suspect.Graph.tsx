import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Scatter, Tooltip } from "recharts";

export default function SuspectGraph({ suspects = [] }) {
  const data = suspects.map((s) => ({
    name: s.name,
    confidence: s.confidence,
    motive: s.motiveScore,
    means: s.meansScore,
    opportunity: s.opportunityScore,
  }));

  return (
    <div className="w-full h-96">
      <h2 className="text-xl font-semibold mb-4">Suspect Analysis</h2>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <XAxis type="number" dataKey="confidence" name="Confidence" />
          <YAxis type="number" dataKey="motive" name="Motive Score" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Suspects" data={data} fill="#8884d8" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
