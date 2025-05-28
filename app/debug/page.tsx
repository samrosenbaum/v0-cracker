'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DebugPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
    loadCases();
    loadDocuments();
    loadAnalyses();
    loadFiles();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadCases = async () => {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Cases error:', error);
    } else {
      setCases(data || []);
    }
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('case_documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Documents error:', error);
    } else {
      setDocuments(data || []);
    }
  };

  const loadAnalyses = async () => {
    const { data, error } = await supabase
      .from('case_analyses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Analyses error:', error);
    } else {
      setAnalyses(data || []);
    }
  };

  const loadFiles = async () => {
    if (!user) return;
    
    const { data, error } = await supabase.storage
      .from('case-files')
      .list('', { limit: 100 });
    
    if (error) {
      console.error('Files error:', error);
    } else {
      setFiles(data || []);
    }
  };

  return (
    <div className="container py-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Debug Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Info</CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div>
                <p><strong>ID:</strong> {user.id}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Logged in:</strong> ✅</p>
              </div>
            ) : (
              <p>Not logged in</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cases ({cases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {cases.length > 0 ? (
              cases.slice(0, 3).map(case_item => (
                <div key={case_item.id} className="border-b py-2">
                  <p><strong>{case_item.title || case_item.case_number}</strong></p>
                  <p className="text-sm text-gray-600">Status: {case_item.status}</p>
                </div>
              ))
            ) : (
              <p>No cases found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              documents.slice(0, 3).map(doc => (
                <div key={doc.id} className="border-b py-2">
                  <p><strong>{doc.file_name}</strong></p>
                  <p className="text-sm text-gray-600">Type: {doc.document_type}</p>
                  <p className="text-sm text-gray-600">Case: {doc.case_id}</p>
                </div>
              ))
            ) : (
              <p>No documents found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Analyses ({analyses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {analyses.length > 0 ? (
              analyses.slice(0, 3).map(analysis => (
                <div key={analysis.id} className="border-b py-2">
                  <p><strong>Type:</strong> {analysis.analysis_type}</p>
                  <p className="text-sm text-gray-600">Confidence: {analysis.confidence_score}%</p>
                  <p className="text-sm text-gray-600">Case: {analysis.case_id}</p>
                </div>
              ))
            ) : (
              <p>No analyses found</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Storage Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="grid gap-2">
                {files.slice(0, 5).map(file => (
                  <div key={file.name} className="border-b py-2">
                    <p><strong>{file.name}</strong></p>
                    <p className="text-sm text-gray-600">
                      Size: {file.metadata?.size ? Math.round(file.metadata.size / 1024) + ' KB' : 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Updated: {new Date(file.updated_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No files found in storage</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={() => {
          loadCases();
          loadDocuments();
          loadAnalyses();
          loadFiles();
        }}>
          Refresh All Data
        </Button>
      </div>
    </div>
  );
}