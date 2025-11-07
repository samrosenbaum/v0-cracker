'use client';

import { useState, useEffect, useMemo } from 'react';
import { Database } from '@/app/types/database';
import {
  Clock,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
  ZoomIn,
  ZoomOut,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';

type TimelineEvent = Database['public']['Tables']['timeline_events']['Row'];
type CaseEntity = Database['public']['Tables']['case_entities']['Row'];

interface TimelineVisualizationProps {
  caseId: string;
  events: TimelineEvent[];
  entities: CaseEntity[];
  onEventClick?: (event: TimelineEvent) => void;
  onAddEvent?: () => void;
}

const eventTypeColors: Record<string, string> = {
  victim_action: 'bg-red-500',
  suspect_movement: 'bg-orange-500',
  witness_account: 'bg-blue-500',
  evidence_found: 'bg-purple-500',
  phone_call: 'bg-green-500',
  transaction: 'bg-yellow-500',
  sighting: 'bg-pink-500',
  other: 'bg-gray-500',
};

const eventTypeLabels: Record<string, string> = {
  victim_action: 'Victim Action',
  suspect_movement: 'Suspect Movement',
  witness_account: 'Witness Account',
  evidence_found: 'Evidence Found',
  phone_call: 'Phone Call',
  transaction: 'Transaction',
  sighting: 'Sighting',
  other: 'Other',
};

const verificationIcons = {
  verified: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  unverified: <AlertCircle className="w-4 h-4 text-yellow-600" />,
  disputed: <AlertCircle className="w-4 h-4 text-orange-600" />,
  false: <XCircle className="w-4 h-4 text-red-600" />,
};

export default function TimelineVisualization({
  caseId,
  events,
  entities,
  onEventClick,
  onAddEvent,
}: TimelineVisualizationProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    Object.keys(eventTypeColors)
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [verificationFilter, setVerificationFilter] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'type' | 'entity'>('time');

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!selectedTypes.includes(event.event_type)) return false;
      if (selectedEntityId && event.primary_entity_id !== selectedEntityId) return false;
      if (verificationFilter && event.verification_status !== verificationFilter) return false;
      return true;
    });
  }, [events, selectedTypes, selectedEntityId, verificationFilter]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    sorted.sort((a, b) => {
      const aTime = a.event_time || a.time_range_start || a.created_at;
      const bTime = b.event_time || b.time_range_start || b.created_at;

      if (sortBy === 'time') {
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      } else if (sortBy === 'type') {
        return a.event_type.localeCompare(b.event_type);
      } else {
        const aEntity = entities.find(e => e.id === a.primary_entity_id)?.name || '';
        const bEntity = entities.find(e => e.id === b.primary_entity_id)?.name || '';
        return aEntity.localeCompare(bEntity);
      }
    });
    return sorted;
  }, [filteredEvents, sortBy, entities]);

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    if (sortedEvents.length === 0) return { start: new Date(), end: new Date(), duration: 0 };

    const times = sortedEvents.map((event) => {
      const time = event.event_time || event.time_range_start || event.created_at;
      return new Date(time).getTime();
    });

    const start = new Date(Math.min(...times));
    const end = new Date(Math.max(...times));
    const duration = differenceInMinutes(end, start);

    return { start, end, duration };
  }, [sortedEvents]);

  const toggleEventType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const getEntityName = (entityId: string | null) => {
    if (!entityId) return 'Unknown';
    const entity = entities.find((e) => e.id === entityId);
    return entity?.name || 'Unknown';
  };

  const formatEventTime = (event: TimelineEvent) => {
    if (event.event_time) {
      return format(parseISO(event.event_time), 'MMM d, yyyy h:mm a');
    } else if (event.time_range_start && event.time_range_end) {
      return `${format(parseISO(event.time_range_start), 'h:mm a')} - ${format(
        parseISO(event.time_range_end),
        'h:mm a'
      )}`;
    } else if (event.event_date) {
      return format(parseISO(event.event_date), 'MMM d, yyyy');
    }
    return 'Time unknown';
  };

  // Calculate event position on timeline
  const getEventPosition = (event: TimelineEvent): number => {
    if (timelineBounds.duration === 0) return 50;

    const eventTime = event.event_time || event.time_range_start || event.created_at;
    const eventTimestamp = new Date(eventTime).getTime();
    const startTimestamp = timelineBounds.start.getTime();
    const percentage = ((eventTimestamp - startTimestamp) / (timelineBounds.duration * 60 * 1000)) * 100;

    return Math.max(0, Math.min(100, percentage));
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Case Timeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''} shown
            {timelineBounds.duration > 0 && ` • ${Math.round(timelineBounds.duration / 60)} hours span`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'time' | 'type' | 'entity')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="time">Sort by Time</option>
            <option value="type">Sort by Type</option>
            <option value="entity">Sort by Entity</option>
          </select>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1 hover:bg-gray-100 rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs px-2 text-gray-600">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
              className="p-1 hover:bg-gray-100 rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {onAddEvent && (
            <button
              onClick={onAddEvent}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add Event
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

        {/* Event Type Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Event Types</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventTypeColors).map(([type, colorClass]) => {
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleEventType(type)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                  {eventTypeLabels[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Entity Filter */}
        {entities.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Filter by Entity</label>
            <select
              value={selectedEntityId || ''}
              onChange={(e) => setSelectedEntityId(e.target.value || null)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Entities</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.role || entity.entity_type})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Verification Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Verification Status</label>
          <div className="flex gap-2">
            {['verified', 'unverified', 'disputed', 'false'].map((status) => (
              <button
                key={status}
                onClick={() => setVerificationFilter(verificationFilter === status ? null : status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  verificationFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      {sortedEvents.length > 0 ? (
        <div className="bg-white rounded-lg border p-6">
          {/* Timeline axis */}
          {timelineBounds.duration > 0 && (
            <div className="mb-8 relative">
              <div className="h-1 bg-gray-200 rounded-full relative">
                <div className="absolute left-0 top-0 h-full w-full">
                  {/* Time markers */}
                  {[0, 25, 50, 75, 100].map((percentage) => (
                    <div
                      key={percentage}
                      className="absolute top-0 -translate-x-1/2"
                      style={{ left: `${percentage}%` }}
                    >
                      <div className="w-0.5 h-3 bg-gray-400" />
                      <div className="text-xs text-gray-600 mt-2 -translate-x-1/2 absolute left-1/2 whitespace-nowrap">
                        {format(
                          new Date(
                            timelineBounds.start.getTime() +
                              (timelineBounds.duration * 60 * 1000 * percentage) / 100
                          ),
                          'MMM d, h:mm a'
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Events */}
          <div className="space-y-4" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
            {sortedEvents.map((event, index) => {
              const position = getEventPosition(event);
              const colorClass = eventTypeColors[event.event_type] || eventTypeColors.other;
              const isExpanded = expandedEvent === event.id;
              const entityName = getEntityName(event.primary_entity_id);

              return (
                <div
                  key={event.id}
                  className="relative"
                  style={{
                    marginLeft: sortBy === 'time' ? `${position}%` : '0',
                    maxWidth: sortBy === 'time' ? `${100 - position}%` : '100%',
                  }}
                >
                  <div
                    onClick={() => {
                      setExpandedEvent(isExpanded ? null : event.id);
                      onEventClick?.(event);
                    }}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  >
                    {/* Event header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Event type indicator */}
                        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                          <Clock className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            {event.verification_status && verificationIcons[event.verification_status]}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatEventTime(event)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {event.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {entityName}
                            </span>
                          </div>

                          {event.time_precision && event.time_precision !== 'exact' && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                              {event.time_precision}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expand button */}
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {event.description && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                            <p className="text-sm text-gray-600">{event.description}</p>
                          </div>
                        )}

                        {event.verified_by && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Verified By</p>
                            <p className="text-sm text-gray-600">{event.verified_by}</p>
                          </div>
                        )}

                        {event.source_type && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Source</p>
                            <p className="text-sm text-gray-600 capitalize">{event.source_type}</p>
                          </div>
                        )}

                        {event.confidence_score !== null && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Confidence</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    event.confidence_score >= 75
                                      ? 'bg-green-500'
                                      : event.confidence_score >= 50
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${event.confidence_score}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{event.confidence_score}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Found</h3>
          <p className="text-gray-600 mb-6">
            {events.length === 0
              ? 'No timeline events have been added yet.'
              : 'No events match the selected filters.'}
          </p>
          {onAddEvent && (
            <button
              onClick={onAddEvent}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Add First Event
            </button>
          )}
        </div>
      )}
    </div>
  );
}
