'use client'

import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, Users, Calendar, Flag, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import type { TimelineEvent, Conflict, PersonMention, UnfollowedTip } from '@/lib/ai-analysis';

interface CaseTimelineProps {
  timeline: TimelineEvent[];
  conflicts: Conflict[];
  personMentions: PersonMention[];
  unfollowedTips: UnfollowedTip[];
  keyInsights: string[];
}

export default function CaseTimeline({
  timeline,
  conflicts,
  personMentions,
  unfollowedTips,
  keyInsights
}: CaseTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'conflicts' | 'tips'>('all');
  const [expandedSections, setExpandedSections] = useState({
    insights: true,
    timeline: true,
    conflicts: true,
    suspects: true,
    tips: true,
  });

  // Group timeline by date
  const timelineByDate = timeline.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  // Sort dates
  const sortedDates = Object.keys(timelineByDate).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  // Find conflicts for each event
  const getEventConflicts = (eventId: string) => {
    return conflicts.filter(c => c.events.some(e => e.id === eventId));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => toggleSection('insights')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <Eye className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Key Insights</h2>
          </div>
          {expandedSections.insights ?
            <ChevronDown className="w-5 h-5 text-gray-400" /> :
            <ChevronRight className="w-5 h-5 text-gray-400" />
          }
        </button>
        {expandedSections.insights && (
          <div className="px-6 pb-6 space-y-3">
            {keyInsights.map((insight, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="w-2 h-2 rounded-full bg-purple-600 mt-2" />
                <p className="text-gray-800">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflicts Summary */}
      {conflicts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => toggleSection('conflicts')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Conflicts & Inconsistencies ({conflicts.length})
              </h2>
            </div>
            {expandedSections.conflicts ?
              <ChevronDown className="w-5 h-5 text-gray-400" /> :
              <ChevronRight className="w-5 h-5 text-gray-400" />
            }
          </button>
          {expandedSections.conflicts && (
            <div className="px-6 pb-6 space-y-4">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(conflict.severity)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{conflict.description}</h3>
                    <span className="px-2 py-1 text-xs font-medium rounded uppercase">
                      {conflict.severity}
                    </span>
                  </div>
                  <p className="text-sm mb-3">{conflict.details}</p>
                  {conflict.recommendation && (
                    <div className="p-3 bg-white/50 rounded border border-current/20">
                      <p className="text-sm font-medium">Recommendation:</p>
                      <p className="text-sm">{conflict.recommendation}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center space-x-2 text-sm">
                    <Users className="w-4 h-4" />
                    <span>Affects: {conflict.affectedPersons.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Person Mentions - Potential Overlooked Suspects */}
      {personMentions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => toggleSection('suspects')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Frequently Mentioned Persons
              </h2>
            </div>
            {expandedSections.suspects ?
              <ChevronDown className="w-5 h-5 text-gray-400" /> :
              <ChevronRight className="w-5 h-5 text-gray-400" />
            }
          </button>
          {expandedSections.suspects && (
            <div className="px-6 pb-6">
              <div className="grid gap-4">
                {personMentions
                  .sort((a, b) => b.suspicionScore - a.suspicionScore)
                  .map((person, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{person.name}</h3>
                          {person.aliases.length > 0 && (
                            <p className="text-sm text-gray-600">AKA: {person.aliases.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Suspicion Score</p>
                            <p className="text-lg font-bold text-orange-600">
                              {Math.round(person.suspicionScore * 100)}%
                            </p>
                          </div>
                          {person.suspicionScore > 0.7 && (
                            <Flag className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Mentioned by:</span> {person.mentionedBy.join(', ')}
                          <span className="text-gray-500"> ({person.mentionCount} times)</span>
                        </p>
                        {person.role && (
                          <p className="text-gray-700">
                            <span className="font-medium">Role:</span> {person.role}
                          </p>
                        )}
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-700 mb-1">Context:</p>
                          {person.contexts.slice(0, 2).map((context, i) => (
                            <p key={i} className="text-gray-600 italic">&quot;{context}&quot;</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unfollowed Tips */}
      {unfollowedTips.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => toggleSection('tips')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Flag className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Unfollowed Tips ({unfollowedTips.length})
              </h2>
            </div>
            {expandedSections.tips ?
              <ChevronDown className="w-5 h-5 text-gray-400" /> :
              <ChevronRight className="w-5 h-5 text-gray-400" />
            }
          </button>
          {expandedSections.tips && (
            <div className="px-6 pb-6 space-y-3">
              {unfollowedTips.map((tip, idx) => (
                <div key={idx} className="p-4 border-l-4 border-yellow-400 bg-yellow-50 rounded">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{tip.description}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      tip.priority === 'high' ? 'bg-red-100 text-red-800' :
                      tip.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tip.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Source:</span> {tip.source}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Suggested action:</span> {tip.suggestedAction}
                  </p>
                  <p className="text-xs text-gray-600 italic">{tip.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => toggleSection('timeline')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Event Timeline ({timeline.length} events)
            </h2>
          </div>
          {expandedSections.timeline ?
            <ChevronDown className="w-5 h-5 text-gray-400" /> :
            <ChevronRight className="w-5 h-5 text-gray-400" />
          }
        </button>
        {expandedSections.timeline && (
          <div className="px-6 pb-6">
            <div className="space-y-8">
              {sortedDates.map(date => (
                <div key={date} className="relative">
                  {/* Date header */}
                  <div className="sticky top-0 bg-white z-10 py-2 mb-4 border-b-2 border-blue-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </h3>
                    </div>
                  </div>

                  {/* Timeline events for this date */}
                  <div className="space-y-4 relative before:absolute before:left-4 before:top-0 before:h-full before:w-0.5 before:bg-gray-200">
                    {timelineByDate[date]
                      .sort((a, b) => {
                        const timeA = a.startTime || a.time || '00:00';
                        const timeB = b.startTime || b.time || '00:00';
                        return timeA.localeCompare(timeB);
                      })
                      .map((event) => {
                        const eventConflicts = getEventConflicts(event.id);
                        const hasConflict = eventConflicts.length > 0;

                        return (
                          <div
                            key={event.id}
                            className={`ml-10 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              hasConflict
                                ? 'border-red-300 bg-red-50 hover:border-red-400'
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            } ${selectedEvent === event.id ? 'ring-2 ring-blue-500' : ''}`}
                            onClick={() => setSelectedEvent(event.id === selectedEvent ? null : event.id)}
                          >
                            {/* Timeline dot */}
                            <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                              hasConflict ? 'bg-red-500' : 'bg-blue-500'
                            }`} />

                            {/* Event header */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Clock className="w-4 h-4 text-gray-600" />
                                  <span className="font-semibold text-gray-900">
                                    {event.startTime && event.endTime
                                      ? `${event.startTime} - ${event.endTime}`
                                      : event.startTime || event.time || 'Time unknown'}
                                  </span>
                                  {hasConflict && (
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                  )}
                                </div>
                                <p className="text-gray-800 font-medium">{event.description}</p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${
                                event.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                                event.confidence > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {Math.round(event.confidence * 100)}% confidence
                              </span>
                            </div>

                            {/* Event details */}
                            <div className="space-y-2 text-sm">
                              {event.location && (
                                <div className="flex items-center space-x-2 text-gray-600">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.involvedPersons.length > 0 && (
                                <div className="flex items-center space-x-2 text-gray-600">
                                  <Users className="w-4 h-4" />
                                  <span>{event.involvedPersons.join(', ')}</span>
                                </div>
                              )}
                              <p className="text-gray-500 text-xs">
                                Source: {event.source} ({event.sourceType})
                              </p>
                            </div>

                            {/* Show conflicts if event is selected */}
                            {selectedEvent === event.id && eventConflicts.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-red-200 space-y-2">
                                {eventConflicts.map((conflict, idx) => (
                                  <div key={idx} className="p-3 bg-white rounded border border-red-200">
                                    <p className="font-medium text-red-800 mb-1">
                                      ⚠️ {conflict.description}
                                    </p>
                                    <p className="text-sm text-gray-700">{conflict.details}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
