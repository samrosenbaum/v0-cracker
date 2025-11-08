'use client';

import { useState, useEffect } from 'react';
import { Database } from '@/app/types/database';
import { X, ArrowRight, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

type CaseEntity = Database['public']['Tables']['case_entities']['Row'];
type CaseConnection = Database['public']['Tables']['case_connections']['Row'];
type ConnectionInsert = Database['public']['Tables']['case_connections']['Insert'];

interface ConnectionFormModalProps {
  caseId: string;
  entities: CaseEntity[];
  connection?: CaseConnection | null;
  preselectedFromEntityId?: string;
  preselectedToEntityId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const connectionTypes = [
  'saw',
  'knows',
  'owns',
  'located_at',
  'related_to',
  'alibi_with',
  'employed_by',
  'family_of',
  'friend_of',
  'witnessed',
  'found_at',
  'used',
  'other',
];

const confidenceLevels: Array<{ value: 'confirmed' | 'probable' | 'possible' | 'unverified'; label: string; color: string }> = [
  { value: 'confirmed', label: 'Confirmed', color: '#10B981' },
  { value: 'probable', label: 'Probable', color: '#3B82F6' },
  { value: 'possible', label: 'Possible', color: '#F59E0B' },
  { value: 'unverified', label: 'Unverified', color: '#6B7280' },
];

const lineStyles: Array<{ value: 'solid' | 'dashed' | 'dotted'; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export default function ConnectionFormModal({
  caseId,
  entities,
  connection,
  preselectedFromEntityId,
  preselectedToEntityId,
  isOpen,
  onClose,
  onSuccess,
}: ConnectionFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<ConnectionInsert>>({
    from_entity_id: preselectedFromEntityId || '',
    to_entity_id: preselectedToEntityId || '',
    connection_type: 'related_to',
    label: null,
    description: null,
    confidence: 'unverified',
    evidence_notes: null,
    line_style: 'solid',
    line_color: null,
    line_weight: 2,
    metadata: {},
  });

  useEffect(() => {
    if (connection) {
      setFormData({
        from_entity_id: connection.from_entity_id,
        to_entity_id: connection.to_entity_id,
        connection_type: connection.connection_type,
        label: connection.label,
        description: connection.description,
        confidence: connection.confidence || 'unverified',
        evidence_notes: connection.evidence_notes,
        line_style: connection.line_style || 'solid',
        line_color: connection.line_color,
        line_weight: connection.line_weight || 2,
        metadata: connection.metadata as any,
      });
    } else {
      setFormData({
        from_entity_id: preselectedFromEntityId || '',
        to_entity_id: preselectedToEntityId || '',
        connection_type: 'related_to',
        label: null,
        description: null,
        confidence: 'unverified',
        evidence_notes: null,
        line_style: 'solid',
        line_color: null,
        line_weight: 2,
        metadata: {},
      });
    }
  }, [connection, preselectedFromEntityId, preselectedToEntityId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.from_entity_id || !formData.to_entity_id) {
      toast.error('Please select both entities');
      return;
    }

    if (formData.from_entity_id === formData.to_entity_id) {
      toast.error('Cannot connect an entity to itself');
      return;
    }

    setIsSubmitting(true);

    try {
      if (connection) {
        // Update existing connection
        const response = await fetch(`/api/cases/${caseId}/connections/${connection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update connection');
        }

        toast.success('Connection updated successfully');
      } else {
        // Create new connection
        const response = await fetch(`/api/cases/${caseId}/connections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create connection');
        }

        toast.success('Connection created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[Connection Form] Error:', error);
      toast.error(error.message || 'Failed to save connection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromEntity = entities.find((e) => e.id === formData.from_entity_id);
  const toEntity = entities.find((e) => e.id === formData.to_entity_id);
  const selectedConfidence = confidenceLevels.find((c) => c.value === formData.confidence);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {connection ? 'Edit Connection' : 'Add New Connection'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Entity Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From Entity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Entity *
              </label>
              <select
                value={formData.from_entity_id}
                onChange={(e) => setFormData({ ...formData, from_entity_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select entity</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.role || entity.entity_type})
                  </option>
                ))}
              </select>
            </div>

            {/* To Entity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Entity *
              </label>
              <select
                value={formData.to_entity_id}
                onChange={(e) => setFormData({ ...formData, to_entity_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select entity</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.role || entity.entity_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Preview */}
          {fromEntity && toEntity && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: fromEntity.color || '#3B82F6' }}
                  >
                    <span className="text-white text-xs font-bold">
                      {fromEntity.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-900">{fromEntity.name}</p>
                </div>

                <ArrowRight
                  className="w-8 h-8"
                  style={{ color: formData.line_color || selectedConfidence?.color }}
                  strokeDasharray={
                    formData.line_style === 'dashed'
                      ? '8 4'
                      : formData.line_style === 'dotted'
                      ? '2 4'
                      : undefined
                  }
                />

                <div className="text-center">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: toEntity.color || '#3B82F6' }}
                  >
                    <span className="text-white text-xs font-bold">
                      {toEntity.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-900">{toEntity.name}</p>
                </div>
              </div>
              {formData.label && (
                <p className="text-center text-sm text-gray-600 mt-2">"{formData.label}"</p>
              )}
            </div>
          )}

          {/* Connection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Type *
            </label>
            <select
              value={formData.connection_type}
              onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
              required
            >
              {connectionTypes.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Label (optional)
            </label>
            <input
              type="text"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 'Last seen together', 'Owner of weapon'"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add details about this connection..."
            />
          </div>

          {/* Confidence Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Level
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {confidenceLevels.map((level) => {
                const isSelected = formData.confidence === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, confidence: level.value })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{
                      backgroundColor: isSelected ? level.color : `${level.color}20`,
                      borderColor: isSelected ? level.color : '#E5E7EB',
                      color: isSelected ? '#fff' : level.color,
                    }}
                  >
                    <span className="font-medium text-sm">{level.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Styling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Line Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Line Style
              </label>
              <select
                value={formData.line_style || 'solid'}
                onChange={(e) => setFormData({ ...formData, line_style: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {lineStyles.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Line Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Line Weight: {formData.line_weight}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.line_weight || 2}
                onChange={(e) => setFormData({ ...formData, line_weight: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Evidence Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Evidence Notes
            </label>
            <textarea
              value={formData.evidence_notes || ''}
              onChange={(e) => setFormData({ ...formData, evidence_notes: e.target.value || null })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What evidence supports this connection? (witness statements, CCTV, phone records, etc.)"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.from_entity_id || !formData.to_entity_id}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connection ? 'Update Connection' : 'Create Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
