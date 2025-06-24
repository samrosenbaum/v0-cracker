import React, { useState } from 'react';
import { FileText, Users, MapPin, Calendar, Car, Phone, DollarSign, Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ParsingDiagnosticProps {
  analysisData: any;
  filesAnalyzed: any[];
  advancedParsing?: any;
}

export default function ParsingDiagnostic({ analysisData, filesAnalyzed, advancedParsing }: ParsingDiagnosticProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Check if advanced parsing was actually used
  const isAdvancedParsingUsed = advancedParsing && Object.keys(advancedParsing).length > 0;
  const hasEnhancedAnalysis = analysisData?.enhancedAnalysis && Object.keys(analysisData.enhancedAnalysis).length > 0;
  
  const entityStats = advancedParsing?.entityBreakdown || {
    people: 0,
    locations: 0,
    dates: 0,
    vehicles: 0,
    communications: 0,
    evidence: 0
  };

  const totalEntities = Object.values(entityStats).reduce((sum: number, count: number) => sum + count, 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Parsing Analysis Report</h3>
        <div className="flex items-center space-x-2">
          {isAdvancedParsingUsed ? (
            <span className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              Advanced Parsing Active
            </span>
          ) : (
            <span className="flex items-center text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Basic Parsing Used
            </span>
          )}
        </div>
      </div>

      {/* Parsing Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Documents</p>
              <p className="text-xl font-bold text-blue-800">{filesAnalyzed?.length || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <Users className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm text-green-600 font-medium">Total Entities</p>
              <p className="text-xl font-bold text-green-800">{totalEntities}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-purple-600 mr-2" />
            <div>
              <p className="text-sm text-purple-600 font-medium">Quality Score</p>
              <p className="text-xl font-bold text-purple-800">{advancedParsing?.averageQualityScore || 'N/A'}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
            <div>
              <p className="text-sm text-orange-600 font-medium">Analysis Type</p>
              <p className="text-sm font-bold text-orange-800">
                {hasEnhancedAnalysis ? 'Enhanced' : 'Legacy'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Entity Breakdown */}
      {isAdvancedParsingUsed && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Entity Extraction Results</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">People</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.people}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <MapPin className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Locations</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.locations}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Calendar className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Dates</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.dates}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Car className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Vehicles</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.vehicles}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Phone className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Communications</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.communications}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Shield className="w-6 h-6 text-orange-600 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Evidence</p>
              <p className="text-lg font-bold text-gray-900">{entityStats.evidence}</p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Information */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-800 mb-3"
        >
          <Info className="w-4 h-4 mr-1" />
          {showDetails ? 'Hide' : 'Show'} Technical Details
        </button>
        
        {showDetails && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Parsing Method Detection</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Advanced Parser Used:</span>
                  <span className={isAdvancedParsingUsed ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {isAdvancedParsingUsed ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Enhanced Analysis Present:</span>
                  <span className={hasEnhancedAnalysis ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {hasEnhancedAnalysis ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Entities Extracted:</span>
                  <span className="font-medium">{advancedParsing?.totalEntitiesExtracted || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Document Types Detected:</span>
                  <span className="font-medium">
                    {advancedParsing?.documentTypes?.join(', ') || 'None detected'}
                  </span>
                </div>
              </div>
            </div>

            {/* File Analysis Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">File Processing Results</h5>
              <div className="space-y-2">
                {filesAnalyzed?.map((file, index) => (
                  <div key={index} className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                    <span className="font-medium">{file.name}</span>
                    <div className="flex space-x-4 text-gray-600">
                      <span>{file.type}</span>
                      <span>{file.textLength} chars</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Data Preview */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Analysis Data Structure</h5>
              <div className="text-xs font-mono bg-white p-3 rounded border max-h-40 overflow-auto">
                <pre>{JSON.stringify({
                  suspects: analysisData?.suspects?.length || 0,
                  findings: analysisData?.findings?.length || 0,
                  connections: analysisData?.connections?.length || 0,
                  recommendations: analysisData?.recommendations?.length || 0,
                  overlookedLeads: analysisData?.overlookedLeads?.length || 0,
                  enhancedAnalysis: hasEnhancedAnalysis ? 'Present' : 'Missing',
                  advancedParsing: isAdvancedParsingUsed ? 'Active' : 'Inactive'
                }, null, 2)}</pre>
              </div>
            </div>

            {/* Troubleshooting */}
            {!isAdvancedParsingUsed && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h5 className="font-medium text-yellow-800 mb-2">Troubleshooting: Advanced Parser Not Active</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Check if AdvancedDocumentParser.parseDocument() is being called</li>
                  <li>• Verify the parser is returning structured entity data</li>
                  <li>• Ensure the API route is using the enhanced analysis pathway</li>
                  <li>• Check console logs for parsing errors or fallbacks</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}