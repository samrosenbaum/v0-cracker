import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LucideArrowLeft } from "lucide-react"
import Link from "next/link"

export default function UploadPage() {
  return (
    <div className="container py-8">
      <Link href="/" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Case Files</h1>
          <p className="text-muted-foreground mt-2">
            Upload your case files for AI analysis to identify potential suspects and patterns.
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="settings">Analysis Settings</TabsTrigger>
            <TabsTrigger value="history">Upload History</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Case Files</CardTitle>
                <CardDescription>
                  Upload case documents, evidence reports, witness statements, and other relevant files.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload />
              </CardContent>
            </Card>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Supported File Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>PDF Documents (.pdf)</li>
                    <li>Word Documents (.doc, .docx)</li>
                    <li>Text Files (.txt)</li>
                    <li>Images (.jpg, .png) with OCR processing</li>
                    <li>Spreadsheets (.xls, .xlsx)</li>
                    <li>Scanned Documents (will be processed with OCR)</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Best Practices</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Ensure all documents are properly scanned and legible</li>
                    <li>Include as much case information as possible for better analysis</li>
                    <li>Organize files by case number or incident date</li>
                    <li>Include witness statements, evidence logs, and investigation notes</li>
                    <li>Ensure all sensitive information is properly handled according to department policies</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Settings</CardTitle>
                <CardDescription>Configure how the AI analyzes your case files.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Analysis settings will be available after uploading files.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>View your previous file uploads and their analysis status.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">No upload history available.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
