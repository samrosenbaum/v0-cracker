'use client';

import { useState, useEffect } from 'react';
import { Database } from '@/app/types/database';
import { X, Clock, MapPin, Calendar, User, Loader2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type AlibiEntry = Database['public']['Tables']['alibi_entries']['Row'];
type AlibiEntryInsert = Database['public']['Tables']['alibi_entries']['Insert'];
type CaseEntity = Database['public']['Tables']['case_entities']['Row'];

interface AlibiEntryFormModalProps {
  caseId: string;
  entities: CaseEntity[];
  alibi?: AlibiEntry | null;
  preselectedSubjectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const verificationStatuses: Array<'verified' | 'partial' | 'unverified' | 'contradicted' | 'false'> = [
  'verified',
  'partial',
  'unverified',
  'contradicted',
  'false',
];

export default function AlibiEntryFormModal({
  caseId,
  entities,
  alibi,
  preselectedSubjectId,
  isOpen,
  onClose,
  onSuccess,
}: AlibiEntryFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCorroborators, setSelectedCorroborators] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<AlibiEntryInsert>>({
    subject_entity_id: preselectedSubjectId || '',
    version_number: 1,
    statement_date: new Date().toISOString(),
    interviewer: null,
    alibi_start_time: '',
    alibi_end_time: '',
    location_claimed: '',
    activity_claimed: '',
    full_statement: null,
    corroborating_entity_ids: null,
    verification_status: 'unverified',
    verification_notes: null,
    changes_from_previous: null,
    inconsistencies: [],
    source_document_id: null,
    source_notes: null,
    metadata: {},
  });

  useEffect(() => {
    if (alibi) {
      setFormData({
        subject_entity_id: alibi.subject_entity_id,
        version_number: alibi.version_number,
        statement_date: alibi.statement_date,
        interviewer: alibi.interviewer,
        alibi_start_time: alibi.alibi_start_time,
        alibi_end_time: alibi.alibi_end_time,
        location_claimed: alibi.location_claimed,
        activity_claimed: alibi.activity_claimed,
        full_statement: alibi.full_statement,
        corroborating_entity_ids: alibi.corroborating_entity_ids,
        verification_status: alibi.verification_status || 'unverified',
        verification_notes: alibi.verification_notes,
        changes_from_previous: alibi.changes_from_previous,
        inconsistencies: alibi.inconsistencies as any,
        source_notes: alibi.source_notes,
        metadata: alibi.metadata as any,
      });
      setSelectedCorroborators(alibi.corroborating_entity_ids || []);
    } else {
      const newDate = new Date().toISOString();
      setFormData({
        subject_entity_id: preselectedSubjectId || '',
        version_number: 1,
        statement_date: newDate,
        interviewer: null,
        alibi_start_time: '',
        alibi_end_time: '',
        location_claimed: '',
        activity_claimed: '',
        full_statement: null,
        corroborating_entity_ids: null,
        verification_status: 'unverified',
        verification_notes: null,
        changes_from_previous: null,
        inconsistencies: [],
        source_notes: null,
        metadata: {},
      });
      setSelectedCorroborators([]);
    }
  }, [alibi, preselectedSubjectId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject_entity_id) {
      toast.error('Please select a subject');
      return;
    }

    if (!formData.location_claimed?.trim() || !formData.activity_claimed?.trim()) {
      toast.error('Location and activity are required');
      return;
    }

    if (!formData.alibi_start_time || !formData.alibi_end_time) {
      toast.error('Please provide time range for alibi');
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch existing alibis to determine version number
      if (!alibi) {
        const response = await fetch(
          `/api/cases/${caseId}/alibis?subject_id=${formData.subject_entity_id}`
        );
        const result = await response.json();

        if (response.ok && result.alibis) {
          const maxVersion = Math.max(0, ...result.alibis.map((a: any) => a.version_number));
          formData.version_number = maxVersion + 1;
        }
      }

      // Set corroborating entities
      formData.corroborating_entity_ids = selectedCorroborators.length > 0 ? selectedCorroborators : null;

      const response = await fetch(`/api/cases/${caseId}/alibis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save alibi');
      }

      toast.success(`Alibi version ${formData.version_number} saved successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[Alibi Form] Error:', error);
      toast.error(error.message || 'Failed to save alibi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCorroborator = (entityId: string) => {
    setSelectedCorroborators((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    );
  };

  const suspects = entities.filter((e) => e.role === 'suspect' || e.entity_type === 'person');
  const witnesses = entities.filter(
    (e) =>
      e.role === 'witness' ||
      e.role === 'family' ||
      e.role === 'friend' ||
      (e.entity_type === 'person' && e.id !== formData.subject_entity_id)
  );

  const selectedSubject = entities.find((e) => e.id === formData.subject_entity_id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {alibi ? `Edit Alibi (Version ${alibi.version_number})` : 'Add New Alibi Statement'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Subject Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Subject (Suspect) *
            </label>
            <select
              value={formData.subject_entity_id}
              onChange={(e) => setFormData({ ...formData, subject_entity_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!alibi}
            >
              <option value="">Select subject</option>
              {suspects.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.role || 'Person'})
                </option>
              ))}
            </select>
            {alibi && (
              <p className="text-xs text-gray-500 mt-1">
                Subject cannot be changed when editing
              </p>
            )}
          </div>

          {selectedSubject && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: selectedSubject.color || '#F59E0B' }}
                >
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedSubject.name}</p>
                  <p className="text-sm text-gray-600">
                    Version {formData.version_number} of alibi statement
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interview Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Statement Date *
              </label>
              <input
                type="datetime-local"
                value={
                  formData.statement_date
                    ? format(new Date(formData.statement_date), "yyyy-MM-dd'T'HH:mm")
                    : ''
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    statement_date: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString(),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interviewer
              </label>
              <input
                type="text"
                value={formData.interviewer || ''}
                onChange={(e) => setFormData({ ...formData, interviewer: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Detective Smith"
              />
            </div>
          </div>

          {/* Alibi Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Alibi Time Range *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="datetime-local"
                  value={
                    formData.alibi_start_time
                      ? format(new Date(formData.alibi_start_time), "yyyy-MM-dd'T'HH:mm")
                      : ''
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alibi_start_time: e.target.value ? new Date(e.target.value).toISOString() : '',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="datetime-local"
                  value={
                    formData.alibi_end_time
                      ? format(new Date(formData.alibi_end_time), "yyyy-MM-dd'T'HH:mm")
                      : ''
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alibi_end_time: e.target.value ? new Date(e.target.value).toISOString() : '',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Location Claimed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location Claimed *
            </label>
            <input
              type="text"
              value={formData.location_claimed}
              onChange={(e) => setFormData({ ...formData, location_claimed: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Where does the subject claim to have been?"
              required
            />
          </div>

          {/* Activity Claimed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Activity Claimed *
            </label>
            <input
              type="text"
              value={formData.activity_claimed}
              onChange={(e) => setFormData({ ...formData, activity_claimed: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What does the subject claim to have been doing?"
              required
            />
          </div>

          {/* Full Statement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Statement
            </label>
            <textarea
              value={formData.full_statement || ''}
              onChange={(e) =>
                setFormData({ ...formData, full_statement: e.target.value || null })
              }
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Record the complete alibi statement verbatim..."
            />
          </div>

          {/* Corroborating Witnesses */}
          {witnesses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corroborating Witnesses
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {witnesses.map((entity) => (
                    <label key={entity.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCorroborators.includes(entity.id)}
                        onChange={() => toggleCorroborator(entity.id)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        {entity.name} ({entity.role || 'Person'})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select people who can verify this alibi
              </p>
            </div>
          )}

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
                Verification Notes
              </label>
              <input
                type="text"
                value={formData.verification_notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, verification_notes: e.target.value || null })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="How was this verified?"
              />
            </div>
          </div>

          {/* Changes from Previous */}
          {formData.version_number && formData.version_number > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Changes from Previous Version
              </label>
              <textarea
                value={formData.changes_from_previous || ''}
                onChange={(e) =>
                  setFormData({ ...formData, changes_from_previous: e.target.value || null })
                }
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="What changed in this version compared to the previous statement?"
              />
            </div>
          )}

          {/* Source Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Notes
            </label>
            <textarea
              value={formData.source_notes || ''}
              onChange={(e) => setFormData({ ...formData, source_notes: e.target.value || null })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about the source or context of this alibi..."
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
              disabled={
                isSubmitting ||
                !formData.subject_entity_id ||
                !formData.location_claimed?.trim() ||
                !formData.activity_claimed?.trim()
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {alibi ? 'Update Alibi' : `Create Alibi (Version ${formData.version_number})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
