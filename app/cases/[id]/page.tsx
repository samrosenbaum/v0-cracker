'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import FileUploader from './FileUploader';
import AIInsights from './AIInsights';

export default function CaseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: caseResult } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();
      setCaseData(caseResult);
      setPromptValue(caseResult?.ai_prompt || '');

      const folderPath = `${user.id}/${id}`;
      const { data: fileList, error } = await supabase.storage
        .from('case-files')
        .list(folderPath, { limit: 100 });

      if (error) {
        console.error('Error listing files:', error.message);
      } else {
        setFiles(fileList || []);
      }

      // Fetch analyses for this case, filtered by user_id
      const { data: analysisList, error: analysisError } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (analysisError) {
        console.error('Error fetching analyses:', analysisError.message);
      } else {
        setAnalyses(analysisList || []);
      }
    };

    checkAuthAndLoad();
  }, [id, router]);

  const handleSendToAI = async (filename: string) => {
    setStatus(`Analyzing ${filename}...`);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${id}/${filename}`;
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('case-files')
      .createSignedUrl(filePath, 60);

    if (urlError || !urlData?.signedUrl) {
      setStatus(`Error getting file URL: ${urlError?.message}`);
      return;
    }

    const fileRes = await fetch(urlData.signedUrl);
    const blob = await fileRes.blob();
    const file = new File([blob], filename, { type: blob.type });

    const formData = new FormData();
    formData.append("caseId", id as string);
    formData.append("files", file);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStatus("You must be logged in to analyze files.");
      return;
    }

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      headers: {
        "Authorization": `Bearer ${session.access_token}`
      }
    });

    const contentType = res.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await res.json();
    } else {
      const text = await res.text();
      throw new Error("Non-JSON response: " + text);
    }

    setStatus(
      result.analysis
        ? "Analysis complete! (see below)"
        : "No structured results returned."
    );
    setAiResult(result.analysis);

    // Refresh analyses list after new analysis
    const { data: analysisList, error: analysisError } = await supabase
      .from('case_analysis')
      .select('*')
      .eq('case_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!analysisError) {
      setAnalyses(analysisList || []);
      setSelectedAnalysis(analysisList?.[0] || null); // Show the latest
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {caseData ? (
        <>
          <h1 className="text-2xl font-bold">{caseData.title}</h1>
          <p className="mb-2">{caseData.description}</p>
          <div className="mb-6">
            <label className="font-semibold">AI Prompt:</label>
            {editingPrompt ? (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  const { error } = await supabase
                    .from('cases')
                    .update({ ai_prompt: promptValue })
                    .eq('id', id);
                  if (!error) {
                    setCaseData({ ...caseData, ai_prompt: promptValue });
                    setEditingPrompt(false);
                  }
                }}
                className="flex gap-2 mt-2"
              >
                <textarea
                  value={promptValue}
                  onChange={e => setPromptValue(e.target.value)}
                  className="border p-2 rounded w-full"
                  rows={2}
                />
                <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Save</button>
                <button type="button" onClick={() => { setPromptValue(caseData.ai_prompt || ''); setEditingPrompt(false); }} className="px-3 py-1 rounded border">Cancel</button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="italic text-gray-700">{caseData.ai_prompt || <span className="text-gray-400">No prompt set</span>}</span>
                <button onClick={() => setEditingPrompt(true)} className="text-blue-600 underline text-sm">Edit</button>
              </div>
            )}
          </div>

          <FileUploader caseId={id as string} />

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-2">Uploaded Files</h2>
            {files.length === 0 ? (
              <p className="text-gray-500">No files uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((file) => (
                  <li key={file.name} className="border p-2 rounded flex justify-between items-center">
                    <span>
                      <strong>{file.name}</strong> ({(file.metadata?.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => handleSendToAI(file.name)}
                      className="bg-purple-600 text-white text-sm px-3 py-1 rounded hover:bg-purple-700"
                    >
                      Send to AI
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{status}</p>
          </div>

          {/* Analyses Dashboard */}
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-2">Case Analyses</h2>
            {analyses.length === 0 ? (
              <p className="text-gray-500">No analyses yet for this case.</p>
            ) : (
              <div className="space-y-2">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className={`border rounded p-3 cursor-pointer ${selectedAnalysis?.id === analysis.id ? 'bg-purple-50 border-purple-400' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedAnalysis(analysis)}
                  >
                    <div className="flex justify-between items-center">
                      <span>
                        <strong>{analysis.analysis_type}</strong> &middot; {new Date(analysis.created_at).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">Confidence: {analysis.confidence_score ?? 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Show selected analysis details */}
            {selectedAnalysis && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Analysis Details</h3>
                <AIInsights data={selectedAnalysis.analysis_data} />
              </div>
            )}
          </div>
        </>
      ) : (
        <p>Loading case...</p>
      )}
    </div>
  );
}
