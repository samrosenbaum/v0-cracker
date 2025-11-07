'use client';

import { useState } from 'react';
import { Search, FileText, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface SearchResult {
  id: string;
  case_file_id: string;
  chunk_index: number;
  chunk_type: string;
  content: string;
  metadata: any;
  similarity: number;
  similarity_percentage: string;
  file_name: string;
  page_number: number;
}

interface SemanticSearchProps {
  caseId: string;
}

export default function SemanticSearch({ caseId }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Advanced options
  const [matchThreshold, setMatchThreshold] = useState(0.7);
  const [matchCount, setMatchCount] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          matchThreshold,
          matchCount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);

      if (data.results.length === 0) {
        toast('No results found. Try adjusting your query or lowering the threshold.');
      } else {
        toast.success(`Found ${data.results.length} results`);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  const highlightQuery = (text: string, query: string) => {
    if (!query.trim()) return text;

    const words = query.toLowerCase().split(/\s+/);
    const regex = new RegExp(`(${words.join('|')})`, 'gi');

    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = words.some(word =>
            part.toLowerCase().includes(word.toLowerCase())
          );
          return isMatch ? (
            <mark key={i} className="bg-yellow-200 font-semibold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </span>
    );
  };

  const getContextSnippet = (content: string, maxLength: number = 300) => {
    if (!content) return '';

    // Try to find query words in content
    const words = query.toLowerCase().split(/\s+/);
    let bestIndex = 0;
    let bestScore = 0;

    for (let i = 0; i < content.length - maxLength; i += 50) {
      const snippet = content.substring(i, i + maxLength).toLowerCase();
      const score = words.filter(word => snippet.includes(word)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    let snippet = content.substring(bestIndex, bestIndex + maxLength);

    // Add ellipsis if not at start/end
    if (bestIndex > 0) snippet = '...' + snippet;
    if (bestIndex + maxLength < content.length) snippet = snippet + '...';

    return snippet;
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Semantic Search</h2>
        <p className="text-gray-600">
          Search across all documents using natural language. Try queries like "blue sedan",
          "witness statements", or "weapon description"
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for anything... e.g., 'blue sedan near 5th street'"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Advanced Options
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Similarity Threshold: {(matchThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">
                Lower = more results (less precise), Higher = fewer results (more precise)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Results: {matchCount}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={matchCount}
                onChange={(e) => setMatchCount(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      {searched && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">Searching documents...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No results found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try a different query or lower the similarity threshold
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Found <strong>{results.length}</strong> results for "<strong>{query}</strong>"
                </p>
                <p className="text-xs text-gray-500">
                  Sorted by relevance
                </p>
              </div>

              {results.map((result) => {
                const isExpanded = expandedResults.has(result.id);
                const snippet = getContextSnippet(result.content);

                return (
                  <div
                    key={result.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors bg-white"
                  >
                    {/* Result Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {result.file_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Page {result.page_number} • Chunk {result.chunk_index}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${
                              result.similarity > 0.85
                                ? 'text-green-600'
                                : result.similarity > 0.75
                                ? 'text-blue-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {result.similarity_percentage}%
                          </div>
                          <div className="text-xs text-gray-500">match</div>
                        </div>
                        <button
                          onClick={() => toggleExpanded(result.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Content Snippet */}
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {isExpanded ? (
                        <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
                          {highlightQuery(result.content, query)}
                        </div>
                      ) : (
                        <p>{highlightQuery(snippet, query)}</p>
                      )}
                    </div>

                    {/* Metadata */}
                    {result.metadata && Object.keys(result.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Type: {result.chunk_type}
                          {result.metadata.extractionMethod && (
                            <> • Method: {result.metadata.extractionMethod}</>
                          )}
                          {result.metadata.totalPages && (
                            <> • Total Pages: {result.metadata.totalPages}</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searched && (
        <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
          <Search className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Search Across All Documents
          </h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Use natural language to find anything in your case files. Our AI understands context and meaning.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => {
                setQuery('weapon description');
                handleSearch();
              }}
              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50"
            >
              weapon description
            </button>
            <button
              onClick={() => {
                setQuery('witness saw suspect');
                handleSearch();
              }}
              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50"
            >
              witness saw suspect
            </button>
            <button
              onClick={() => {
                setQuery('blue sedan');
                handleSearch();
              }}
              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50"
            >
              blue sedan
            </button>
            <button
              onClick={() => {
                setQuery('timeline 2-4 PM');
                handleSearch();
              }}
              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50"
            >
              timeline 2-4 PM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
