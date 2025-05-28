'use client'

import React, { useState, useRef } from 'react';
import { Upload, Search, Eye, FileText, Users, Calendar, AlertTriangle, Brain, Plus, Filter, Download, Share2, Clock, Target, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const ColdCaseCracker = () => {
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock data
  const cases = [
    {
      id: 1,
      title: "Miller Street Robbery",
      date: "2019-03-15",
      status: "active",
      priority: "high",
      filesCount: 12,
      lastActivity: "2 days ago",
      aiStatus: "analyzing",
      description: "Armed robbery at convenience store, suspect fled on foot"
    },
    {
      id: 2,
      title: "Riverside Park Incident",
      date: "2020-07-22",
      status: "cold",
      priority: "medium",
      filesCount: 8,
      lastActivity: "1 week ago",
      aiStatus: "complete",
      description: "Vandalism and theft at park facilities"
    },
    {
      id: 3,
      title: "Downtown Break-in",
      date: "2018-11-03",
      status: "reviewing",
      priority: "low",
      filesCount: 15,
      lastActivity: "3 days ago",
      aiStatus: "pending",
      description: "Commercial break-in with multiple entry points"
    }
  ];

  const handleFileUpload = async (files: FileList) => {
    if (!selectedCase) {
      alert("Please select a case first");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setIsAnalyzing(true);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('caseId', `CASE-${selectedCase.id}-${Date.now()}`);

    try {
      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(uploadInterval);
      setUploadProgress(100);

      const result = await response.json();
      console.log('Analysis result:', result);
      
      if (result.success) {
        setAnalysisResults(result.analysis);
      } else {
        console.error('Analysis failed:', result.error);
        setAnalysisResults({
          error: result.error,
          suspects: [],
          findings: [],
          connections: [],
          recommendations: []
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: { [key: string]: string } = {
      active: "bg-green-100 text-green-800 border-green-200",
      cold: "bg-blue-100 text-blue-800 border-blue-200",
      reviewing: "bg-yellow-100 text-yellow-800 border-yellow-200",
      closed: "bg-gray-100 text-gray-800 border-gray-200"
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors: { [key: string]: string } = {
      high: "bg-red-100 text-red-800 border-red-200",
      medium: "bg-orange-100 text-orange-800 border-orange-200",
      low: "bg-gray-100 text-gray-800 border-gray-200",
      CRITICAL: "bg-red-100 text-red-800 border-red-200",
      HIGH: "bg-orange-100 text-orange-800 border-orange-200",
      MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
      LOW: "bg-gray-100 text-gray-800 border-gray-200"
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const ConfidenceBar = ({ confidence }: { confidence: number }) => {
    const getColor = (conf: number) => {
      if (conf >= 80) return "bg-green-500";
      if (conf >= 60) return "bg-yellow-500";
      return "bg-red-500";
    };

    return (
      <div className="flex items-center space-x-2">
        <div className="w-20 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getColor(confidence)}`}
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
        <span className="text-sm text-gray-600">{confidence}%</span>
      </div>
    );
  };

  const SuspectCard = ({ suspect }: { suspect: any }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{suspect.name}</h3>
            <PriorityBadge priority={suspect.urgencyLevel} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">Confidence</div>
          <ConfidenceBar confidence={suspect.confidence} />
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Connections:</h4>
          <div className="flex flex-wrap gap-1">
            {suspect.connections?.map((conn: string, idx: number) => (
              <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                {conn}
              </span>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Analysis:</h4>
          <p className="text-sm text-gray-600">{suspect.notes}</p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Recommended Actions:</h4>
          <ul className="space-y-1">
            {suspect.recommendedActions?.map((action: string, idx: number) => (
              <li key={idx} className="flex items-center space-x-2 text-sm text-gray-600">
                <Target className="w-3 h-3 text-blue-500" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const FindingCard = ({ finding }: { finding: any }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            finding.priority === 'CRITICAL' ? 'bg-red-100' : 
            finding.priority === 'HIGH' ? 'bg-orange-100' : 'bg-yellow-100'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${
              finding.priority === 'CRITICAL' ? 'text-red-600' : 
              finding.priority === 'HIGH' ? 'text-orange-600' : 'text-yellow-600'
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{finding.title}</h3>
            <PriorityBadge priority={finding.priority} />
          </div>
        </div>
        <ConfidenceBar confidence={finding.confidence} />
      </div>
      
      <p className="text-gray-600 mb-3">{finding.description}</p>
      
      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium text-gray-700">Evidence:</h4>
          <div className="flex flex-wrap gap-1">
            {finding.supportingEvidence?.map((evidence: string, idx: number) => (
              <span key={idx} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                {evidence}
              </span>
            ))}
          </div>
        </div>
        
        <div className="bg-blue-50 p-3 rounded">
          <h4 className="text-sm font-medium text-blue-900 mb-1">
            <Target className="w-4 h-4 inline mr-1" />
            Action Required:
          </h4>
          <p className="text-sm text-blue-800">{finding.investigativeAction}</p>
        </div>
      </div>
    </div>
  );

  const RecommendationCard = ({ rec }: { rec: any }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <PriorityBadge priority={rec.priority} />
        <span className="text-xs text-gray-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {rec.timeline}
        </span>
      </div>
      <h3 className="font-medium text-gray-900 mb-2">{rec.action}</h3>
      <p className="text-sm text-gray-600">{rec.rationale}</p>
    </div>
  );

  if (selectedCase && analysisResults) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                <h1 className="text-xl font-bold text-gray-900">Cold Case Cracker</h1>
              </div>
              <button 
                onClick={() => {setSelectedCase(null); setAnalysisResults(null);}}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Cases
              </button>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Investigation Analysis: {selectedCase.title}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Brain className="w-4 h-4 mr-1 text-blue-500" />
                AI Analysis Complete
              </span>
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Suspects Section */}
          {analysisResults.suspects && analysisResults.suspects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-red-600" />
                Persons of Interest ({analysisResults.suspects.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysisResults.suspects.map((suspect: any, idx: number) => (
                  <SuspectCard key={idx} suspect={suspect} />
                ))}
              </div>
            </div>
          )}

          {/* Key Findings */}
          {analysisResults.findings && analysisResults.findings.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Key Findings ({analysisResults.findings.length})
              </h2>
              <div className="space-y-4">
                {analysisResults.findings.map((finding: any, idx: number) => (
                  <FindingCard key={idx} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysisResults.recommendations && analysisResults.recommendations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-600" />
                Recommended Actions ({analysisResults.recommendations.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysisResults.recommendations.map((rec: any, idx: number) => (
                  <RecommendationCard key={idx} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Connections */}
          {analysisResults.connections && analysisResults.connections.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <ExternalLink className="w-5 h-5 mr-2 text-purple-600" />
                Evidence Connections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisResults.connections.map((conn: any, idx: number) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                        {conn.type}
                      </span>
                      <ConfidenceBar confidence={conn.confidence} />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{conn.description}</p>
                    <p className="text-xs text-gray-500">{conn.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {analysisResults.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-2">
                <XCircle className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="text-lg font-medium text-red-900">Analysis Error</h3>
              </div>
              <p className="text-red-700">{analysisResults.error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedCase) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                <h1 className="text-xl font-bold text-gray-900">Cold Case Cracker</h1>
              </div>
              <button 
                onClick={() => setSelectedCase(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Case Details */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Case Header */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedCase.title}</h1>
                  <p className="text-gray-600">{selectedCase.description}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <StatusBadge status={selectedCase.status} />
                  <PriorityBadge priority={selectedCase.priority} />
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Case Files for AI Analysis
              </h3>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
                
                {isUploading || isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                      <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-gray-900">
                        {isAnalyzing ? "AI Analyzing Case Files..." : "Uploading Files..."}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500">
                        {isAnalyzing ? "Extracting text and analyzing evidence..." : `${uploadProgress}% complete`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">Drop case files here or click to upload</p>
                      <p className="text-gray-500">Supports PDF, DOCX, and TXT files</p>
                      <p className="text-sm text-blue-600 mt-2">⚡ AI will automatically analyze for suspects and evidence</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Select Case Files
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
              <h1 className="text-xl font-bold text-gray-900">Cold Case Cracker</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search cases..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cases</p>
                  <p className="text-3xl font-bold text-gray-900">{cases.length}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Cases</p>
                  <p className="text-3xl font-bold text-gray-900">{cases.filter(c => c.status === 'active').length}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Analyses</p>
                  <p className="text-3xl font-bold text-gray-900">24</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Brain className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Evidence Files</p>
                  <p className="text-3xl font-bold text-gray-900">156</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <Upload className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Cases */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Cases</h3>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  <span>New Case</span>
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {cases.map(case_ => (
                <div 
                  key={case_.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" 
                  onClick={() => setSelectedCase(case_)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{case_.title}</h4>
                        <StatusBadge status={case_.status} />
                        <PriorityBadge priority={case_.priority} />
                      </div>
                      <p className="text-gray-600 mb-3">{case_.description}</p>
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{case_.date}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FileText className="w-4 h-4" />
                          <span>{case_.filesCount} files</span>
                        </span>
                        <span>Last activity: {case_.lastActivity}</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-50">
                        <Brain className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-500">
                          Ready for AI Analysis
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColdCaseCracker;