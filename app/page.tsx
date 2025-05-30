'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardStats } from "@/components/dashboard-stats"
import { RecentCases } from "@/components/recent-cases"
import { LucideFileSearch, LucideUpload, LucideUsers, LucideBarChart2 } from "lucide-react"
import { useRouter } from 'next/navigation';

export default function Home() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
      setCases(data || []);
      setLoading(false);
    };
    fetchCases();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('cases')
      .insert([{
        title,
        description,
        case_number: caseNumber,
        incident_date: incidentDate || null,
        location,
        jurisdiction,
        case_type: caseType,
        status,
        priority,
        assigned_detective: assignedDetective,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        user_id: user.id,
        ai_prompt: aiPrompt,
      }])
      .select()
      .single();

    if (error) {
      setFormStatus(`Error: ${error.message}`);
    } else {
      router.push(`/cases/${data.id}`);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Investigation Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome to the Case Analysis Platform</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Link href="/case-analysis">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center p-6">
              <LucideFileSearch className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-semibold">Analyze Case</h3>
                <p className="text-sm text-muted-foreground">Process new evidence</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cases">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center p-6">
              <LucideUsers className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-semibold">View Cases</h3>
                <p className="text-sm text-muted-foreground">Browse all cases</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/upload">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center p-6">
              <LucideUpload className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-semibold">Upload Files</h3>
                <p className="text-sm text-muted-foreground">Add new documents</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/forensics">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex items-center p-6">
              <LucideBarChart2 className="h-8 w-8 text-primary mr-4" />
              <div>
                <h3 className="font-semibold">Forensics</h3>
                <p className="text-sm text-muted-foreground">Digital evidence</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats and Recent Cases */}
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <DashboardStats cases={cases} loading={loading} />
        </div>
        <div>
          <RecentCases cases={cases} loading={loading} />
        </div>
      </div>
    </div>
  )
}