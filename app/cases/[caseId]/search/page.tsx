/**
 * Semantic Search Page
 *
 * Natural language search across all case documents using vector embeddings
 */

import { Suspense } from 'react';
import SemanticSearch from '@/components/SemanticSearch';
import { Search, Loader2 } from 'lucide-react';

export default function SearchPage({ params }: { params: { caseId: string } }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-lg text-gray-600">Loading search...</span>
          </div>
        }
      >
        <SemanticSearch caseId={params.caseId} />
      </Suspense>
    </div>
  );
}
