'use client';

import { useState, useMemo } from 'react';
import { Database } from '@/app/types/database';
import {
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MessageSquare,
  FileText,
  Calendar
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type AlibiEntry = Database['public']['Tables']['alibi_entries']['Row'];
type CaseEntity = Database['public']['Tables']['case_entities']['Row'];

interface AlibiTrackerProps {
  caseId: string;
  alibis: AlibiEntry[];
  entities: CaseEntity[];
  onAlibiClick?: (alibi: AlibiEntry) => void;
  onAddAlibi?: (subjectId: string) => void;
}

interface GroupedAlibi {
  subject: CaseEntity;
  versions: AlibiEntry[];
  inconsistencies: Inconsistency[];
}

interface Inconsistency {
  version1: number;
  version2: number;
  type: 'location' | 'activity' | 'time' | 'corroboration';
  detail: string;
}

const verificationStatusColors = {
  verified: 'bg-green-100 text-green-800 border-green-300',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  unverified: 'bg-gray-100 text-gray-800 border-gray-300',
  contradicted: 'bg-orange-100 text-orange-800 border-orange-300',
  false: 'bg-red-100 text-red-800 border-red-300',
};

const verificationIcons = {
  verified: <CheckCircle2 className="w-4 h-4" />,
  partial: <AlertTriangle className="w-4 h-4" />,
  unverified: <Clock className="w-4 h-4" />,
  contradicted: <AlertTriangle className="w-4 h-4" />,
  false: <XCircle className="w-4 h-4" />,
};

export default function AlibiTracker({
  caseId,
  alibis,
  entities,
  onAlibiClick,
  onAddAlibi,
}: AlibiTrackerProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [showOnlyInconsistencies, setShowOnlyInconsistencies] = useState(false);

  // Group alibis by subject
  const groupedAlibis = useMemo(() => {
    const groups: GroupedAlibi[] = [];

    // Group by subject
    const alibisBySubject = new Map<string, AlibiEntry[]>();
    alibis.forEach((alibi) => {
      const existing = alibisBySubject.get(alibi.subject_entity_id) || [];
      existing.push(alibi);
      alibisBySubject.set(alibi.subject_entity_id, existing);
    });

    // Sort versions and detect inconsistencies for each subject
    alibisBySubject.forEach((subjectAlibis, subjectId) => {
      const subject = entities.find((e) => e.id === subjectId);
      if (!subject) return;

      // Sort by version number
      const sortedVersions = [...subjectAlibis].sort((a, b) => a.version_number - b.version_number);

      // Detect inconsistencies
      const inconsistencies: Inconsistency[] = [];
      for (let i = 0; i < sortedVersions.length - 1; i++) {
        const v1 = sortedVersions[i];
        const v2 = sortedVersions[i + 1];

        if (v1.location_claimed !== v2.location_claimed) {
          inconsistencies.push({
            version1: v1.version_number,
            version2: v2.version_number,
            type: 'location',
            detail: `Location changed from "${v1.location_claimed}" to "${v2.location_claimed}"`,
          });
        }

        if (v1.activity_claimed !== v2.activity_claimed) {
          inconsistencies.push({
            version1: v1.version_number,
            version2: v2.version_number,
            type: 'activity',
            detail: `Activity changed from "${v1.activity_claimed}" to "${v2.activity_claimed}"`,
          });
        }

        if (v1.alibi_start_time !== v2.alibi_start_time || v1.alibi_end_time !== v2.alibi_end_time) {
          inconsistencies.push({
            version1: v1.version_number,
            version2: v2.version_number,
            type: 'time',
            detail: `Time range changed`,
          });
        }

        const v1Corroborators = v1.corroborating_entity_ids || [];
        const v2Corroborators = v2.corroborating_entity_ids || [];
        if (JSON.stringify(v1Corroborators.sort()) !== JSON.stringify(v2Corroborators.sort())) {
          inconsistencies.push({
            version1: v1.version_number,
            version2: v2.version_number,
            type: 'corroboration',
            detail: `Corroborating witnesses changed`,
          });
        }
      }

      groups.push({
        subject,
        versions: sortedVersions,
        inconsistencies,
      });
    });

    return groups.sort((a, b) => b.inconsistencies.length - a.inconsistencies.length);
  }, [alibis, entities]);

  // Filter by selected subject
  const filteredGroups = useMemo(() => {
    let filtered = groupedAlibis;

    if (selectedSubjectId) {
      filtered = filtered.filter((g) => g.subject.id === selectedSubjectId);
    }

    if (showOnlyInconsistencies) {
      filtered = filtered.filter((g) => g.inconsistencies.length > 0);
    }

    return filtered;
  }, [groupedAlibis, selectedSubjectId, showOnlyInconsistencies]);

  const toggleVersionExpanded = (alibiId: string) => {
    setExpandedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alibiId)) {
        newSet.delete(alibiId);
      } else {
        newSet.add(alibiId);
      }
      return newSet;
    });
  };

  const getEntityName = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId);
    return entity?.name || 'Unknown';
  };

  const formatTimeRange = (start: string, end: string) => {
    try {
      return `${format(parseISO(start), 'MMM d, h:mm a')} - ${format(parseISO(end), 'h:mm a')}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alibi Tracker</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredGroups.length} suspect{filteredGroups.length !== 1 ? 's' : ''} •{' '}
            {alibis.length} alibi version{alibis.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyInconsistencies}
              onChange={(e) => setShowOnlyInconsistencies(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Show only inconsistencies</span>
          </label>
        </div>
      </div>

      {/* Subject Filter */}
      {entities.filter((e) => e.role === 'suspect' || groupedAlibis.some((g) => g.subject.id === e.id)).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Filter by Subject</label>
          <select
            value={selectedSubjectId || ''}
            onChange={(e) => setSelectedSubjectId(e.target.value || null)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Subjects</option>
            {entities
              .filter((e) => groupedAlibis.some((g) => g.subject.id === e.id))
              .map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Alibi Groups */}
      {filteredGroups.length > 0 ? (
        <div className="space-y-6">
          {filteredGroups.map((group) => (
            <div key={group.subject.id} className="bg-white rounded-lg border overflow-hidden">
              {/* Subject Header */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{group.subject.name}</h3>
                      <p className="text-sm text-gray-600 capitalize">
                        {group.subject.role || group.subject.entity_type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {group.inconsistencies.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {group.inconsistencies.length} inconsistenc{group.inconsistencies.length !== 1 ? 'ies' : 'y'}
                        </span>
                      </div>
                    )}

                    <span className="text-sm text-gray-600">
                      {group.versions.length} version{group.versions.length !== 1 ? 's' : ''}
                    </span>

                    {onAddAlibi && (
                      <button
                        onClick={() => onAddAlibi(group.subject.id)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        + Add Version
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inconsistencies Summary */}
              {group.inconsistencies.length > 0 && (
                <div className="px-6 py-4 bg-red-50 border-b border-red-100">
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Detected Inconsistencies
                  </h4>
                  <div className="space-y-2">
                    {group.inconsistencies.map((inc, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className="flex items-center gap-1 text-red-600 font-medium flex-shrink-0">
                          <span>V{inc.version1}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>V{inc.version2}</span>
                        </div>
                        <div className="flex-1">
                          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium uppercase mr-2">
                            {inc.type}
                          </span>
                          <span className="text-gray-700">{inc.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alibi Versions */}
              <div className="divide-y">
                {group.versions.map((alibi, versionIndex) => {
                  const isExpanded = expandedVersions.has(alibi.id);
                  const statusColor = verificationStatusColors[alibi.verification_status || 'unverified'];
                  const statusIcon = verificationIcons[alibi.verification_status || 'unverified'];

                  // Check if this version has inconsistencies
                  const hasInconsistencies = group.inconsistencies.some(
                    (inc) => inc.version1 === alibi.version_number || inc.version2 === alibi.version_number
                  );

                  return (
                    <div
                      key={alibi.id}
                      className={`p-6 hover:bg-gray-50 cursor-pointer ${
                        hasInconsistencies ? 'bg-red-50/30' : ''
                      }`}
                      onClick={() => {
                        toggleVersionExpanded(alibi.id);
                        onAlibiClick?.(alibi);
                      }}
                    >
                      {/* Version Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="text-2xl font-bold text-gray-400">V{alibi.version_number}</div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded border text-xs font-medium flex items-center gap-1 ${statusColor}`}>
                                {statusIcon}
                                {alibi.verification_status}
                              </span>
                              {hasInconsistencies && (
                                <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Inconsistent
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Time Range */}
                              <div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <Clock className="w-4 h-4" />
                                  <span className="font-medium">Time Range</span>
                                </div>
                                <p className="text-sm text-gray-900 ml-6">
                                  {formatTimeRange(alibi.alibi_start_time, alibi.alibi_end_time)}
                                </p>
                              </div>

                              {/* Location */}
                              <div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <MapPin className="w-4 h-4" />
                                  <span className="font-medium">Location</span>
                                </div>
                                <p className="text-sm text-gray-900 ml-6">{alibi.location_claimed}</p>
                              </div>

                              {/* Activity */}
                              <div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <MessageSquare className="w-4 h-4" />
                                  <span className="font-medium">Activity</span>
                                </div>
                                <p className="text-sm text-gray-900 ml-6">{alibi.activity_claimed}</p>
                              </div>

                              {/* Statement Date */}
                              <div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <Calendar className="w-4 h-4" />
                                  <span className="font-medium">Statement Date</span>
                                </div>
                                <p className="text-sm text-gray-900 ml-6">
                                  {format(parseISO(alibi.statement_date), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button className="text-gray-400 hover:text-gray-600">
                          <ChevronRight
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-4 ml-14">
                          {alibi.full_statement && (
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <FileText className="w-4 h-4" />
                                Full Statement
                              </div>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{alibi.full_statement}</p>
                            </div>
                          )}

                          {alibi.interviewer && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Interviewer</p>
                              <p className="text-sm text-gray-600">{alibi.interviewer}</p>
                            </div>
                          )}

                          {alibi.corroborating_entity_ids && alibi.corroborating_entity_ids.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">Corroborating Witnesses</p>
                              <div className="flex flex-wrap gap-2">
                                {alibi.corroborating_entity_ids.map((entityId) => (
                                  <span
                                    key={entityId}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                  >
                                    {getEntityName(entityId)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {alibi.verification_notes && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Verification Notes</p>
                              <p className="text-sm text-gray-600">{alibi.verification_notes}</p>
                            </div>
                          )}

                          {alibi.changes_from_previous && versionIndex > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-sm font-medium text-yellow-900 mb-1">Changes from Previous Version</p>
                              <p className="text-sm text-yellow-800">{alibi.changes_from_previous}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-12 text-center">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Alibis Found</h3>
          <p className="text-gray-600 mb-6">
            {alibis.length === 0
              ? 'No alibi statements have been recorded yet.'
              : 'No alibis match the selected filters.'}
          </p>
          {onAddAlibi && entities.filter((e) => e.role === 'suspect').length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Add an alibi for:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {entities
                  .filter((e) => e.role === 'suspect')
                  .map((suspect) => (
                    <button
                      key={suspect.id}
                      onClick={() => onAddAlibi(suspect.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {suspect.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
