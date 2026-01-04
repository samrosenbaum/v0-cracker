'use client';

import React, { useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-slate-100 rounded-lg">
      <span className="text-slate-500">Loading network graph...</span>
    </div>
  ),
});

type Suspect = {
  name: string;
  connections?: string[]; // names of other suspects
  role?: string;
};

type NetworkGraphProps = {
  suspects: Suspect[];
};

const roleColors: Record<string, string> = {
  suspect: '#F59E0B',
  witness: '#3B82F6',
  victim: '#DC2626',
  poi: '#8B5CF6',
  default: '#6B7280',
};

export default function NetworkGraph({ suspects }: NetworkGraphProps) {
  const fgRef = useRef<any>(null);

  // Build nodes and links
  const graphData = useMemo(() => {
    const nodes = suspects.map(s => ({
      id: s.name,
      role: s.role || 'suspect',
      color: roleColors[s.role?.toLowerCase() || 'default'] || roleColors.default,
    }));

    const links = suspects.flatMap(s =>
      (s.connections || [])
        .filter(target => suspects.some(t => t.name === target))
        .map(target => ({
          source: s.name,
          target,
        }))
    );

    return { nodes, links };
  }, [suspects]);

  if (!graphData.nodes.length) {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg">
        No suspects to display in network.
      </div>
    );
  }

  return (
    <div className="my-6">
      <h3 className="font-semibold mb-2 text-slate-900">Suspect Network</h3>
      <div className="border border-slate-200 rounded-lg overflow-hidden" style={{ height: 400, background: '#f8fafc' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel={(node: any) => `${node.id} (${node.role})`}
          nodeColor={(node: any) => node.color}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkColor={() => '#94a3b8'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.id;
            const fontSize = Math.max(12 / globalScale, 4);
            ctx.font = `${fontSize}px Sans-Serif`;

            // Draw node circle
            ctx.fillStyle = node.color || '#6B7280';
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, 8, 0, 2 * Math.PI, false);
            ctx.fill();

            // Draw label
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, node.x!, (node.y || 0) - 14);
          }}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, 12, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
        />
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: roleColors.suspect }} />
          Suspect
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: roleColors.witness }} />
          Witness
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: roleColors.victim }} />
          Victim
        </span>
      </div>
    </div>
  );
}
