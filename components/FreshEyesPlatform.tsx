'use client'

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, Search, Eye, FileText, Users, Calendar, AlertTriangle, Brain, Plus, Filter, Download, Share2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

interface Case {
  id: string;
  name: string;
  title: string;
  description: string | null;
  incident_date?: string | null;
  lastUpdated?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  agency_id?: string;
  user_id?: string;
  assignedTo?: string;
  ai_prompt?: string;
}

interface CaseDocument {
  id: string;
  case_id: string;
  file_name: string;
  document_type: string;
  storage_path: string;
  metadata?: {
    description?: string | null;
    file_size?: number;
    mime_type?: string | null;
    public_url?: string;
  };
  created_at: string;
  updated_at: string;
  user_id: string;
}

const FreshEyesPlatform = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    totalDocuments: 0,
    totalAnalyses: 0
  });

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    // Auth check disabled for testing
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) {
    //   console.warn('No active session, redirecting to login...');
    //   router.push('/login');
    //   return;
    // }
    fetchCases();
    fetchStats();
  };

  useEffect(() => {
    if (selectedCase) {
      fetchCaseDocuments(selectedCase.id);
    }
  }, [selectedCase]);

  const fetchCases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setCases(data);
    }
    setIsLoading(false);
  };

  const fetchStats = async () => {
    // Total cases
    const { count: totalCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true });

    // Active cases
    const { count: activeCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Total documents
    const { count: totalDocuments } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true });

    // Total analyses
    const { count: totalAnalyses } = await supabase
      .from('case_analysis')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalCases: totalCases || 0,
      activeCases: activeCases || 0,
      totalDocuments: totalDocuments || 0,
      totalAnalyses: totalAnalyses || 0
    });
  };

  const fetchCaseDocuments = async (caseId: string) => {
    const { data, error } = await supabase
      .from('case_documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCaseDocuments(data);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const StatusBadge = ({ status, size = "sm" }: { status: string, size?: string }) => {
    const colors: { [key: string]: string } = {
      active: "bg-green-100 text-green-800 border-green-200",
      cold: "bg-blue-100 text-blue-800 border-blue-200",
      reviewing: "bg-yellow-100 text-yellow-800 border-yellow-200",
      closed: "bg-gray-100 text-gray-800 border-gray-200"
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.active} ${size === 'lg' ? 'px-3 py-1.5 text-sm' : ''}`}>
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

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <a
          href="/cases"
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cases</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalCases}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </a>

        <a
          href="/cases?status=active"
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Cases</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeCases}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </a>

        <a
          href="/analyses"
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Analyses</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAnalyses}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </a>

        <a
          href="/evidence"
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Evidence Files</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalDocuments}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Upload className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </a>
      </div>

      {/* Recent Cases */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Cases</h3>
            <a
              href="/cases/new"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Case</span>
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No cases yet</p>
            <p className="text-sm text-gray-500">Create your first case to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {cases.map(case_ => (
              <a
                href={`/cases/${case_.id}`}
                key={case_.id}
                className="block p-6 hover:bg-gray-50 transition-colors cursor-pointer"
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
                            ? new Date(case_.incident_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            : 'No date'
                          }
                        </span>
                      </span>
                      <span>Created {formatDate(case_.created_at)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCaseDetails = () => {
    if (!selectedCase) return null;

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedCase(null)}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Dashboard
        </button>

        {/* Case Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedCase.title || selectedCase.name}
              </h1>
              {selectedCase.description && (
                <p className="text-gray-600">{selectedCase.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <StatusBadge status={selectedCase.status} size="lg" />
              <PriorityBadge priority={selectedCase.priority} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Case Name</p>
              <p className="text-lg text-gray-900">{selectedCase.name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Incident Date</p>
              <p className="text-lg text-gray-900">
                {selectedCase.incident_date
                  ? new Date(selectedCase.incident_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Not specified'
                }
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Documents</p>
              <p className="text-lg text-gray-900">{caseDocuments.length} files</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Created {formatDate(selectedCase.created_at)}
            </div>
            <a
              href={`/cases/${selectedCase.id}/files`}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Manage Case Files</span>
            </a>
          </div>
        </div>

        {/* Files List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Evidence Files ({caseDocuments.length})</h3>
              <a
                href={`/cases/${selectedCase.id}/files`}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All →
              </a>
            </div>
          </div>

          {caseDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No documents uploaded yet</p>
              <a
                href={`/cases/${selectedCase.id}/files`}
                className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Files
              </a>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {caseDocuments.slice(0, 5).map(doc => (
                <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{doc.file_name}</h4>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={`/cases/${selectedCase.id}/files`}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              {caseDocuments.length > 5 && (
                <div className="p-4 text-center">
                  <a
                    href={`/cases/${selectedCase.id}/files`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View all {caseDocuments.length} files →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Image
                  src="/fresh-eyes-logo.png"
                  alt="FreshEyes Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <h1 className="text-xl font-bold text-gray-900">FreshEyes</h1>
              </div>

              <nav className="hidden md:flex space-x-8">
                <button
                  onClick={() => {setActiveTab('dashboard'); setSelectedCase(null);}}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'dashboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Dashboard
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search cases..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedCase ? renderCaseDetails() : renderDashboard()}
      </div>
    </div>
  );
};

export default FreshEyesPlatform;
