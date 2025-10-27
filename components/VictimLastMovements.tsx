'use client'

import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Phone,
  CreditCard,
  Camera,
  Flag,
  ChevronDown,
  ChevronRight,
  Eye,
  Activity
} from 'lucide-react';
import type {
  VictimTimelineAnalysis,
  VictimMovement,
  TimelineGap,
  LastSeenPerson,
  CriticalAreaOfInterest,
  RoutineDeviation
} from '@/lib/victim-timeline';

interface VictimLastMovementsProps {
  timeline: VictimTimelineAnalysis;
  routineDeviations?: RoutineDeviation[];
}

export default function VictimLastMovements({
  timeline,
  routineDeviations = []
}: VictimLastMovementsProps) {
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    timeline: true,
    gaps: true,
    lastSeen: true,
    criticalAreas: true,
    deviations: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'exact': return 'text-green-600 bg-green-50 border-green-200';
      case 'approximate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'estimated': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getEvidenceIcon = (evidence: string) => {
    if (evidence.toLowerCase().includes('camera')) return <Camera className="w-4 h-4" />;
    if (evidence.toLowerCase().includes('phone')) return <Phone className="w-4 h-4" />;
    if (evidence.toLowerCase().includes('card') || evidence.toLowerCase().includes('transaction'))
      return <CreditCard className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Victim's Last Known Movements</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-purple-100 text-sm">Last Confirmed Alive</p>
            <p className="text-xl font-semibold">
              {new Date(timeline.lastConfirmedAlive.time).toLocaleString()}
            </p>
            <p className="text-sm mt-1">{timeline.lastConfirmedAlive.location}</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">Last Seen By</p>
            <p className="text-xl font-semibold">
              {timeline.lastConfirmedAlive.witnessedBy.join(', ') || 'Unknown'}
            </p>
            <p className="text-sm mt-1">{timeline.lastConfirmedAlive.confidence} confidence</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">Time Until Incident</p>
            <p className="text-xl font-semibold">
              {Math.round(
                (new Date(timeline.incidentTime).getTime() -
                  new Date(timeline.lastConfirmedAlive.time).getTime()) /
                  (1000 * 60 * 60)
              )}{' '}
              hours
            </p>
            <p className="text-sm mt-1">{timeline.movements.length} movements tracked</p>
          </div>
        </div>
      </div>

      {/* Timeline Gaps - CRITICAL SECTION */}
      {timeline.timelineGaps.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-red-300 shadow-lg">
          <button
            onClick={() => toggleSection('gaps')}
            className="w-full p-6 flex items-center justify-between hover:bg-red-50"
          >
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-900">
                  Timeline Gaps ({timeline.timelineGaps.length})
                </h2>
                <p className="text-sm text-red-600">Critical periods with no confirmed activity</p>
              </div>
            </div>
            {expandedSections.gaps ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSections.gaps && (
            <div className="px-6 pb-6 space-y-4">
              {timeline.timelineGaps
                .sort((a, b) => b.investigationPriority - a.investigationPriority)
                .map((gap, idx) => (
                  <div
                    key={idx}
                    className={`p-5 border-2 rounded-lg ${getSignificanceColor(gap.significance)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="w-5 h-5" />
                          <span className="font-bold text-lg">
                            {formatDuration(gap.durationMinutes)} gap
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded uppercase ${
                              gap.significance === 'critical'
                                ? 'bg-red-600 text-white'
                                : gap.significance === 'high'
                                ? 'bg-orange-600 text-white'
                                : 'bg-yellow-600 text-white'
                            }`}
                          >
                            {gap.significance}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-medium">From:</span>{' '}
                            {new Date(gap.startTime).toLocaleString()} at {gap.lastKnownLocation}
                          </p>
                          <p>
                            <span className="font-medium">To:</span>{' '}
                            {new Date(gap.endTime).toLocaleString()} at {gap.nextKnownLocation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Investigation Priority</p>
                        <p className="text-2xl font-bold text-red-600">
                          {Math.round(gap.investigationPriority * 100)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white rounded border border-current/20">
                      <p className="font-semibold text-sm mb-2">🔍 Critical Questions:</p>
                      <ul className="space-y-1 text-sm">
                        {gap.questionsToAnswer.map((q, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-gray-400">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3 p-4 bg-white rounded border border-current/20">
                      <p className="font-semibold text-sm mb-2">📋 Evidence to Collect:</p>
                      <ul className="space-y-1 text-sm">
                        {gap.potentialEvidence.map((e, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-gray-400">•</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Last Seen Persons */}
      {timeline.lastSeenPersons.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-orange-300 shadow-lg">
          <button
            onClick={() => toggleSection('lastSeen')}
            className="w-full p-6 flex items-center justify-between hover:bg-orange-50"
          >
            <div className="flex items-center space-x-3">
              <Eye className="w-6 h-6 text-orange-600" />
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-900">
                  Last Seen With ({timeline.lastSeenPersons.length})
                </h2>
                <p className="text-sm text-orange-600">People who saw victim closest to incident</p>
              </div>
            </div>
            {expandedSections.lastSeen ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSections.lastSeen && (
            <div className="px-6 pb-6 space-y-4">
              {timeline.lastSeenPersons.map((person, idx) => (
                <div
                  key={idx}
                  className={`p-5 border-2 rounded-lg ${
                    person.priority === 'critical'
                      ? 'border-red-400 bg-red-50'
                      : 'border-orange-400 bg-orange-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="font-bold text-lg">{person.name}</span>
                        <span className="text-sm text-gray-600">({person.relationship})</span>
                        {person.priority === 'critical' && (
                          <Flag className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Last Contact:</span>{' '}
                          {new Date(person.timeOfLastContact).toLocaleString()}
                        </p>
                        <p>
                          <span className="font-medium">Location:</span>{' '}
                          {person.locationOfLastContact}
                        </p>
                        <p>
                          <span className="font-medium">Circumstances:</span>{' '}
                          {person.circumstancesOfEncounter}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          person.investigationStatus === 'not_interviewed'
                            ? 'bg-red-100 text-red-800'
                            : person.investigationStatus === 'interviewed'
                            ? 'bg-yellow-100 text-yellow-800'
                            : person.investigationStatus === 'suspect'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {person.investigationStatus.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {person.redFlags.length > 0 && (
                    <div className="mt-3 p-3 bg-white rounded border-2 border-red-300">
                      <p className="font-semibold text-sm text-red-800 mb-2">
                        🚩 Red Flags:
                      </p>
                      <ul className="space-y-1 text-sm">
                        {person.redFlags.map((flag, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-white rounded border border-current/20">
                    <p className="font-semibold text-sm mb-1">Behavior Notes:</p>
                    <p className="text-sm">
                      <span className="font-medium">Person:</span> {person.personBehaviorNotes}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Victim:</span> {person.victimBehaviorNotes}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routine Deviations */}
      {routineDeviations.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-300 shadow-sm">
          <button
            onClick={() => toggleSection('deviations')}
            className="w-full p-6 flex items-center justify-between hover:bg-purple-50"
          >
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Routine Deviations ({routineDeviations.length})
              </h2>
            </div>
            {expandedSections.deviations ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSections.deviations && (
            <div className="px-6 pb-6 space-y-3">
              {routineDeviations.map((deviation, idx) => (
                <div
                  key={idx}
                  className="p-4 border-l-4 border-purple-400 bg-purple-50 rounded"
                >
                  <p className="font-semibold text-gray-900 mb-2">{deviation.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Normal:</p>
                      <p className="text-gray-900">{deviation.victimNormalRoutine}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Actual:</p>
                      <p className="text-gray-900">{deviation.actualBehavior}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Significance:</span> {deviation.significance}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Investigation needed:</span>{' '}
                    {deviation.investigationNeeded}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visual Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => toggleSection('timeline')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Complete Timeline ({timeline.movements.length} movements)
            </h2>
          </div>
          {expandedSections.timeline ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {expandedSections.timeline && (
          <div className="px-6 pb-6">
            <div className="relative space-y-6">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />

              {timeline.movements.map((movement, idx) => (
                <div key={idx} className="relative pl-16">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-6 w-5 h-5 rounded-full border-4 ${
                      movement.significance === 'critical'
                        ? 'bg-red-500 border-red-200'
                        : movement.significance === 'high'
                        ? 'bg-orange-500 border-orange-200'
                        : 'bg-blue-500 border-blue-200'
                    }`}
                  />

                  <div
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedMovement === `${idx}`
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                    onClick={() =>
                      setSelectedMovement(selectedMovement === `${idx}` ? null : `${idx}`)
                    }
                  >
                    {/* Time and confidence */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold">
                          {new Date(movement.timestamp).toLocaleString()}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded border ${getConfidenceColor(
                            movement.timestampConfidence
                          )}`}
                        >
                          {movement.timestampConfidence}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded uppercase ${
                          movement.significance === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : movement.significance === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {movement.significance}
                      </span>
                    </div>

                    {/* Activity */}
                    <p className="text-gray-900 font-medium mb-2">{movement.activity}</p>

                    {/* Location */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span>{movement.location}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${getConfidenceColor(
                          movement.locationConfidence
                        )}`}
                      >
                        {movement.locationConfidence}
                      </span>
                    </div>

                    {/* People */}
                    {(movement.witnessedBy.length > 0 || movement.accompaniedBy.length > 0) && (
                      <div className="flex items-start space-x-2 text-sm text-gray-600 mb-2">
                        <Users className="w-4 h-4 mt-0.5" />
                        <div>
                          {movement.accompaniedBy.length > 0 && (
                            <p>
                              <span className="font-medium">With:</span>{' '}
                              {movement.accompaniedBy.join(', ')}
                            </p>
                          )}
                          {movement.witnessedBy.length > 0 && (
                            <p>
                              <span className="font-medium">Seen by:</span>{' '}
                              {movement.witnessedBy.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Evidence */}
                    {movement.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {movement.evidence.map((ev, i) => (
                          <div
                            key={i}
                            className="flex items-center space-x-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200"
                          >
                            {getEvidenceIcon(ev)}
                            <span>{ev}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Source */}
                    <p className="text-xs text-gray-500 mt-2">Source: {movement.source}</p>

                    {/* Expanded details */}
                    {selectedMovement === `${idx}` && movement.investigatorNotes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Investigator Notes:
                        </p>
                        <p className="text-sm text-gray-600">{movement.investigatorNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Critical Areas */}
      {timeline.criticalAreas.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-300 shadow-sm">
          <button
            onClick={() => toggleSection('criticalAreas')}
            className="w-full p-6 flex items-center justify-between hover:bg-yellow-50"
          >
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Critical Areas Needing Investigation ({timeline.criticalAreas.length})
              </h2>
            </div>
            {expandedSections.criticalAreas ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSections.criticalAreas && (
            <div className="px-6 pb-6 space-y-4">
              {timeline.criticalAreas.map((area, idx) => (
                <div key={idx} className="p-5 border-2 border-yellow-400 bg-yellow-50 rounded-lg">
                  <h3 className="font-bold text-lg mb-2">{area.location}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {new Date(area.timeRange.start).toLocaleString()} -{' '}
                    {new Date(area.timeRange.end).toLocaleString()}
                  </p>
                  <p className="text-sm font-medium mb-3">{area.whyCritical}</p>

                  <div className="space-y-3">
                    {area.investigationActions.map((action, i) => (
                      <div key={i} className="p-3 bg-white rounded border border-yellow-300">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-sm">{action.action}</p>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              action.priority === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : action.priority === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">Effort: {action.estimatedEffort}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
