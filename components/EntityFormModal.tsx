'use client';

import { useState, useEffect } from 'react';
import { Database } from '@/app/types/database';
import { X, User, MapPin, Package, Car, Building2, Circle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type CaseEntity = Database['public']['Tables']['case_entities']['Row'];
type EntityInsert = Database['public']['Tables']['case_entities']['Insert'];

interface EntityFormModalProps {
  caseId: string;
  entity?: CaseEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const entityTypeOptions = [
  { value: 'person', label: 'Person', icon: User, color: '#3B82F6' },
  { value: 'location', label: 'Location', icon: MapPin, color: '#10B981' },
  { value: 'evidence', label: 'Evidence', icon: Package, color: '#8B5CF6' },
  { value: 'vehicle', label: 'Vehicle', icon: Car, color: '#F59E0B' },
  { value: 'organization', label: 'Organization', icon: Building2, color: '#EC4899' },
  { value: 'other', label: 'Other', icon: Circle, color: '#6B7280' },
] as const;

const roleOptions = {
  person: ['victim', 'suspect', 'witness', 'investigator', 'family', 'friend', 'other'],
  location: ['crime_scene', 'alibi_location', 'residence', 'business', 'public_place', 'other'],
  evidence: ['physical', 'digital', 'testimonial', 'forensic', 'other'],
  vehicle: ['suspect_vehicle', 'victim_vehicle', 'witness_vehicle', 'evidence', 'other'],
  organization: ['employer', 'law_enforcement', 'medical', 'other'],
  other: ['other'],
};

const colorPresets = [
  '#DC2626', // red
  '#F59E0B', // orange
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
];

export default function EntityFormModal({
  caseId,
  entity,
  isOpen,
  onClose,
  onSuccess,
}: EntityFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<EntityInsert>>({
    entity_type: 'person',
    name: '',
    role: null,
    description: null,
    color: '#3B82F6',
    icon: null,
    metadata: {},
  });

  // Reset form when modal opens with entity data
  useEffect(() => {
    if (entity) {
      setFormData({
        entity_type: entity.entity_type,
        name: entity.name,
        role: entity.role,
        description: entity.description,
        color: entity.color || '#3B82F6',
        icon: entity.icon,
        metadata: entity.metadata as any,
      });
    } else {
      setFormData({
        entity_type: 'person',
        name: '',
        role: null,
        description: null,
        color: '#3B82F6',
        icon: null,
        metadata: {},
      });
    }
  }, [entity, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (entity) {
        // Update existing entity
        const response = await fetch(`/api/cases/${caseId}/entities/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update entity');
        }

        toast.success('Entity updated successfully');
      } else {
        // Create new entity
        const response = await fetch(`/api/cases/${caseId}/entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create entity');
        }

        toast.success('Entity created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[Entity Form] Error:', error);
      toast.error(error.message || 'Failed to save entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = entityTypeOptions.find((opt) => opt.value === formData.entity_type);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {entity ? 'Edit Entity' : 'Add New Entity'}
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
          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entity Type *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {entityTypeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = formData.entity_type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        entity_type: option.value,
                        color: option.color,
                        role: null,
                      });
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isSelected ? option.color : '#6B7280' }}
                    />
                    <span className="font-medium text-gray-900">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`Enter ${selectedType?.label.toLowerCase()} name`}
              required
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
            >
              <option value="">Select role (optional)</option>
              {roleOptions[formData.entity_type as keyof typeof roleOptions]?.map((role) => (
                <option key={role} value={role} className="capitalize">
                  {role.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add details about this entity..."
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color for Visualization
            </label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-600 font-mono">{formData.color}</span>
            </div>
          </div>

          {/* Preview */}
          {selectedType && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: formData.color || '#3B82F6' }}
                >
                  {React.createElement(selectedType.icon, {
                    className: 'w-6 h-6 text-white',
                  })}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{formData.name || 'Entity Name'}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {formData.role || selectedType.label}
                  </p>
                </div>
              </div>
            </div>
          )}

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
              disabled={isSubmitting || !formData.name?.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {entity ? 'Update Entity' : 'Create Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
