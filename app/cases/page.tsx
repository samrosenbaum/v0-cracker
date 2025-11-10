'use client'

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AllCasesContent from '@/components/AllCasesContent';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center space-x-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-lg text-gray-600">Loading cases...</span>
      </div>
    </div>
  );
}

export default function AllCasesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AllCasesContent />
    </Suspense>
  );
}
