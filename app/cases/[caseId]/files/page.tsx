'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import CaseFileUpload from '@/components/CaseFileUpload';
import { FileText, Download, Trash2, Eye, Calendar, User, Tag, PlayCircle } from 'lucide-react';

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

export default function CaseFilesPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [caseInfo, setCaseInfo] = useState<any>(null);

  useEffect(() => {
    fetchCaseInfo();
    fetchDocuments();
  }, [caseId]);

  const fetchCaseInfo = async () => {
    const { data } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    setCaseInfo(data);
  };

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('case_documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setIsLoading(false);
  };

  const handleUploadComplete = () => {
    fetchDocuments();
    setShowUpload(false);
  };

  const downloadFile = async (doc: CaseDocument) => {
    const { data } = supabase.storage
      .from('case-files')
      .getPublicUrl(doc.storage_path);

    window.open(data.publicUrl, '_blank');
  };

  const deleteFile = async (doc: CaseDocument) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;

    // Delete from storage
    await supabase.storage
      .from('case-files')
      .remove([doc.storage_path]);

    // Delete from database
    await supabase
      .from('case_documents')
      .delete()
      .eq('id', doc.id);

    fetchDocuments();
  };

  const runAnalysis = async (analysisType: 'timeline' | 'deep-analysis' | 'victim-timeline') => {
    const endpoint = `/api/cases/${caseId}/${analysisType}`;

    try {
      const body = analysisType === 'victim-timeline'
        ? {
            victimName: caseInfo?.victim_name || 'Unknown',
            incidentTime: caseInfo?.incident_date || new Date().toISOString(),
          }
        : {};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Analysis failed: ${result.error}`);
        return;
      }

      // Handle job-based responses (async analysis)
      if (result.jobId) {
        const analysisTypeNames = {
          'timeline': 'Timeline analysis',
          'deep-analysis': 'Deep analysis',
          'victim-timeline': 'Victim timeline reconstruction',
        };

        alert(
          [
            `${analysisTypeNames[analysisType] || analysisType} has been scheduled.`,
            'You can monitor progress from the Processing Jobs panel.',
          ].join(' ')
        );
      } else {
        // Legacy synchronous responses (shouldn't happen anymore)
        alert(`${analysisType} analysis completed successfully!`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. Check console for details.');
    }
  };

  const formatFileSize = (doc: CaseDocument): string => {
    const bytes = doc.metadata?.file_size;
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocumentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      police_report: 'Police Report',
      witness_statement: 'Witness Statement',
      forensic_report: 'Forensic Report',
      autopsy_report: 'Autopsy Report',
      phone_records: 'Phone Records',
      financial_records: 'Financial Records',
      surveillance_footage: 'Surveillance Footage',
      photo_evidence: 'Photo Evidence',
      interview_transcript: 'Interview Transcript',
      lab_results: 'Lab Results',
      other: 'Other Document',
    };
    return labels[type] || type;
  };

  const getDocumentTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      police_report: 'bg-blue-100 text-blue-800',
      witness_statement: 'bg-purple-100 text-purple-800',
      forensic_report: 'bg-green-100 text-green-800',
      autopsy_report: 'bg-red-100 text-red-800',
      phone_records: 'bg-yellow-100 text-yellow-800',
      financial_records: 'bg-orange-100 text-orange-800',
      surveillance_footage: 'bg-pink-100 text-pink-800',
      photo_evidence: 'bg-indigo-100 text-indigo-800',
      interview_transcript: 'bg-teal-100 text-teal-800',
      lab_results: 'bg-cyan-100 text-cyan-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Case Files</h1>
              {caseInfo && (
                <p className="text-gray-600 mt-1">
                  {caseInfo.title || caseInfo.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showUpload ? 'Hide Upload' : 'Upload Files'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-900">
                {(() => {
                  const total = documents.reduce((sum, doc) => sum + (doc.metadata?.file_size || 0), 0);
                  if (total === 0) return 'N/A';
                  if (total < 1024) return total + ' bytes';
                  if (total < 1024 * 1024) return (total / 1024).toFixed(1) + ' KB';
                  return (total / (1024 * 1024)).toFixed(1) + ' MB';
                })()}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Witness Statements</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.document_type === 'witness_statement').length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Evidence Photos</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.document_type === 'photo_evidence').length}
              </p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Case Files</h2>
            <CaseFileUpload caseId={caseId} onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* Analysis Actions */}
        {documents.length > 0 && (
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Run Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => runAnalysis('timeline')}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <PlayCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-900">Timeline Analysis</p>
                  <p className="text-sm text-gray-600">Detect conflicts & inconsistencies</p>
                </div>
              </button>

              <button
                onClick={() => runAnalysis('deep-analysis')}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
              >
                <PlayCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">Deep Analysis</p>
                  <p className="text-sm text-gray-600">8-dimensional cold case review</p>
                </div>
              </button>

              <button
                onClick={() => runAnalysis('victim-timeline')}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              >
                <PlayCircle className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-900">Victim Timeline</p>
                  <p className="text-sm text-gray-600">Last 24-48 hours reconstruction</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No documents uploaded yet</p>
              <p className="text-sm text-gray-500">
                Click "Upload Files" to add case documents
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {documents.map(doc => (
                <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <FileText className="w-8 h-8 text-gray-400 flex-shrink-0 mt-1" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 truncate flex-1">
                            {doc.file_name}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getDocumentTypeColor(doc.document_type)}`}>
                            {getDocumentTypeLabel(doc.document_type)}
                          </span>
                        </div>

                        {doc.metadata?.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {doc.metadata.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(doc.created_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {formatFileSize(doc)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => downloadFile(doc)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteFile(doc)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
