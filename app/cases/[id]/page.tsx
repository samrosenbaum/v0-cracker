'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import FileUploader from './FileUploader';
import AIInsights from './AIInsights';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CaseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);

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

      const folderPath = `${user.id}/${id}`;
      const { data: fileList, error } = await supabase.storage
        .from('case-files')
        .list(folderPath, { limit: 100 });

      if (error) {
        console.error('Error listing files:', error.message);
      } else {
        setFiles(fileList || []);
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

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    const result = await res.json();
    setStatus(
      result.analysis
        ? JSON.stringify(result.analysis, null, 2)
        : "No structured results returned."
    );
    setAiResult(result.analysis);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {caseData ? (
        <>
          <h1 className="text-2xl font-bold">{caseData.title}</h1>
          <p className="mb-6">{caseData.description}</p>

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
            <AIInsights data={aiResult} />
          </div>
        </>
      ) : (
        <p>Loading case...</p>
      )}
    </div>
  );
}
