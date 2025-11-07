'use client';

import { useState, useEffect } from 'react';
import { Database } from '@/app/types/database';
import { X, Clock, MapPin, Calendar, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type TimelineEvent = Database['public']['Tables']['timeline_events']['Row'];
type TimelineEventInsert = Database['public']['Tables']['timeline_events']['Insert'];
type CaseEntity = Database['public']['Tables']['case_entities']['Row'];

interface TimelineEventFormModalProps {
  caseId: string;
  entities: CaseEntity[];
  event?: TimelineEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const eventTypes = [
  { value: 'victim_action', label: 'Victim Action', color: '#DC2626' },
  { value: 'suspect_movement', label: 'Suspect Movement', color: '#F59E0B' },
  { value: 'witness_account', label: 'Witness Account', color: '#3B82F6' },
  { value: 'evidence_found', label: 'Evidence Found', color: '#8B5CF6' },
  { value: 'phone_call', label: 'Phone Call', color: '#10B981' },
  { value: 'transaction', label: 'Transaction', color: '#F59E0B' },
  { value: 'sighting', label: 'Sighting', color: '#EC4899' },
  { value: 'other', label: 'Other', color: '#6B7280' },
] as const;

const timePrecisionOptions: Array<'exact' | 'approximate' | 'estimated' | 'unknown'> = [
  'exact',
  'approximate',
  'estimated',
  'unknown',
];

const verificationStatuses: Array<'verified' | 'unverified' | 'disputed' | 'false'> = [
  'verified',
  'unverified',
  'disputed',
  'false',
];

export default function TimelineEventFormModal({
  caseId,
  entities,
  event,
  isOpen,
  onClose,
  onSuccess,
}: TimelineEventFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [formData, setFormData] = useState<Partial<TimelineEventInsert>>({
    event_type: 'victim_action',
    title: '',
    description: null,
    event_time: null,
    event_date: null,
    time_precision: 'exact',
    time_range_start: null,
    time_range_end: null,
    location: null,
    location_coordinates: null,
    primary_entity_id: null,
    related_entity_ids: null,
    verification_status: 'unverified',
    verified_by: null,
    confidence_score: 50,
    source_type: null,
    source_document_id: null,
    source_notes: null,
    color: null,
    icon: null,
    metadata: {},
  });

  useEffect(() => {
    if (event) {
      setFormData({
        event_type: event.event_type,
        title: event.title,
        description: event.description,
        event_time: event.event_time,
        event_date: event.event_date,
        time_precision: event.time_precision || 'exact',
        time_range_start: event.time_range_start,
        time_range_end: event.time_range_end,
        location: event.location,
        primary_entity_id: event.primary_entity_id,
        related_entity_ids: event.related_entity_ids,
        verification_status: event.verification_status || 'unverified',
        verified_by: event.verified_by,
        confidence_score: event.confidence_score || 50,
        source_type: event.source_type,
        source_notes: event.source_notes,
        color: event.color,
        metadata: event.metadata as any,
      });
      setUseTimeRange(!!(event.time_range_start && event.time_range_end));
    } else {
      setFormData({
        event_type: 'victim_action',
        title: '',
        description: null,
        event_time: null,
        event_date: null,
        time_precision: 'exact',
        time_range_start: null,
        time_range_end: null,
        location: null,
        primary_entity_id: null,
        related_entity_ids: null,
        verification_status: 'unverified',
        verified_by: null,
        confidence_score: 50,
        source_type: null,
        source_notes: null,
        color: null,
        metadata: {},
      });
      setUseTimeRange(false);
    }
  }, [event, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save event');
      }

      toast.success('Timeline event saved successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[Timeline Event Form] Error:', error);
      toast.error(error.message || 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = eventTypes.find((t) => t.value === formData.event_type);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {event ? 'Edit Timeline Event' : 'Add Timeline Event'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Type *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eventTypes.map((type) => {
                const isSelected = formData.event_type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, event_type: type.value, color: type.color })
                    }
                    className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      isSelected ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{
                      backgroundColor: isSelected ? type.color : `${type.color}20`,
                      borderColor: isSelected ? type.color : '#E5E7EB',
                      color: isSelected ? '#fff' : type.color,
                      ringColor: type.color,
                    }}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the event"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed description of what happened..."
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!useTimeRange}
                  onChange={() => setUseTimeRange(false)}
                  className="text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Specific Time</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={useTimeRange}
                  onChange={() => setUseTimeRange(true)}
                  className="text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Time Range</span>
              </label>
            </div>

            {!useTimeRange ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.event_date || ''}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Time
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      formData.event_time
                        ? format(new Date(formData.event_time), "yyyy-MM-dd'T'HH:mm")
                        : ''
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event_time: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="datetime-local"
                    value={
                      formData.time_range_start
                        ? format(new Date(formData.time_range_start), "yyyy-MM-dd'T'HH:mm")
                        : ''
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        time_range_start: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="datetime-local"
                    value={
                      formData.time_range_end
                        ? format(new Date(formData.time_range_end), "yyyy-MM-dd'T'HH:mm")
                        : ''
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        time_range_end: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Time Precision */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Precision</label>
              <select
                value={formData.time_precision || 'exact'}
                onChange={(e) =>
                  setFormData({ ...formData, time_precision: e.target.value as any })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {timePrecisionOptions.map((precision) => (
                  <option key={precision} value={precision} className="capitalize">
                    {precision}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Where did this event occur?"
            />
          </div>

          {/* Primary Entity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Entity</label>
            <select
              value={formData.primary_entity_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, primary_entity_id: e.target.value || null })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.role || entity.entity_type})
                </option>
              ))}
            </select>
          </div>

          {/* Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Status
              </label>
              <select
                value={formData.verification_status || 'unverified'}
                onChange={(e) =>
                  setFormData({ ...formData, verification_status: e.target.value as any })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {verificationStatuses.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Score: {formData.confidence_score}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.confidence_score || 50}
                onChange={(e) =>
                  setFormData({ ...formData, confidence_score: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>

          {/* Verified By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Verified By</label>
            <input
              type="text"
              value={formData.verified_by || ''}
              onChange={(e) => setFormData({ ...formData, verified_by: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., CCTV footage, witness statement, phone records"
            />
          </div>

          {/* Source Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Notes</label>
            <textarea
              value={formData.source_notes || ''}
              onChange={(e) => setFormData({ ...formData, source_notes: e.target.value || null })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about the source of this information..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title?.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {event ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
