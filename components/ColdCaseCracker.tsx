'use client'

import React, { useState, useRef } from 'react';
import { Upload, Search, Eye, FileText, Users, Calendar, AlertTriangle, Brain, Plus, Filter, Download, Share2, Lock, Unlock } from 'lucide-react';

const ColdCaseCracker = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock data - replace with Supabase queries
  const [cases, setCases] = useState([
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
  ]);

  const [caseFiles, setCaseFiles] = useState([
    { id: 1, name: "security_footage_001.mp4", type: "video", size: "45.2 MB", uploaded: "2024-05-20", aiAnalyzed: true },
    { id: 2, name: "witness_statement_a.pdf", type: "document", size: "2.1 MB", uploaded: "2024-05-19", aiAnalyzed: true },
    { id: 3, name: "crime_scene_photo_1.jpg", type: "image", size: "8.7 MB", uploaded: "2024-05-18", aiAnalyzed: false },
    { id: 4, name: "forensic_report.docx", type: "document", size: "1.8 MB", uploaded: "2024-05-17", aiAnalyzed: true }
  ]);

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Here you would integrate with Supabase storage
    // const { data, error } = await supabase.storage
    //   .from('case-files')
    //   .upload(`case-${selectedCase.id}/${file.name}`, file)
  };

  const StatusBadge = ({ status, size = "sm" }: { status: string, size?: string }) => {
    const colors: { [key: string]: string } = {
      active: "bg-green-100 text-green-800 border-green-200",
      cold: "bg-blue-100 text-blue-800 border-blue-200",
      reviewing: "bg-yellow-100 text-yellow-800 border-yellow-200",
      closed: "bg-gray-100 text-gray-800 border-gray-200"
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[status]} ${size === 'lg' ? 'px-3 py-1.5 text-sm' : ''}`}>
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
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const AIStatusIndicator = ({ status }: { status: string }) => {
    const indicators: { [key: string]: { color: string, bg: string, icon: any, text: string } } = {
      analyzing: { color: "text-blue-500", bg: "bg-blue-50", icon: Brain, text: "AI Analyzing..." },
      complete: { color: "text-green-500", bg: "bg-green-50", icon: Brain, text: "AI Analysis Complete" },
      pending: { color: "text-yellow-500", bg: "bg-yellow-50", icon: Brain, text: "AI Analysis Pending" }
    };
    
    const indicator = indicators[status];
    const Icon = indicator.icon;
    
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${indicator.bg}`}>
        <Icon className={`w-4 h-4 ${indicator.color}`} />
        <span className={`text-sm font-medium ${indicator.color}`}>{indicator.text}</span>
      </div>
    );
  };

  const renderDashboard = () => (
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
            <div key={case_.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedCase(case_)}>
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
                  <AIStatusIndicator status={case_.aiStatus} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCaseDetails = () => {
    if (!selectedCase) return null;
    
    return (
      <div className="space-y-6">
        {/* Case Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedCase.title}</h1>
              <p className="text-gray-600">{selectedCase.description}</p>
            </div>
            <div className="flex items-center space-x-3">
              <StatusBadge status={selectedCase.status} size="lg" />
              <PriorityBadge priority={selectedCase.priority} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Case Date</p>
              <p className="text-lg text-gray-900">{selectedCase.date}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Files Uploaded</p>
              <p className="text-lg text-gray-900">{selectedCase.filesCount}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Last Activity</p>
              <p className="text-lg text-gray-900">{selectedCase.lastActivity}</p>
            </div>
          </div>
          
          <div className="mt-6">
            <AIStatusIndicator status={selectedCase.aiStatus} />
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence Upload</h3>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            
            {isUploading ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">Uploading Files...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500">{uploadProgress}% complete</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900">Drop files here or click to upload</p>
                  <p className="text-gray-500">Support for images, videos, documents, and audio files</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select Files
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Files List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Evidence Files</h3>
              <div className="flex items-center space-x-3">
                <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>
                <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Download All</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {caseFiles.map(file => (
              <div key={file.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{file.name}</h4>
                      <p className="text-sm text-gray-500">{file.size} • Uploaded {file.uploaded}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {file.aiAnalyzed ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <Brain className="w-4 h-4" />
                        <span className="text-sm font-medium">AI Analyzed</span>
                      </div>
                    ) : (
                      <button className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                        <Brain className="w-4 h-4" />
                        <span className="text-sm font-medium">Analyze with AI</span>
                      </button>
                    )}
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                <h1 className="text-xl font-bold text-gray-900">Cold Case Cracker</h1>
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
                <button
                  onClick={() => setActiveTab('cases')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'cases' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Cases
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'analytics' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  AI Analytics
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
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
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

export default ColdCaseCracker;