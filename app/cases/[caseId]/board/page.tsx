'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TimelineVisualization from '@/components/TimelineVisualization';
import MurderBoard from '@/components/MurderBoard';
import AlibiTracker from '@/components/AlibiTracker';
import EntityFormModal from '@/components/EntityFormModal';
import ConnectionFormModal from '@/components/ConnectionFormModal';
import TimelineEventFormModal from '@/components/TimelineEventFormModal';
import AlibiEntryFormModal from '@/components/AlibiEntryFormModal';
import { Database } from '@/app/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
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

export default function InvestigationBoardPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isAlibiModalOpen, setIsAlibiModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<CaseEntity | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<CaseConnection | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [selectedAlibi, setSelectedAlibi] = useState<AlibiEntry | null>(null);
  const [preselectedSubjectId, setPreselectedSubjectId] = useState<string | undefined>();

  const fetchBoardData = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);

      const response = await fetch(`/api/cases/${caseId}/board`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch board data');
      }

      setBoardData(result.data);

      if (showToast) {
        toast.success('Board data refreshed');
      }
    } catch (error: any) {
      console.error('[Board] Error fetching data:', error);
      toast.error(error.message || 'Failed to load investigation board');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, [caseId]);

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
              Murder Board
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
                setSelectedEvent(event);
                setIsTimelineModalOpen(true);
              }}
              onAddEvent={() => {
                setSelectedEvent(null);
                setIsTimelineModalOpen(true);
              }}
            />
          </TabsContent>

          {/* Murder Board Tab */}
          <TabsContent value="board" className="mt-0">
            <MurderBoard
              caseId={caseId}
              entities={boardData.entities}
              connections={boardData.connections}
              victimEntityId={victimEntity?.id}
              onEntityClick={(entity) => {
                setSelectedEntity(entity);
                setIsEntityModalOpen(true);
              }}
              onConnectionClick={(connection) => {
                setSelectedConnection(connection);
                setIsConnectionModalOpen(true);
              }}
              onAddEntity={() => {
                setSelectedEntity(null);
                setIsEntityModalOpen(true);
              }}
              onAddConnection={() => {
                setSelectedConnection(null);
                setIsConnectionModalOpen(true);
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
                setSelectedAlibi(alibi);
                setIsAlibiModalOpen(true);
              }}
              onAddAlibi={(subjectId) => {
                setSelectedAlibi(null);
                setPreselectedSubjectId(subjectId);
                setIsAlibiModalOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Form Modals */}
        <EntityFormModal
          caseId={caseId}
          entity={selectedEntity}
          isOpen={isEntityModalOpen}
          onClose={() => {
            setIsEntityModalOpen(false);
            setSelectedEntity(null);
          }}
          onSuccess={() => {
            fetchBoardData(false);
          }}
        />

        <ConnectionFormModal
          caseId={caseId}
          entities={boardData.entities}
          connection={selectedConnection}
          isOpen={isConnectionModalOpen}
          onClose={() => {
            setIsConnectionModalOpen(false);
            setSelectedConnection(null);
          }}
          onSuccess={() => {
            fetchBoardData(false);
          }}
        />

        <TimelineEventFormModal
          caseId={caseId}
          entities={boardData.entities}
          event={selectedEvent}
          isOpen={isTimelineModalOpen}
          onClose={() => {
            setIsTimelineModalOpen(false);
            setSelectedEvent(null);
          }}
          onSuccess={() => {
            fetchBoardData(false);
          }}
        />

        <AlibiEntryFormModal
          caseId={caseId}
          entities={boardData.entities}
          alibi={selectedAlibi}
          preselectedSubjectId={preselectedSubjectId}
          isOpen={isAlibiModalOpen}
          onClose={() => {
            setIsAlibiModalOpen(false);
            setSelectedAlibi(null);
            setPreselectedSubjectId(undefined);
          }}
          onSuccess={() => {
            fetchBoardData(false);
          }}
        />
      </div>
    </div>
  );
}
