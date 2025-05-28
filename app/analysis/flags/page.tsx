"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AnalysisFlagsDashboard } from "@/components/analysis-review/analysis-flags-dashboard";
import { LucideArrowLeft, LucideAlertCircle, LucideRefreshCw, LucideFileText, LucideUpload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import SuspectGraph from "@/components/analysis-visuals/SuspectGraph";

export default function AnalysisFlagsPage() {
  const [parsedText, setParsedText] = useState("");
  const [analysisResults, setAnalysisResults] = useState(null);
  const [caseId, setCaseId] = useState("case-001");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  return (
    <div className="container py-8">
      <Link href="/analysis" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Analysis
      </Link>

      <div className="flex flex-col gap-6">
        {/* File Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Case Files</CardTitle>
            <CardDescription>Upload PDF, DOCX, or TXT files. AI will analyze and flag potential issues.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData();
                selectedFiles.forEach(file => formData.append("files", file));
                formData.append("caseId", caseId);

                const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
                const uploadJson = await uploadRes.json();
                setParsedText(uploadJson.content || "No content parsed");

                const processRes = await fetch("/api/analyze", { method: "POST", body: formData });
                const processJson = await processRes.json();
                setAnalysisResults(processJson.analysis);
              }}
              className="flex flex-col gap-4"
            >
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary/90"
              />
              <input
                type="text"
                placeholder="Enter Case ID"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="border px-3 py-2 text-sm rounded"
              />
              <Button type="submit" disabled={selectedFiles.length === 0} className="flex items-center gap-2">
                <LucideUpload className="h-4 w-4" />
                Analyze Case
              </Button>
            </form>

            {parsedText && (
              <div className="mt-6 border p-4 rounded bg-background text-sm whitespace-pre-wrap">
                <h3 className="text-md font-semibold mb-2">Parsed File Preview</h3>
                {parsedText}
              </div>
            )}
          </CardContent>
        </Card>

        {analysisResults && (
          <Tabs defaultValue="flags" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="flags">Flags</TabsTrigger>
              <TabsTrigger value="suspects">Suspects</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="flags" className="mt-6">
              {analysisResults.findings?.length > 0 ? (
                <ul className="space-y-4">
                  {analysisResults.findings.map((finding: any, idx: number) => (
                    <li key={idx} className="border p-4 rounded">
                      <h4 className="font-semibold">{finding.title}</h4>
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                      <p className="text-xs mt-2">Priority: {finding.priority} | Confidence: {finding.confidence}%</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No findings reported.</p>
              )}
            </TabsContent>

            <TabsContent value="suspects" className="mt-6">
              {analysisResults.suspects?.length > 0 ? (
                <SuspectGraph suspects={analysisResults.suspects} />
              ) : (
                <p className="text-sm text-muted-foreground">No suspects identified.</p>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="mt-6">
              {analysisResults.recommendations?.length > 0 ? (
                <ul className="space-y-4">
                  {analysisResults.recommendations.map((rec: any, idx: number) => (
                    <li key={idx} className="border p-4 rounded">
                      <h4 className="font-semibold">{rec.action}</h4>
                      <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                      <p className="text-xs mt-2">Expected Outcome: {rec.expectedOutcome}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recommendations provided.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
