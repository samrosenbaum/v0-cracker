'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { FileText, Calendar, Plus } from 'lucide-react';

interface Case {
  id: string;
  name: string;
  title: string;
  description: string | null;
  incident_date?: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: { [key: string]: string } = {
    active: "bg-green-100 text-green-800 border-green-200",
    cold: "bg-blue-100 text-blue-800 border-blue-200",
    reviewing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    closed: "bg-gray-100 text-gray-800 border-gray-200"
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.active}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors: { [key: string]: string } = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-orange-100 text-orange-800 border-orange-200",
    low: "bg-gray-100 text-gray-800 border-gray-200"
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[priority] || colors.medium}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};

function CasesContent({ initialFilter }: { initialFilter: string | null }) {
  const router = useRouter();

  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter || 'all');

  useEffect(() => {
    fetchCases();
  }, [filter]);

  const fetchCases = async () => {
    setIsLoading(true);

    let query = supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setCases(data);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-end h-16">
            <button
              onClick={() => router.push('/cases/new')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Case</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Cases</h1>
          <p className="text-gray-600">View and manage all your cases</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Cases
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('cold')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'cold'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Cold
          </button>
          <button
            onClick={() => setFilter('reviewing')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'reviewing'
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Reviewing
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'closed'
                ? 'bg-gray-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Closed
          </button>
        </div>

        {/* Cases List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              Loading cases...
            </div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {filter === 'all' ? 'No cases yet' : `No ${filter} cases`}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Create your first case to get started
              </p>
              <button
                onClick={() => router.push('/cases/new')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Case</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {cases.map(case_ => (
                <button
                  key={case_.id}
                  onClick={() => router.push(`/cases/${case_.id}`)}
                  className="w-full text-left p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {case_.title || case_.name}
                        </h4>
                        <StatusBadge status={case_.status} />
                        <PriorityBadge priority={case_.priority} />
                      </div>
                      {case_.description && (
                        <p className="text-gray-600 mb-3">{case_.description}</p>
                      )}
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {case_.incident_date
                              ? formatDate(case_.incident_date)
                              : 'No date'
                            }
                          </span>
                        </span>
                        <span>Created {formatDate(case_.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component that reads search params (must be wrapped in Suspense)
function SearchParamsReader() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  return <CasesContent initialFilter={statusFilter} />;
}

// Default export with Suspense boundary
export default function AllCasesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading cases...</div>
      </div>
    }>
      <SearchParamsReader />
    </Suspense>
  );
}
