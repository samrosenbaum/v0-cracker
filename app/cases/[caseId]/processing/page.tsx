/**
 * Document Processing Dashboard Page
 *
 * Real-time monitoring of document processing jobs for a case
 */

import { Suspense } from 'react';
import ProcessingDashboard from '@/components/ProcessingDashboard';
import { RefreshCw } from 'lucide-react';

export default function ProcessingPage({ params }: { params: { caseId: string } }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-lg text-gray-600">Loading dashboard...</span>
          </div>
        }
      >
        <ProcessingDashboard caseId={params.caseId} autoRefresh={true} refreshInterval={3000} />
      </Suspense>
    </div>
  );
}
