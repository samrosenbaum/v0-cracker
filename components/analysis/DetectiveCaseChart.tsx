'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Users,
  MapPin,
  Clock,
  FileText,
  AlertTriangle,
  Phone,
  Car,
  Package,
  Link2,
  MessageSquare,
  X,
  ChevronRight,
  ChevronDown,
  Eye,
  Quote,
  Target,
  Shield,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Filter,
  Search,
  Pin
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface CaseEntity {
  id: string;
  name: string;
  type: 'person' | 'location' | 'evidence' | 'vehicle' | 'event' | 'document';
  role?: string;
  description?: string;
  imageUrl?: string;
  color?: string;
  position?: { x: number; y: number };
  pinned?: boolean;
  metadata?: Record<string, any>;
}

export interface CaseConnection {
  id: string;
  from: string;
  to: string;
  type: string;
  label: string;
  color?: string;
  dashed?: boolean;
  suspicious?: boolean;
  evidenceStrength: 'confirmed' | 'probable' | 'possible' | 'unverified';
  notes?: string;
  sourceQuotes?: Array<{
    speaker: string;
    quote: string;
    date: string;
    significance: 'critical' | 'important' | 'relevant' | 'background';
  }>;
}

export interface TimelineEvent {
  id: string;
  time: string;
  date: string;
  title: string;
  description: string;
  personId: string;
  personName: string;
  location?: string;
  type: 'action' | 'sighting' | 'call' | 'transaction' | 'evidence';
  verified: boolean;
  disputed?: boolean;
  sourceQuote?: string;
}

export interface InsightCard {
  id: string;
  type: 'behavioral_flag' | 'inconsistency' | 'alibi_gap' | 'hidden_connection' | 'motive' | 'opportunity' | 'evidence_gap';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedEntityIds: string[];
  sourceQuotes?: Array<{
    speaker: string;
    quote: string;
    date: string;
  }>;
  actionable?: string;
}

export interface DetectiveCaseChartProps {
  caseTitle: string;
  caseDate: string;
  entities: CaseEntity[];
  connections: CaseConnection[];
  timeline: TimelineEvent[];
  insights: InsightCard[];
  onEntityClick?: (entity: CaseEntity) => void;
  onConnectionClick?: (connection: CaseConnection) => void;
  onInsightClick?: (insight: InsightCard) => void;
}

// =============================================================================
// Constants
// =============================================================================

const entityIcons: Record<string, any> = {
  person: User,
  location: MapPin,
  evidence: Package,
  vehicle: Car,
  event: Clock,
  document: FileText,
};

const entityColors: Record<string, string> = {
  person: '#3B82F6',
  location: '#10B981',
  evidence: '#8B5CF6',
  vehicle: '#F59E0B',
  event: '#EC4899',
  document: '#6B7280',
};

const roleColors: Record<string, string> = {
  victim: '#DC2626',
  suspect: '#F59E0B',
  witness: '#3B82F6',
  family: '#8B5CF6',
};

const insightTypeStyles: Record<string, { icon: any; color: string; bgColor: string }> = {
  behavioral_flag: { icon: AlertTriangle, color: '#F59E0B', bgColor: '#FEF3C7' },
  inconsistency: { icon: AlertTriangle, color: '#EF4444', bgColor: '#FEE2E2' },
  alibi_gap: { icon: Clock, color: '#8B5CF6', bgColor: '#EDE9FE' },
  hidden_connection: { icon: Link2, color: '#EC4899', bgColor: '#FCE7F3' },
  motive: { icon: Target, color: '#DC2626', bgColor: '#FEE2E2' },
  opportunity: { icon: Eye, color: '#F97316', bgColor: '#FFEDD5' },
  evidence_gap: { icon: Search, color: '#6366F1', bgColor: '#E0E7FF' },
};

const severityColors: Record<string, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
};

// =============================================================================
// Sub-components
// =============================================================================

function EntityCard({
  entity,
  isSelected,
  onClick,
  connections
}: {
  entity: CaseEntity;
  isSelected: boolean;
  onClick: () => void;
  connections: CaseConnection[];
}) {
  const Icon = entityIcons[entity.type] || User;
  const bgColor = entity.role ? roleColors[entity.role] || entityColors[entity.type] : entityColors[entity.type];
  const connectionCount = connections.filter(c => c.from === entity.id || c.to === entity.id).length;

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-red-500 ring-offset-2 scale-105 z-10' : 'hover:scale-102 hover:shadow-lg'}
      `}
    >
      {/* Photo/card style with tape effect */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-3 bg-amber-200/80 rotate-1" />

      <div className={`
        bg-white rounded shadow-md border-2 border-gray-200 p-3 w-36
        ${entity.role === 'victim' ? 'border-red-400' : ''}
        ${entity.role === 'suspect' ? 'border-amber-400' : ''}
      `}>
        {/* Photo placeholder */}
        <div
          className="w-full h-24 rounded flex items-center justify-center mb-2"
          style={{ backgroundColor: `${bgColor}20` }}
        >
          <Icon className="w-10 h-10" style={{ color: bgColor }} />
        </div>

        {/* Name */}
        <h4 className="font-bold text-gray-900 text-sm text-center truncate">{entity.name}</h4>

        {/* Role badge */}
        {entity.role && (
          <div className="flex justify-center mt-1">
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full text-white capitalize"
              style={{ backgroundColor: roleColors[entity.role] || bgColor }}
            >
              {entity.role}
            </span>
          </div>
        )}

        {/* Connection count */}
        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-500">
          <Link2 className="w-3 h-3" />
          {connectionCount} connections
        </div>

        {/* Pin indicator */}
        {entity.pinned && (
          <div className="absolute -top-1 -right-1">
            <Pin className="w-4 h-4 text-red-500 transform rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionLine({
  connection,
  fromPos,
  toPos,
  isHighlighted,
  onClick
}: {
  connection: CaseConnection;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  isHighlighted: boolean;
  onClick: () => void;
}) {
  // Calculate control point for curved line (red string effect)
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;

  // Add some natural curve/droop to the "string"
  const droopAmount = Math.min(30, Math.sqrt(dx * dx + dy * dy) * 0.1);
  const ctrlX = midX;
  const ctrlY = midY + droopAmount;

  const pathD = `M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`;

  const lineColor = connection.suspicious ? '#DC2626' : connection.color || '#DC2626';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Main line (red string) */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={isHighlighted ? 3 : 2}
        strokeDasharray={connection.dashed ? '8,4' : undefined}
        opacity={isHighlighted ? 1 : 0.6}
        className="transition-all duration-200"
      />

      {/* Label */}
      {isHighlighted && (
        <g transform={`translate(${ctrlX}, ${ctrlY - 10})`}>
          <rect
            x={-50}
            y={-10}
            width={100}
            height={20}
            rx={4}
            fill="white"
            stroke={lineColor}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#374151"
            fontSize={10}
            fontWeight={500}
          >
            {connection.label}
          </text>
        </g>
      )}
    </g>
  );
}

function TimelineCard({
  event,
  isSelected,
  onClick
}: {
  event: TimelineEvent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const typeColors: Record<string, string> = {
    action: '#3B82F6',
    sighting: '#8B5CF6',
    call: '#10B981',
    transaction: '#F59E0B',
    evidence: '#EC4899',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative p-3 bg-white rounded-lg border cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}
        ${event.disputed ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}
      `}
    >
      {/* Time badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-2 py-0.5 text-xs font-mono font-bold rounded"
          style={{ backgroundColor: `${typeColors[event.type]}20`, color: typeColors[event.type] }}
        >
          {event.time}
        </span>
        {event.verified && <Shield className="w-3 h-3 text-green-500" />}
        {event.disputed && <AlertTriangle className="w-3 h-3 text-amber-500" />}
      </div>

      <h4 className="font-medium text-gray-900 text-sm">{event.title}</h4>
      <p className="text-xs text-gray-600 mt-1">{event.personName}</p>

      {event.location && (
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          <MapPin className="w-3 h-3" />
          {event.location}
        </div>
      )}
    </div>
  );
}

function InsightPanel({
  insight,
  entities,
  isExpanded,
  onToggle
}: {
  insight: InsightCard;
  entities: CaseEntity[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const style = insightTypeStyles[insight.type] || insightTypeStyles.behavioral_flag;
  const InsightIcon = style.icon;
  const relatedEntities = entities.filter(e => insight.relatedEntityIds.includes(e.id));

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{ borderColor: style.color, backgroundColor: style.bgColor }}
    >
      <div
        onClick={onToggle}
        className="flex items-start gap-3 p-3 cursor-pointer"
      >
        <InsightIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: style.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm">{insight.title}</h4>
            <span
              className="px-1.5 py-0.5 text-xs font-medium rounded text-white capitalize"
              style={{ backgroundColor: severityColors[insight.severity] }}
            >
              {insight.severity}
            </span>
          </div>
          {!isExpanded && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{insight.description}</p>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-white/50">
          <p className="text-sm text-gray-700">{insight.description}</p>

          {/* Related entities */}
          {relatedEntities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Related</p>
              <div className="flex flex-wrap gap-1">
                {relatedEntities.map(entity => (
                  <span
                    key={entity.id}
                    className="px-2 py-0.5 text-xs rounded-full bg-white border"
                    style={{ borderColor: roleColors[entity.role || ''] || entityColors[entity.type] }}
                  >
                    {entity.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source quotes */}
          {insight.sourceQuotes && insight.sourceQuotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Interview Evidence</p>
              <div className="space-y-2">
                {insight.sourceQuotes.map((quote, i) => (
                  <blockquote key={i} className="text-sm border-l-2 pl-3 py-1 bg-white rounded-r" style={{ borderColor: style.color }}>
                    <p className="italic text-gray-700">"{quote.quote}"</p>
                    <footer className="text-xs text-gray-500 mt-1">
                      - {quote.speaker}, {quote.date}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Actionable recommendation */}
          {insight.actionable && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
              <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">{insight.actionable}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function DetectiveCaseChart({
  caseTitle,
  caseDate,
  entities,
  connections,
  timeline,
  insights,
  onEntityClick,
  onConnectionClick,
  onInsightClick
}: DetectiveCaseChartProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<CaseEntity | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<CaseConnection | null>(null);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'board' | 'timeline' | 'insights'>('board');

  // Calculate entity positions in a radial layout around victim
  const entityPositions = useMemo(() => {
    const victim = entities.find(e => e.role === 'victim');
    const others = entities.filter(e => e.role !== 'victim');

    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = 400;
    const centerY = 300;

    if (victim) {
      positions[victim.id] = { x: centerX, y: centerY };
    }

    // Arrange others in concentric circles
    const suspects = others.filter(e => e.role === 'suspect');
    const witnesses = others.filter(e => e.role === 'witness');
    const rest = others.filter(e => e.role !== 'suspect' && e.role !== 'witness');

    // Inner circle - suspects (close to victim)
    suspects.forEach((entity, i) => {
      const angle = (2 * Math.PI * i) / suspects.length - Math.PI / 2;
      positions[entity.id] = {
        x: centerX + Math.cos(angle) * 180,
        y: centerY + Math.sin(angle) * 150
      };
    });

    // Middle circle - witnesses
    witnesses.forEach((entity, i) => {
      const angle = (2 * Math.PI * i) / witnesses.length + Math.PI / 4;
      positions[entity.id] = {
        x: centerX + Math.cos(angle) * 320,
        y: centerY + Math.sin(angle) * 250
      };
    });

    // Outer positions - other entities
    rest.forEach((entity, i) => {
      const angle = (2 * Math.PI * i) / rest.length;
      positions[entity.id] = {
        x: centerX + Math.cos(angle) * 420,
        y: centerY + Math.sin(angle) * 320
      };
    });

    return positions;
  }, [entities]);

  // Filter entities
  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      if (filterType && entity.type !== filterType && entity.role !== filterType) return false;
      if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [entities, filterType, searchQuery]);

  // Get highlighted connections
  const highlightedConnections = useMemo(() => {
    if (!selectedEntity) return new Set<string>();
    return new Set(
      connections
        .filter(c => c.from === selectedEntity.id || c.to === selectedEntity.id)
        .map(c => c.id)
    );
  }, [selectedEntity, connections]);

  // Handle entity click
  const handleEntityClick = useCallback((entity: CaseEntity) => {
    setSelectedEntity(prev => prev?.id === entity.id ? null : entity);
    setSelectedConnection(null);
    onEntityClick?.(entity);
  }, [onEntityClick]);

  // Handle connection click
  const handleConnectionClick = useCallback((connection: CaseConnection) => {
    setSelectedConnection(prev => prev?.id === connection.id ? null : connection);
    setSelectedEntity(null);
    onConnectionClick?.(connection);
  }, [onConnectionClick]);

  // Toggle insight expansion
  const toggleInsight = useCallback((insightId: string) => {
    setExpandedInsights(prev => {
      const next = new Set(prev);
      if (next.has(insightId)) {
        next.delete(insightId);
      } else {
        next.add(insightId);
      }
      return next;
    });
  }, []);

  // Group insights by severity
  const groupedInsights = useMemo(() => {
    const groups: Record<string, InsightCard[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    insights.forEach(insight => {
      groups[insight.severity].push(insight);
    });
    return groups;
  }, [insights]);

  return (
    <div className="bg-stone-100 rounded-xl shadow-lg overflow-hidden">
      {/* Header - Cork board style */}
      <div className="bg-gradient-to-b from-stone-600 to-stone-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-red-400" />
              {caseTitle}
            </h1>
            <p className="text-stone-300 text-sm">{caseDate}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-stone-500/50 border border-stone-400 rounded-lg text-white placeholder-stone-300 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            {/* Filter */}
            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="px-3 py-2 bg-stone-500/50 border border-stone-400 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="suspect">Suspects</option>
              <option value="witness">Witnesses</option>
              <option value="location">Locations</option>
              <option value="evidence">Evidence</option>
            </select>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4">
          {(['board', 'timeline', 'insights'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-2 rounded-t-lg text-sm font-medium transition-all capitalize
                ${activeTab === tab
                  ? 'bg-stone-100 text-stone-900'
                  : 'bg-stone-500/30 text-stone-300 hover:bg-stone-500/50'}
              `}
            >
              {tab === 'board' && <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Case Board</span>}
              {tab === 'timeline' && <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline</span>}
              {tab === 'insights' && (
                <span className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Insights
                  {insights.filter(i => i.severity === 'critical').length > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {insights.filter(i => i.severity === 'critical').length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="p-6">
        {/* Case Board Tab */}
        {activeTab === 'board' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main board area */}
            <div className="lg:col-span-2">
              <div
                ref={boardRef}
                className="relative bg-amber-100/50 rounded-lg border-4 border-amber-900/20 overflow-hidden"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(139,69,19,0.03) 20px, rgba(139,69,19,0.03) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(139,69,19,0.03) 20px, rgba(139,69,19,0.03) 21px)',
                  height: '600px'
                }}
              >
                {/* SVG layer for connections (red strings) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ pointerEvents: 'none' }}>
                  {connections
                    .filter(c =>
                      filteredEntities.some(e => e.id === c.from) &&
                      filteredEntities.some(e => e.id === c.to)
                    )
                    .map(connection => {
                      const fromPos = entityPositions[connection.from];
                      const toPos = entityPositions[connection.to];
                      if (!fromPos || !toPos) return null;

                      return (
                        <ConnectionLine
                          key={connection.id}
                          connection={connection}
                          fromPos={{ x: fromPos.x, y: fromPos.y }}
                          toPos={{ x: toPos.x, y: toPos.y }}
                          isHighlighted={!selectedEntity || highlightedConnections.has(connection.id)}
                          onClick={() => handleConnectionClick(connection)}
                        />
                      );
                    })}
                </svg>

                {/* Entity cards */}
                {filteredEntities.map(entity => {
                  const pos = entityPositions[entity.id];
                  if (!pos) return null;

                  return (
                    <div
                      key={entity.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: pos.x, top: pos.y }}
                    >
                      <EntityCard
                        entity={entity}
                        isSelected={selectedEntity?.id === entity.id}
                        onClick={() => handleEntityClick(entity)}
                        connections={connections}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail panel */}
            <div className="space-y-4">
              {/* Selected entity details */}
              {selectedEntity && (
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900">{selectedEntity.name}</h3>
                    <button
                      onClick={() => setSelectedEntity(null)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedEntity.role && (
                    <span
                      className="inline-block px-2 py-0.5 text-xs font-medium rounded-full text-white mb-3 capitalize"
                      style={{ backgroundColor: roleColors[selectedEntity.role] }}
                    >
                      {selectedEntity.role}
                    </span>
                  )}

                  {selectedEntity.description && (
                    <p className="text-sm text-gray-600 mb-4">{selectedEntity.description}</p>
                  )}

                  {/* Connections from this entity */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Connections</h4>
                    <div className="space-y-2">
                      {connections
                        .filter(c => c.from === selectedEntity.id || c.to === selectedEntity.id)
                        .map(conn => {
                          const otherId = conn.from === selectedEntity.id ? conn.to : conn.from;
                          const otherEntity = entities.find(e => e.id === otherId);
                          return (
                            <div
                              key={conn.id}
                              onClick={() => handleConnectionClick(conn)}
                              className={`
                                p-2 rounded border cursor-pointer text-sm
                                ${conn.suspicious ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}
                                hover:shadow-sm
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{otherEntity?.name}</span>
                                {conn.suspicious && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              </div>
                              <span className="text-xs text-gray-500">{conn.label}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Selected connection details */}
              {selectedConnection && (
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900">{selectedConnection.label}</h3>
                    <button
                      onClick={() => setSelectedConnection(null)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedConnection.suspicious && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200 mb-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-700 font-medium">Flagged as Suspicious</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Evidence Strength</p>
                      <span className={`
                        inline-block px-2 py-0.5 text-xs font-medium rounded capitalize
                        ${selectedConnection.evidenceStrength === 'confirmed' ? 'bg-green-100 text-green-700' : ''}
                        ${selectedConnection.evidenceStrength === 'probable' ? 'bg-blue-100 text-blue-700' : ''}
                        ${selectedConnection.evidenceStrength === 'possible' ? 'bg-amber-100 text-amber-700' : ''}
                        ${selectedConnection.evidenceStrength === 'unverified' ? 'bg-gray-100 text-gray-700' : ''}
                      `}>
                        {selectedConnection.evidenceStrength}
                      </span>
                    </div>

                    {selectedConnection.notes && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Notes</p>
                        <p className="text-sm text-gray-700">{selectedConnection.notes}</p>
                      </div>
                    )}

                    {/* Source quotes from interviews */}
                    {selectedConnection.sourceQuotes && selectedConnection.sourceQuotes.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-2">Interview Evidence</p>
                        <div className="space-y-2">
                          {selectedConnection.sourceQuotes.map((quote, i) => (
                            <blockquote
                              key={i}
                              className={`
                                text-sm border-l-2 pl-3 py-1 rounded-r
                                ${quote.significance === 'critical' ? 'bg-red-50 border-red-400' : ''}
                                ${quote.significance === 'important' ? 'bg-amber-50 border-amber-400' : ''}
                                ${quote.significance === 'relevant' ? 'bg-blue-50 border-blue-400' : ''}
                                ${quote.significance === 'background' ? 'bg-gray-50 border-gray-400' : ''}
                              `}
                            >
                              <p className="italic text-gray-700">"{quote.quote}"</p>
                              <footer className="text-xs text-gray-500 mt-1">
                                - {quote.speaker}, {quote.date}
                              </footer>
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick insights preview */}
              {!selectedEntity && !selectedConnection && (
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    Key Insights
                  </h3>
                  <div className="space-y-2">
                    {insights.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 3).map(insight => (
                      <div
                        key={insight.id}
                        className="p-2 rounded border cursor-pointer hover:shadow-sm"
                        style={{
                          backgroundColor: insightTypeStyles[insight.type]?.bgColor,
                          borderColor: insightTypeStyles[insight.type]?.color
                        }}
                        onClick={() => {
                          setActiveTab('insights');
                          toggleInsight(insight.id);
                        }}
                      >
                        <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                        <p className="text-xs text-gray-600 line-clamp-1">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-20 top-0 bottom-0 w-0.5 bg-gray-300" />

              {/* Events */}
              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <div key={event.id} className="flex items-start gap-4">
                    {/* Time */}
                    <div className="w-16 text-right">
                      <span className="text-sm font-mono font-bold text-gray-900">{event.time}</span>
                      <p className="text-xs text-gray-500">{event.date}</p>
                    </div>

                    {/* Dot */}
                    <div className="relative">
                      <div className={`
                        w-4 h-4 rounded-full border-2 bg-white z-10 relative
                        ${event.verified ? 'border-green-500' : event.disputed ? 'border-amber-500' : 'border-gray-300'}
                      `} />
                    </div>

                    {/* Event card */}
                    <div className="flex-1 pb-4">
                      <TimelineCard
                        event={event}
                        isSelected={false}
                        onClick={() => {}}
                      />

                      {event.sourceQuote && (
                        <blockquote className="mt-2 text-sm italic text-gray-600 border-l-2 border-blue-300 pl-3 bg-blue-50 py-1 rounded-r">
                          "{event.sourceQuote}"
                        </blockquote>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {Object.entries(groupedInsights).map(([severity, severityInsights]) => {
              if (severityInsights.length === 0) return null;

              return (
                <div key={severity}>
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 capitalize">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: severityColors[severity] }}
                    />
                    {severity} Priority ({severityInsights.length})
                  </h3>
                  <div className="space-y-3">
                    {severityInsights.map(insight => (
                      <InsightPanel
                        key={insight.id}
                        insight={insight}
                        entities={entities}
                        isExpanded={expandedInsights.has(insight.id)}
                        onToggle={() => toggleInsight(insight.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
