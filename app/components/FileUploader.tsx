'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function FileUploader({ caseId }: { caseId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const uploadFile = async () => {
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('User not authenticated');
      return;
    }

    const filePath = `${user.id}/${caseId}/${file.name}`;
    const { error } = await supabase
      .storage
      .from('case-files')
      .upload(filePath, file);

    if (error) {
      setStatus(`Upload failed: ${error.message}`);
    } else {
      setStatus('File uploaded successfully!');
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block border p-2 rounded"
      />
      <button
        onClick={uploadFile}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Upload File
      </button>
      <div className="text-sm text-gray-700">{status}</div>
    </div>
  );
}
