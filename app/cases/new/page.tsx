'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Save } from 'lucide-react';

const FALLBACK_DEV_USER_ID = process.env.NEXT_PUBLIC_SUPABASE_DEV_USER_ID;
const FALLBACK_DEV_AGENCY_ID =
  process.env.NEXT_PUBLIC_SUPABASE_DEV_AGENCY_ID || '00000000-0000-0000-0000-000000000000';

export default function NewCasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    case_number: '',
    victim_name: '',
    incident_date: '',
    location: '',
    status: 'cold',
    priority: 'medium',
  });

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      // If no user session and no fallback configured, redirect to login
      if (!user && !FALLBACK_DEV_USER_ID &&
          (userError?.message === 'Auth session missing!' ||
           userError?.name === 'AuthSessionMissingError')) {
        console.error('No active user session - redirecting to login');
        router.push('/login?redirect=/cases/new');
        return;
      }

      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Attempt to read the current user, but allow creation to proceed without an active session.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // Only throw error if it's not a missing session error
      // Missing sessions are expected and handled by fallback logic
      if (userError &&
          userError.message !== 'Auth session missing!' &&
          userError.name !== 'AuthSessionMissingError') {
        throw userError;
      }

      const userId = user?.id ?? FALLBACK_DEV_USER_ID;

      if (!userId) {
        // No authenticated user and no fallback configured - redirect to login
        console.error('No active user session and no fallback user ID configured');
        router.push('/login?redirect=/cases/new');
        return;
      }

      let agency_id = FALLBACK_DEV_AGENCY_ID;

      if (user) {
        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from('agency_members')
          .select('agency_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (membership?.agency_id) {
          agency_id = membership.agency_id;
        }
      }

      if (!agency_id) {
        alert(
          'No agency could be determined for this case. Please set NEXT_PUBLIC_SUPABASE_DEV_AGENCY_ID or add the user to an agency.'
        );
        return;
      }

      // Insert case with proper handling for optional fields
      const caseData: Record<string, any> = {
        name: formData.name,
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        user_id: userId,
        agency_id: agency_id,
      };

      // Only include optional fields if they have values
      if (formData.case_number) caseData.case_number = formData.case_number;
      if (formData.victim_name) caseData.victim_name = formData.victim_name;
      if (formData.incident_date) caseData.incident_date = formData.incident_date;
      if (formData.location) caseData.location = formData.location;

      const { data: newCase, error } = await supabase
        .from('cases')
        .insert(caseData)
        .select()
        .single();

      if (error) {
        console.error('Error creating case:', error);
        alert(`Failed to create case: ${error.message}`);
        return;
      }

      // Redirect to the case files page
      router.push(`/cases/${newCase.id}/files`);
    } catch (error: any) {
      console.error('Error:', error);
      alert('An error occurred while creating the case');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Case</h1>
          <p className="text-gray-600 mt-2">
            Fill in the case details to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-8">
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Case Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Miller Street Investigation"
              />
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Case Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Robbery Investigation - 123 Main St"
              />
            </div>

            {/* Case Number */}
            <div>
              <label htmlFor="case_number" className="block text-sm font-medium text-gray-700 mb-2">
                Case Number
              </label>
              <input
                type="text"
                id="case_number"
                name="case_number"
                value={formData.case_number}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2019-CC-1234"
              />
            </div>

            {/* Victim Name */}
            <div>
              <label htmlFor="victim_name" className="block text-sm font-medium text-gray-700 mb-2">
                Victim Name
              </label>
              <input
                type="text"
                id="victim_name"
                name="victim_name"
                value={formData.victim_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Jane Doe"
              />
            </div>

            {/* Incident Date */}
            <div>
              <label htmlFor="incident_date" className="block text-sm font-medium text-gray-700 mb-2">
                Incident Date
              </label>
              <input
                type="date"
                id="incident_date"
                name="incident_date"
                value={formData.incident_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 123 Main St, Springfield, IL"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of the case, including key facts and circumstances..."
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="cold">Cold</option>
                <option value="closed">Closed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <select
                id="priority"
                name="priority"
                required
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 mt-8 pt-6 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Create Case'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
