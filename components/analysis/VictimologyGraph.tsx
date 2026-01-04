'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  User,
  Heart,
  Briefcase,
  AlertTriangle,
  Users,
  Home,
  ChevronDown,
  ChevronUp,
  Target,
  Clock,
  FileText,
  Shield,
  Zap,
  X
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface VictimologyPerson {
  id: string;
  name: string;
  role: 'victim' | 'suspect' | 'witness' | 'family' | 'associate';
  relationship?: string;
  suspicionLevel?: number; // 0-1
  motive?: string;
  opportunity?: string;
  alibiStrength?: 'strong' | 'partial' | 'weak' | 'none';
  behavioralFlags?: string[];
  keyStatements?: string[];
  description?: string;
  metadata?: Record<string, any>;
}

export interface VictimologyConnection {
  from: string;
  to: string;
  type: 'romantic' | 'family' | 'professional' | 'adversarial' | 'financial' | 'social' | 'unknown';
  label: string;
  strength: number; // 0-1
  suspicious?: boolean;
  evidenceNotes?: string;
  interviewInsights?: string[];
}

export interface VictimologyGraphProps {
  victim: VictimologyPerson;
  relatedPersons: VictimologyPerson[];
  connections: VictimologyConnection[];
  onPersonClick?: (person: VictimologyPerson) => void;
  onConnectionClick?: (connection: VictimologyConnection) => void;
}

// =============================================================================
// Constants
// =============================================================================

const roleColors: Record<string, string> = {
  victim: '#DC2626',      // Red
  suspect: '#F59E0B',     // Orange/Amber
  witness: '#3B82F6',     // Blue
  family: '#8B5CF6',      // Purple
  associate: '#6B7280',   // Gray
};

const connectionTypeColors: Record<string, string> = {
  romantic: '#EC4899',    // Pink
  family: '#8B5CF6',      // Purple
  professional: '#3B82F6', // Blue
  adversarial: '#DC2626', // Red
  financial: '#10B981',   // Green
  social: '#6366F1',      // Indigo
  unknown: '#6B7280',     // Gray
};

const alibiIcons = {
  strong: { icon: Shield, color: '#10B981', label: 'Strong Alibi' },
  partial: { icon: Clock, color: '#F59E0B', label: 'Partial Alibi' },
  weak: { icon: AlertTriangle, color: '#EF4444', label: 'Weak Alibi' },
  none: { icon: X, color: '#DC2626', label: 'No Alibi' },
};

// =============================================================================
// Component
// =============================================================================

export default function VictimologyGraph({
  victim,
  relatedPersons,
  connections,
  onPersonClick,
  onConnectionClick
}: VictimologyGraphProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPerson, setSelectedPerson] = useState<VictimologyPerson | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<VictimologyConnection | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [showLegend, setShowLegend] = useState(true);
  const [filterRole, setFilterRole] = useState<string | null>(null);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: Math.max(500, window.innerHeight * 0.5)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build graph data
  const graphData = useMemo(() => {
    const allPersons = [victim, ...relatedPersons];
    const filteredPersons = filterRole
      ? allPersons.filter(p => p.role === filterRole || p.id === victim.id)
      : allPersons;

    const personIds = new Set(filteredPersons.map(p => p.id));

    const nodes = filteredPersons.map(person => {
      const suspicionSize = person.role === 'suspect' && person.suspicionLevel
        ? 15 + (person.suspicionLevel * 15)
        : person.role === 'victim'
          ? 25
          : 12;

      return {
        id: person.id,
        name: person.name,
        role: person.role,
        color: roleColors[person.role] || roleColors.associate,
        size: suspicionSize,
        person
      };
    });

    const links = connections
      .filter(c => personIds.has(c.from) && personIds.has(c.to))
      .map(conn => ({
        source: conn.from,
        target: conn.to,
        color: conn.suspicious ? '#DC2626' : connectionTypeColors[conn.type] || connectionTypeColors.unknown,
        width: 1 + (conn.strength * 3),
        dashed: conn.suspicious,
        label: conn.label,
        connection: conn
      }));

    return { nodes, links };
  }, [victim, relatedPersons, connections, filterRole]);

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    setSelectedPerson(node.person);
    setSelectedConnection(null);
    onPersonClick?.(node.person);

    // Highlight connected nodes
    const connected = new Set<string>([node.id]);
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      if (sourceId === node.id) connected.add(targetId);
      if (targetId === node.id) connected.add(sourceId);
    });
    setHighlightedNodes(connected);
  }, [graphData.links, onPersonClick]);

  // Handle link click
  const handleLinkClick = useCallback((link: any) => {
    setSelectedConnection(link.connection);
    setSelectedPerson(null);
    onConnectionClick?.(link.connection);
  }, [onConnectionClick]);

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    setSelectedPerson(null);
    setSelectedConnection(null);
    setHighlightedNodes(new Set());
  }, []);

  // Custom node renderer
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(node.id);
    const isSelected = selectedPerson?.id === node.id;
    const isVictim = node.role === 'victim';

    // Draw outer ring for victim
    if (isVictim) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size + 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw suspicion indicator for suspects
    if (node.role === 'suspect' && node.person.suspicionLevel) {
      const suspLevel = node.person.suspicionLevel;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size + 3, 0, 2 * Math.PI * suspLevel);
      ctx.strokeStyle = suspLevel > 0.7 ? '#DC2626' : suspLevel > 0.4 ? '#F59E0B' : '#6B7280';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted ? node.color : `${node.color}60`;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // Draw name label
    const fontSize = Math.max(10 / globalScale, 8);
    ctx.font = `${isVictim ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isHighlighted ? '#1F2937' : '#9CA3AF';
    ctx.fillText(node.name, node.x, node.y + node.size + 4);

    // Draw role badge
    const roleFontSize = Math.max(8 / globalScale, 6);
    ctx.font = `${roleFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = isHighlighted ? node.color : `${node.color}80`;
    ctx.fillText(node.role.toUpperCase(), node.x, node.y + node.size + 4 + fontSize + 2);
  }, [highlightedNodes, selectedPerson]);

  // Custom link renderer
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(sourceId) || highlightedNodes.has(targetId);
    const isSelected = selectedConnection?.from === sourceId && selectedConnection?.to === targetId;

    const start = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.id === link.source);
    const end = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.id === link.target);

    if (!start || !end) return;

    ctx.strokeStyle = isHighlighted ? link.color : `${link.color}40`;
    ctx.lineWidth = (isSelected ? link.width * 1.5 : link.width) / globalScale;

    if (link.dashed) {
      ctx.setLineDash([5 / globalScale, 5 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    // Draw curved line for better visibility
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const perpX = -dy * 0.1;
    const perpY = dx * 0.1;
    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, end.x, end.y);
    ctx.stroke();

    // Draw label
    if (isHighlighted && globalScale > 0.8) {
      const labelX = ctrlX;
      const labelY = ctrlY;
      const fontSize = Math.max(9 / globalScale, 7);

      // Background
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(link.label).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(labelX - textWidth / 2 - 3, labelY - fontSize / 2 - 2, textWidth + 6, fontSize + 4);

      // Border
      if (link.dashed) {
        ctx.strokeStyle = '#DC262640';
        ctx.lineWidth = 1 / globalScale;
        ctx.setLineDash([]);
        ctx.strokeRect(labelX - textWidth / 2 - 3, labelY - fontSize / 2 - 2, textWidth + 6, fontSize + 4);
      }

      // Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = link.dashed ? '#DC2626' : '#374151';
      ctx.fillText(link.label, labelX, labelY);
    }

    ctx.setLineDash([]);
  }, [highlightedNodes, selectedConnection, graphData.nodes]);

  // Get suspicion level description
  const getSuspicionDescription = (level: number): { text: string; color: string } => {
    if (level >= 0.8) return { text: 'Critical', color: '#DC2626' };
    if (level >= 0.6) return { text: 'High', color: '#F59E0B' };
    if (level >= 0.4) return { text: 'Moderate', color: '#EAB308' };
    if (level >= 0.2) return { text: 'Low', color: '#22C55E' };
    return { text: 'Minimal', color: '#6B7280' };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-600" />
            Victimology Analysis
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Mapping relationships between victim and persons of interest
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Role filter */}
          <select
            value={filterRole || ''}
            onChange={(e) => setFilterRole(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Roles</option>
            <option value="suspect">Suspects Only</option>
            <option value="witness">Witnesses Only</option>
            <option value="family">Family Only</option>
          </select>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
          >
            Legend {showLegend ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Roles</h4>
            <div className="space-y-1">
              {Object.entries(roleColors).map(([role, color]) => (
                <div key={role} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="capitalize">{role}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Relationship Types</h4>
            <div className="space-y-1">
              {Object.entries(connectionTypeColors).slice(0, 4).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-0.5" style={{ backgroundColor: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Alibi Strength</h4>
            <div className="space-y-1">
              {Object.entries(alibiIcons).map(([key, { icon: Icon, color, label }]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Indicators</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-6 border-t-2 border-dashed border-red-500" />
                <span>Suspicious Link</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-200" />
                <span>High Suspicion</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graph */}
      <div ref={containerRef} className="bg-white rounded-lg border overflow-hidden">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeRelSize={1}
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={handleBackgroundClick}
          cooldownTime={2000}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.2}
        />
      </div>

      {/* Selected Person Detail Panel */}
      {selectedPerson && (
        <div className="bg-white rounded-lg border shadow-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: roleColors[selectedPerson.role] }}
              >
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedPerson.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full text-white capitalize"
                    style={{ backgroundColor: roleColors[selectedPerson.role] }}
                  >
                    {selectedPerson.role}
                  </span>
                  {selectedPerson.relationship && (
                    <span className="text-sm text-gray-600">{selectedPerson.relationship}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedPerson(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {selectedPerson.description && (
            <p className="text-gray-600 mb-4">{selectedPerson.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Suspicion Level */}
            {selectedPerson.role === 'suspect' && selectedPerson.suspicionLevel !== undefined && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Suspicion Level
                </h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${selectedPerson.suspicionLevel * 100}%`,
                        backgroundColor: getSuspicionDescription(selectedPerson.suspicionLevel).color
                      }}
                    />
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: getSuspicionDescription(selectedPerson.suspicionLevel).color }}
                  >
                    {getSuspicionDescription(selectedPerson.suspicionLevel).text}
                  </span>
                </div>
              </div>
            )}

            {/* Alibi Strength */}
            {selectedPerson.alibiStrength && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Alibi Assessment
                </h4>
                {(() => {
                  const alibi = alibiIcons[selectedPerson.alibiStrength];
                  const AlibiIcon = alibi.icon;
                  return (
                    <div className="flex items-center gap-2" style={{ color: alibi.color }}>
                      <AlibiIcon className="w-5 h-5" />
                      <span className="font-medium">{alibi.label}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Motive */}
            {selectedPerson.motive && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Potential Motive
                </h4>
                <p className="text-sm text-gray-600">{selectedPerson.motive}</p>
              </div>
            )}

            {/* Opportunity */}
            {selectedPerson.opportunity && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Opportunity
                </h4>
                <p className="text-sm text-gray-600">{selectedPerson.opportunity}</p>
              </div>
            )}
          </div>

          {/* Behavioral Flags */}
          {selectedPerson.behavioralFlags && selectedPerson.behavioralFlags.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Behavioral Red Flags
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPerson.behavioralFlags.map((flag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Statements */}
          {selectedPerson.keyStatements && selectedPerson.keyStatements.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Key Interview Statements
              </h4>
              <div className="space-y-2">
                {selectedPerson.keyStatements.map((statement, i) => (
                  <blockquote
                    key={i}
                    className="text-sm text-gray-600 italic border-l-2 border-blue-300 pl-3 py-1 bg-blue-50 rounded-r"
                  >
                    "{statement}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Connection Detail Panel */}
      {selectedConnection && (
        <div className="bg-white rounded-lg border shadow-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Relationship: {selectedConnection.label}
              {selectedConnection.suspicious && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  SUSPICIOUS
                </span>
              )}
            </h3>
            <button
              onClick={() => setSelectedConnection(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Connection Type</p>
              <p className="font-medium capitalize" style={{ color: connectionTypeColors[selectedConnection.type] }}>
                {selectedConnection.type}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Relationship Strength</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${selectedConnection.strength * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(selectedConnection.strength * 100)}%</span>
              </div>
            </div>
          </div>

          {selectedConnection.evidenceNotes && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Evidence Notes</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{selectedConnection.evidenceNotes}</p>
            </div>
          )}

          {selectedConnection.interviewInsights && selectedConnection.interviewInsights.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Interview Insights</h4>
              <ul className="space-y-2">
                {selectedConnection.interviewInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
