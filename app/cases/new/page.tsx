'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Save } from 'lucide-react';

// Development fallback IDs - allows case creation without authentication
// Can be overridden with environment variables if needed
const FALLBACK_DEV_USER_ID = process.env.NEXT_PUBLIC_SUPABASE_DEV_USER_ID || '00000000-0000-0000-0000-000000000001';
const FALLBACK_DEV_AGENCY_ID =
  process.env.NEXT_PUBLIC_SUPABASE_DEV_AGENCY_ID || '00000000-0000-0000-0000-000000000002';

export default function NewCasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    status: 'active',
    priority: 'medium',
  });

  // Check authentication on page load (non-blocking for development)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      // Just log auth status for debugging, don't redirect
      if (!user) {
        console.log('No active user session - will use fallback user ID for development');
      } else {
        console.log('Active user session:', user.email);
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

      // Use authenticated user ID or fallback to development UUID
      const userId = user?.id ?? FALLBACK_DEV_USER_ID;

      console.log('Creating case with user ID:', userId, user ? '(authenticated)' : '(fallback)');

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

      // Insert case
      const { data: newCase, error } = await supabase
        .from('cases')
        .insert({
          ...formData,
          user_id: userId,
          agency_id: agency_id,
        })
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
                placeholder="Brief description of the case..."
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
