'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TimelineVisualization from '@/components/TimelineVisualization';
import MurderBoard from '@/components/MurderBoard';
import AlibiTracker from '@/components/AlibiTracker';
import { Database } from '@/app/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

type CaseEntity = Database['public']['Tables']['case_entities']['Row'];
type CaseConnection = Database['public']['Tables']['case_connections']['Row'];
type TimelineEvent = Database['public']['Tables']['timeline_events']['Row'];
type AlibiEntry = Database['public']['Tables']['alibi_entries']['Row'];

interface BoardData {
  entities: CaseEntity[];
  connections: CaseConnection[];
  timeline_events: TimelineEvent[];
  alibis: AlibiEntry[];
  summary: any;
}

interface BoardApiResponse {
  success: boolean;
  data: BoardData;
  autoPopulated?: boolean;
  error?: string;
}

export default function InvestigationBoardPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);

  const fetchBoardData = async (showToast = false): Promise<BoardData | null> => {
    try {
      if (showToast) setIsRefreshing(true);

      const response = await fetch(`/api/cases/${caseId}/board`);
      const result: BoardApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch board data');
      }

      setBoardData(result.data);

      if (result.autoPopulated) {
        toast.success('Investigation board auto-populated from case documents');
      } else if (showToast) {
        toast.success('Board data refreshed');
      }

      return result.data;
    } catch (error: any) {
      console.error('[Board] Error fetching data:', error);
      toast.error(error.message || 'Failed to load investigation board');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, [caseId]);

  const handlePopulateFromDocuments = async () => {
    try {
      setIsPopulating(true);
      toast.loading('Analyzing documents and populating board...', { id: 'populate' });

      const response = await fetch(`/api/cases/${caseId}/board/populate`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger population');
      }

      if (result.mode === 'sync') {
        toast.success('Board populated directly from documents!', { id: 'populate', duration: 4000 });
        await fetchBoardData(false);
        setIsPopulating(false);
        return;
      }

      toast.success(
        'Board population started! This may take a few minutes. The page will refresh automatically when complete.',
        { id: 'populate', duration: 5000 }
      );

      // Poll for updates every 5 seconds
      let timeoutId: ReturnType<typeof setTimeout>;
      const pollInterval = setInterval(async () => {
        const latestData = await fetchBoardData(false);

        if (
          latestData &&
          (latestData.entities.length > 0 ||
            latestData.timeline_events.length > 0 ||
            latestData.connections.length > 0 ||
            latestData.alibis.length > 0)
        ) {
          clearInterval(pollInterval);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          setIsPopulating(false);
          toast.success('Board populated successfully!', { duration: 3000 });
        }
      }, 5000);

      // Stop polling after 2 minutes
      timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        setIsPopulating(false);
      }, 120000);

    } catch (error: any) {
      console.error('[Board] Error triggering population:', error);
      toast.error(error.message || 'Failed to trigger board population', { id: 'populate' });
      setIsPopulating(false);
    }
  };

  // Find victim entity if exists
  const victimEntity = boardData?.entities.find(
    (e) => e.role === 'victim' || e.role?.toLowerCase().includes('victim')
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading investigation board...</p>
        </div>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load investigation board</p>
          <button
            onClick={() => fetchBoardData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/cases/${caseId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Investigation Board</h1>
              <p className="text-sm text-gray-600 mt-1">
                Visual investigation tools for timeline analysis, connection mapping, and alibi tracking
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePopulateFromDocuments}
                disabled={isPopulating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className={`w-4 h-4 ${isPopulating ? 'animate-pulse' : ''}`} />
                {isPopulating ? 'Populating...' : 'Populate from Documents'}
              </button>

              <button
                onClick={() => fetchBoardData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        {boardData.summary && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Entities</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardData.summary.entities?.length || boardData.entities.length}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Connections</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardData.summary.connections || boardData.connections.length}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Timeline Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardData.summary.timeline_events || boardData.timeline_events.length}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Alibis</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardData.summary.alibis || boardData.alibis.length}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Verified Events</p>
              <p className="text-2xl font-bold text-green-600">
                {boardData.summary.verified_events ||
                  boardData.timeline_events.filter((e) => e.verification_status === 'verified').length}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600 mb-1">Unverified Alibis</p>
              <p className="text-2xl font-bold text-yellow-600">
                {boardData.summary.unverified_alibis ||
                  boardData.alibis.filter((a) => a.verification_status === 'unverified').length}
              </p>
            </div>
          </div>
        )}

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white rounded-lg p-1 border">
            <TabsTrigger value="timeline" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="board" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Relationship Map
            </TabsTrigger>
            <TabsTrigger value="alibis" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              Alibi Tracker
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            <TimelineVisualization
              caseId={caseId}
              events={boardData.timeline_events}
              entities={boardData.entities}
              onEventClick={(event) => {
                console.log('Event clicked:', event);
                // Could open a modal or detail panel
              }}
              onAddEvent={() => {
                toast.success('Add event feature coming soon!');
                // Navigate to add event form
              }}
            />
          </TabsContent>

          {/* Relationship Map Tab */}
          <TabsContent value="board" className="mt-0">
            <MurderBoard
              caseId={caseId}
              entities={boardData.entities}
              connections={boardData.connections}
              victimEntityId={victimEntity?.id}
              onEntityClick={(entity) => {
                console.log('Entity clicked:', entity);
                // Could open entity detail panel
              }}
              onConnectionClick={(connection) => {
                console.log('Connection clicked:', connection);
                // Could open connection detail panel
              }}
              onAddEntity={() => {
                toast.success('Add entity feature coming soon!');
                // Navigate to add entity form
              }}
              onAddConnection={() => {
                toast.success('Add connection feature coming soon!');
                // Navigate to add connection form
              }}
            />
          </TabsContent>

          {/* Alibi Tracker Tab */}
          <TabsContent value="alibis" className="mt-0">
            <AlibiTracker
              caseId={caseId}
              alibis={boardData.alibis}
              entities={boardData.entities}
              onAlibiClick={(alibi) => {
                console.log('Alibi clicked:', alibi);
                // Could open alibi detail panel
              }}
              onAddAlibi={(subjectId) => {
                console.log('Add alibi for:', subjectId);
                toast.success('Add alibi feature coming soon!');
                // Navigate to add alibi form
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
