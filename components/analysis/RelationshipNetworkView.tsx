'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Filter, Link2, Radar, Users } from 'lucide-react';
import type { RelationshipNetworkAnalysis, RelationshipNode } from '@/lib/cold-case-analyzer';
import { cleanText, displayText } from '@/lib/display-utils';

interface RelationshipNetworkViewProps {
  analysis: RelationshipNetworkAnalysis;
}

const roleLabels: Record<RelationshipNode['role'], string> = {
  victim: 'Victim',
  suspect: 'Suspect',
  witness: 'Witness',
  family: 'Family',
  associate: 'Associate',
  unknown: 'Unspecified',
};

export default function RelationshipNetworkView({ analysis }: RelationshipNetworkViewProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | RelationshipNode['role']>('all');
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);

  const sanitizedNodes = useMemo(() => {
    return (analysis.nodes || []).map(node => ({
      ...node,
      name: displayText(node.name, 'Unnamed person'),
      alibi: displayText(node.alibi, 'Not documented'),
      motive: displayText(node.motive, 'Not documented'),
      opportunity: displayText(node.opportunity, 'Not documented'),
    }));
  }, [analysis.nodes]);

  const filteredNodes = useMemo(() => {
    return sanitizedNodes.filter(node => {
      if (roleFilter !== 'all' && node.role !== roleFilter) {
        return false;
      }
      if (showSuspiciousOnly) {
        return node.connections?.some(connection => connection.suspicious);
      }
      return true;
    });
  }, [sanitizedNodes, roleFilter, showSuspiciousOnly]);

  const suspiciousEdges = useMemo(
    () => (analysis.relationships || []).filter(edge => edge.suspicious),
    [analysis.relationships],
  );

  const hiddenConnections = analysis.hiddenConnections || [];

  const clusterCount = analysis.clusters?.length ?? 0;

  const highlightedConnectors = useMemo(() => {
    const connectors = analysis.insights?.primaryConnectors || [];
    const cleaned = connectors
      .map(name => cleanText(name))
      .filter((name): name is string => Boolean(name));
    return cleaned.slice(0, 3).join(', ') || 'Not identified';
  }, [analysis.insights?.primaryConnectors]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">People tracked</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{sanitizedNodes.length}</p>
          <p className="text-xs text-gray-500">{clusterCount} network cluster{clusterCount === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Suspicious links</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{suspiciousEdges.length}</p>
          <p className="text-xs text-gray-500">flagged for re-interview</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Hidden connections</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{hiddenConnections.length}</p>
          <p className="text-xs text-gray-500">surfaced via documents</p>
        </div>
        <div className="rounded-xl border bg-slate-900 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-white/80">Primary connectors</p>
          <p className="mt-2 text-sm font-semibold">{highlightedConnectors}</p>
          <p className="text-xs text-white/70">Monitor their communications this week</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            Role
            <select
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value as typeof roleFilter)}
              className="rounded-lg border px-2 py-1 text-sm"
            >
              <option value="all">All roles</option>
              {Object.keys(roleLabels).map(role => (
                <option key={role} value={role}>
                  {roleLabels[role as RelationshipNode['role']]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showSuspiciousOnly}
              onChange={event => setShowSuspiciousOnly(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Only show suspicious links
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredNodes.map(node => (
          <div key={node.name} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{roleLabels[node.role]}</p>
                <p className="text-lg font-semibold text-gray-900">{node.name}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {node.connections?.length ?? 0} connections
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <p>Alibi: {node.alibi}</p>
              <p>Motive: {node.motive}</p>
              <p>Opportunity: {node.opportunity}</p>
            </div>
            {node.connections?.length ? (
              <div className="mt-4 space-y-2">
                {node.connections.slice(0, 3).map(connection => (
                  <div key={`${node.name}-${connection.to}-${connection.type}`} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between text-gray-900">
                      <span>{connection.to}</span>
                      {connection.suspicious && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Suspicious
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{connection.type} link · Strength {(connection.strength * 100).toFixed(0)}%</p>
                    <p className="mt-1 text-xs text-gray-600">{displayText(connection.notes, 'No notes recorded')}</p>
                  </div>
                ))}
                {node.connections.length > 3 && (
                  <p className="text-xs text-gray-500">+{node.connections.length - 3} more connections logged</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-500">No active links recorded yet.</p>
            )}
          </div>
        ))}
      </div>

      {hiddenConnections.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Link2 className="h-4 w-4 text-gray-500" />
            Hidden connections to review
          </div>
          <div className="mt-4 space-y-3">
            {hiddenConnections.map(connection => {
              const personOne = displayText(connection.person1, 'Not specified');
              const personTwo = displayText(connection.person2, 'Not specified');
              return (
                <div key={`${connection.person1}-${connection.person2}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between text-gray-900">
                    <span>
                      {personOne} ⇄ {personTwo}
                    </span>
                    <span className="text-xs uppercase text-gray-500">{displayText(connection.connectionType, 'link')}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{displayText(connection.whyItMatters, 'Significance not provided')}</p>
                  {connection.discoveredFrom?.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Found in: {connection.discoveredFrom.join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.clusters && analysis.clusters.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Radar className="h-4 w-4 text-gray-500" />
            Cluster insights
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {analysis.clusters.map(cluster => (
              <div key={cluster.label} className="rounded-lg border p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">{cluster.label}</p>
                <p className="text-lg font-semibold text-gray-900">{cluster.members.length} members</p>
                <p className="text-xs text-gray-600">Dominant role: {roleLabels[cluster.dominantRole]}</p>
                <p className="mt-2 text-xs text-gray-600">Risk: {cluster.riskLevel}</p>
                <p className="mt-2 text-xs text-gray-500">{cluster.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.insights && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-gray-500" />
            Follow-up recommendations
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Primary connectors</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {(analysis.insights.primaryConnectors || ['Not identified']).map(connector => (
                  <li key={connector}>{displayText(connector, 'Not identified')}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Potential conflicts</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {(analysis.insights.potentialConflicts || ['None flagged']).map(conflict => (
                  <li key={conflict}>{displayText(conflict, 'None flagged')}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Recommended follow-up</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {(analysis.insights.recommendedFollowUp || ['No actions recorded']).map(action => (
                  <li key={action}>{displayText(action, 'No actions recorded')}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
