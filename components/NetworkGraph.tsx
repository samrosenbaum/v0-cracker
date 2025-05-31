import React, { useRef } from "react";

type Suspect = {
  name: string;
  connections?: string[]; // names of other suspects
  role?: string;
};

type NetworkGraphProps = {
  suspects: Suspect[];
};

export default function NetworkGraph({ suspects }: NetworkGraphProps) {
  const fgRef = useRef<any>(null);

  // Build nodes and links
  const nodes = suspects.map(s => ({
    id: s.name,
    role: s.role || "Suspect",
  }));
  const links = suspects.flatMap(s =>
    (s.connections || []).map(target => ({
      source: s.name,
      target,
    }))
  );

  if (!nodes.length) return <div>No suspects to display.</div>;

  return (
    <div className="my-6">
      <h3 className="font-semibold mb-2">Suspect Network</h3>
      <div style={{ height: 400, background: "#f8fafc", borderRadius: 8 }}>
        {/* <ForceGraph2D
          ref={fgRef}
          graphData={{ nodes, links }}
          nodeLabel={node => `${node.id} (${node.role})`}
          nodeAutoColorBy="role"
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.id;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillStyle = node.color || "#333";
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x, node.y - 14);
          }}
        /> */}
      </div>
    </div>
  );
} 