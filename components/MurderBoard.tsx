'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Database } from '@/app/types/database';
import {
  User,
  MapPin,
  Package,
  Car,
  Building2,
  Circle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';

type CaseEntity = Database['public']['Tables']['case_entities']['Row'];
type CaseConnection = Database['public']['Tables']['case_connections']['Row'];

interface MurderBoardProps {
  caseId: string;
  entities: CaseEntity[];
  connections: CaseConnection[];
  victimEntityId?: string;
  onEntityClick?: (entity: CaseEntity) => void;
  onConnectionClick?: (connection: CaseConnection) => void;
  onAddEntity?: () => void;
  onAddConnection?: () => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  role?: string;
  color: string;
  size: number;
  icon?: string;
  entity: CaseEntity;
}

interface GraphLink {
  source: string;
  target: string;
  label?: string;
  type: string;
  confidence: string;
  color: string;
  width: number;
  dashed: boolean;
  connection: CaseConnection;
}

const entityTypeIcons = {
  person: User,
  location: MapPin,
  evidence: Package,
  vehicle: Car,
  organization: Building2,
  other: Circle,
};

const entityTypeColors: Record<string, string> = {
  person: '#3B82F6', // blue
  location: '#10B981', // green
  evidence: '#8B5CF6', // purple
  vehicle: '#F59E0B', // orange
  organization: '#EC4899', // pink
  other: '#6B7280', // gray
};

const confidenceColors: Record<string, string> = {
  confirmed: '#10B981', // green
  probable: '#3B82F6', // blue
  possible: '#F59E0B', // orange
  unverified: '#6B7280', // gray
};

export default function MurderBoard({
  caseId,
  entities,
  connections,
  victimEntityId,
  onEntityClick,
  onConnectionClick,
  onAddEntity,
  onAddConnection,
}: MurderBoardProps) {
  const graphRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(
    Object.keys(entityTypeColors)
  );
  const [selectedConfidences, setSelectedConfidences] = useState<string[]>([
    'confirmed',
    'probable',
    'possible',
    'unverified',
  ]);
  const [showLabels, setShowLabels] = useState(true);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });

  // Update graph dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setGraphDimensions({
          width: container.clientWidth,
          height: Math.max(600, window.innerHeight - 400),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build graph data
  const graphData = useMemo(() => {
    // Filter entities
    const filteredEntities = entities.filter((entity) =>
      selectedEntityTypes.includes(entity.entity_type)
    );

    // Create nodes
    const nodes: GraphNode[] = filteredEntities.map((entity) => {
      const isVictim = entity.id === victimEntityId || entity.role === 'victim';
      const defaultColor = entityTypeColors[entity.entity_type] || entityTypeColors.other;

      return {
        id: entity.id,
        name: entity.name,
        type: entity.entity_type,
        role: entity.role || undefined,
        color: entity.color || defaultColor,
        size: isVictim ? 20 : 10,
        icon: entity.icon,
        entity,
      };
    });

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Filter connections
    const filteredConnections = connections.filter(
      (conn) =>
        nodeIds.has(conn.from_entity_id) &&
        nodeIds.has(conn.to_entity_id) &&
        selectedConfidences.includes(conn.confidence || 'unverified')
    );

    // Create links
    const links: GraphLink[] = filteredConnections.map((conn) => {
      const confidenceColor = confidenceColors[conn.confidence || 'unverified'];

      return {
        source: conn.from_entity_id,
        target: conn.to_entity_id,
        label: conn.label || conn.connection_type,
        type: conn.connection_type,
        confidence: conn.confidence || 'unverified',
        color: conn.line_color || confidenceColor,
        width: conn.line_weight || 2,
        dashed: conn.line_style === 'dashed' || conn.line_style === 'dotted',
        connection: conn,
      };
    });

    return { nodes, links };
  }, [entities, connections, selectedEntityTypes, selectedConfidences, victimEntityId]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      setSelectedLink(null);
      onEntityClick?.(node.entity);

      // Highlight connected nodes and links
      const connectedNodeIds = new Set<string>();
      const connectedLinkIds = new Set<string>();

      graphData.links.forEach((link) => {
        if (link.source === node.id || (typeof link.source === 'object' && (link.source as any).id === node.id)) {
          connectedNodeIds.add(typeof link.target === 'string' ? link.target : (link.target as any).id);
          connectedLinkIds.add(`${link.source}-${link.target}`);
        }
        if (link.target === node.id || (typeof link.target === 'object' && (link.target as any).id === node.id)) {
          connectedNodeIds.add(typeof link.source === 'string' ? link.source : (link.source as any).id);
          connectedLinkIds.add(`${link.source}-${link.target}`);
        }
      });

      connectedNodeIds.add(node.id);
      setHighlightNodes(connectedNodeIds);
      setHighlightLinks(connectedLinkIds);
    },
    [graphData.links, onEntityClick]
  );

  // Handle link click
  const handleLinkClick = useCallback(
    (link: GraphLink) => {
      setSelectedLink(link);
      setSelectedNode(null);
      onConnectionClick?.(link.connection);
    },
    [onConnectionClick]
  );

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedLink(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Zoom controls
  const zoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.2);
    }
  };

  const zoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.2);
    }
  };

  const resetZoom = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  // Toggle entity type
  const toggleEntityType = (type: string) => {
    setSelectedEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Toggle confidence level
  const toggleConfidence = (confidence: string) => {
    setSelectedConfidences((prev) =>
      prev.includes(confidence) ? prev.filter((c) => c !== confidence) : [...prev, confidence]
    );
  };

  // Custom node canvas paint
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = 12 / globalScale;
      const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
      const isSelected = selectedNode?.id === node.id;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI, false);
      ctx.fillStyle = isHighlighted ? node.color : `${node.color}40`;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
      }

      // Draw label
      if (showLabels && (isHighlighted || globalScale > 1)) {
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isHighlighted ? '#1F2937' : '#9CA3AF';
        ctx.fillText(label, node.x, node.y + node.size + fontSize);
      }

      // Draw role badge if victim
      if (node.role === 'victim') {
        ctx.font = `bold ${fontSize}px Sans-Serif`;
        ctx.fillStyle = '#DC2626';
        ctx.fillText('★', node.x, node.y - node.size - fontSize / 2);
      }
    },
    [highlightNodes, selectedNode, showLabels]
  );

  // Custom link canvas paint
  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const linkId = `${link.source.id}-${link.target.id}`;
      const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(linkId);
      const isSelected = selectedLink?.source === link.source.id && selectedLink?.target === link.target.id;

      const start = link.source;
      const end = link.target;

      // Set line style
      ctx.strokeStyle = isHighlighted ? link.color : `${link.color}40`;
      ctx.lineWidth = (isSelected ? link.width * 1.5 : link.width) / globalScale;

      // Draw dashed line if needed
      if (link.dashed) {
        ctx.setLineDash([5 / globalScale, 5 / globalScale]);
      } else {
        ctx.setLineDash([]);
      }

      // Draw line
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrow
      const arrowLength = 10 / globalScale;
      const arrowWidth = 6 / globalScale;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const arrowX = end.x - Math.cos(angle) * end.size;
      const arrowY = end.y - Math.sin(angle) * end.size;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      // Draw label
      if (showLabels && link.label && (isHighlighted || globalScale > 1.5)) {
        const fontSize = 10 / globalScale;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isHighlighted ? '#374151' : '#9CA3AF';

        // Background for label
        const textWidth = ctx.measureText(link.label).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(midX - textWidth / 2 - 2, midY - fontSize / 2 - 1, textWidth + 4, fontSize + 2);

        ctx.fillStyle = isHighlighted ? '#374151' : '#9CA3AF';
        ctx.fillText(link.label, midX, midY);
      }

      ctx.setLineDash([]);
    },
    [highlightLinks, selectedLink, showLabels]
  );

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Investigation Board</h2>
          <p className="text-sm text-gray-600 mt-1">
            {graphData.nodes.length} entities • {graphData.links.length} connections
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
            <button onClick={zoomOut} className="p-1 hover:bg-gray-100 rounded" title="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={resetZoom} className="p-1 hover:bg-gray-100 rounded" title="Fit to view">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={zoomIn} className="p-1 hover:bg-gray-100 rounded" title="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle labels */}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            title="Toggle labels"
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Labels
          </button>

          {onAddEntity && (
            <button
              onClick={onAddEntity}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add Entity
            </button>
          )}

          {onAddConnection && graphData.nodes.length >= 2 && (
            <button
              onClick={onAddConnection}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              + Add Connection
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
        </div>

        {/* Entity Types */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Entity Types</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(entityTypeColors).map(([type, color]) => {
              const Icon = entityTypeIcons[type as keyof typeof entityTypeIcons];
              const isSelected = selectedEntityTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleEntityType(type)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    isSelected ? 'ring-2 ring-offset-2' : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: isSelected ? color : `${color}20`,
                    color: isSelected ? '#fff' : color,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confidence Levels */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Confidence Levels</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(confidenceColors).map(([confidence, color]) => {
              const isSelected = selectedConfidences.includes(confidence);
              return (
                <button
                  key={confidence}
                  onClick={() => toggleConfidence(confidence)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    isSelected ? 'ring-2 ring-offset-2' : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: isSelected ? color : `${color}20`,
                    color: isSelected ? '#fff' : color,
                  }}
                >
                  {confidence}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div id="graph-container" className="bg-white rounded-lg border overflow-hidden">
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={graphDimensions.width}
            height={graphDimensions.height}
            nodeRelSize={1}
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={(link: any) =>
              highlightLinks.size === 0 || highlightLinks.has(`${link.source.id}-${link.target.id}`) ? 2 : 0
            }
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            onBackgroundClick={handleBackgroundClick}
            cooldownTime={3000}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Circle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Entities Found</h3>
              <p className="text-gray-600 mb-6">
                {entities.length === 0
                  ? 'Add entities to start building your investigation board.'
                  : 'No entities match the selected filters.'}
              </p>
              {onAddEntity && (
                <button
                  onClick={onAddEntity}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Add First Entity
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Entity/Connection Details */}
      {(selectedNode || selectedLink) && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedNode ? 'Entity Details' : 'Connection Details'}
          </h3>

          {selectedNode && (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {React.createElement(entityTypeIcons[selectedNode.type as keyof typeof entityTypeIcons], {
                    className: 'w-6 h-6 text-white',
                  })}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h4>
                  <p className="text-sm text-gray-600 capitalize">
                    {selectedNode.role || selectedNode.type}
                  </p>
                </div>
              </div>

              {selectedNode.entity.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                  <p className="text-sm text-gray-600">{selectedNode.entity.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Connections</p>
                <p className="text-sm text-gray-600">
                  {graphData.links.filter(
                    (l) =>
                      l.source === selectedNode.id ||
                      l.target === selectedNode.id ||
                      (typeof l.source === 'object' && (l.source as any).id === selectedNode.id) ||
                      (typeof l.target === 'object' && (l.target as any).id === selectedNode.id)
                  ).length}{' '}
                  connection(s)
                </p>
              </div>
            </div>
          )}

          {selectedLink && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Connection Type</p>
                <p className="text-sm text-gray-600 capitalize">{selectedLink.type}</p>
              </div>

              {selectedLink.label && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Label</p>
                  <p className="text-sm text-gray-600">{selectedLink.label}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Confidence</p>
                <span
                  className="inline-block px-2 py-1 text-xs font-medium rounded capitalize"
                  style={{
                    backgroundColor: `${confidenceColors[selectedLink.confidence]}20`,
                    color: confidenceColors[selectedLink.confidence],
                  }}
                >
                  {selectedLink.confidence}
                </span>
              </div>

              {selectedLink.connection.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                  <p className="text-sm text-gray-600">{selectedLink.connection.description}</p>
                </div>
              )}

              {selectedLink.connection.evidence_notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Evidence Notes</p>
                  <p className="text-sm text-gray-600">{selectedLink.connection.evidence_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
