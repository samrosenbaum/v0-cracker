# Case File Upload System

## Overview

The FreshEyes file upload system provides a complete UX for uploading, managing, and analyzing case documents. Investigators can drag-and-drop files, categorize them, and trigger AI analysis with one click.

---

## Features

### 1. **Drag-and-Drop Upload Interface**

**Component:** `components/CaseFileUpload.tsx`

**Features:**
- Drag-and-drop file upload zone
- Multi-file selection
- Real-time upload progress
- Automatic file type detection
- Document type categorization
- Optional descriptions for each file

**Supported File Types:**
- PDF documents
- Word documents (.doc, .docx)
- Images (.jpg, .png, .gif, .bmp)
- Videos (.mp4, .avi, .mov, .wmv)
- Any other file type

**Document Categories:**
- Police Report
- Witness Statement
- Forensic Report
- Autopsy Report
- Phone Records
- Financial Records
- Surveillance Footage
- Photo Evidence
- Interview Transcript
- Lab Results
- Other Document

---

### 2. **Case Files Management Page**

**Location:** `/cases/[caseId]/files`

**Features:**

#### File Upload Section
- Drag-and-drop zone
- File browser selection
- Batch upload multiple files
- Upload progress tracking
- Success/error indicators

#### Document List
- All uploaded files with metadata
- File name, type, size, upload date
- Document type badges (color-coded)
- Download individual files
- Delete files
- Search/filter capabilities

#### Analysis Triggers
- **Timeline Analysis** - Detect conflicts & inconsistencies
- **Deep Analysis** - 8-dimensional cold case review
- **Victim Timeline** - Last 24-48 hours reconstruction

One-click buttons to run analysis on all uploaded documents.

#### Statistics Dashboard
- Total files count
- Total storage used
- Witness statements count
- Evidence photos count

---

### 3. **Integration with Existing Platform**

**FreshEyesPlatform Component Updated:**

Added "Manage Case Files" button in case details view that links to:
```
/cases/{caseId}/files
```

This provides direct access to the full file management interface from the main dashboard.

---

## Technical Implementation

### File Upload Flow

1. **User Selects Files**
   - Drag-and-drop or file browser
   - Files added to staging area

2. **Metadata Entry**
   - Auto-detected document type (can be changed)
   - Optional description
   - File preview

3. **Upload to Supabase Storage**
   - Files uploaded to `case-files` bucket
   - Path: `{caseId}/{timestamp}_{random}.{extension}`
   - Progress tracking (0-100%)

4. **Database Record Creation**
   - Record inserted into `case_documents` table
   - Includes: file_name, document_type, description, storage_path, file_size, mime_type

5. **Success Confirmation**
   - Green checkmark on successful upload
   - File appears in documents list
   - Ready for analysis

---

### Database Schema

**Table:** `case_documents`

```sql
CREATE TABLE case_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id),
  file_name TEXT NOT NULL,
  document_type TEXT,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Storage Bucket:** `case-files`

- Public bucket for file access
- Organized by case ID
- Row Level Security policies applied

---

### Supabase Storage Setup

**Run this SQL to set up storage:**

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload case files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case-files');

-- Allow viewing
CREATE POLICY "Authenticated users can view case files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'case-files');

-- Allow deletion
CREATE POLICY "Users can delete case files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'case-files');
```

File: `supabase-storage-setup.sql`

---

## Usage Guide

### For Investigators

#### Step 1: Navigate to Case Files

From the main dashboard:
1. Click on a case
2. Click "Manage Case Files" button
3. You'll be taken to `/cases/{caseId}/files`

#### Step 2: Upload Documents

**Option A: Drag and Drop**
1. Drag files from your computer
2. Drop them into the upload zone
3. Files will be added to staging area

**Option B: File Browser**
1. Click "Upload Files" button
2. Click "Select Files" in the upload zone
3. Choose files from your computer
4. Files will be added to staging area

#### Step 3: Categorize Files

For each file:
1. Select document type from dropdown
   - Police Report, Witness Statement, etc.
2. (Optional) Add description
   - Example: "Detective Smith's interview notes from 3/15"

#### Step 4: Upload All

1. Review all files in staging area
2. Click "Upload All" button
3. Watch progress bars for each file
4. Green checkmarks indicate successful uploads

#### Step 5: Run Analysis

Once files are uploaded:
1. Click "Timeline Analysis" to detect conflicts
2. Click "Deep Analysis" for comprehensive review
3. Click "Victim Timeline" to reconstruct last movements

Analysis results will be saved to the database and can be viewed in the respective analysis pages.

---

### For Developers

#### Component Usage

```typescript
import CaseFileUpload from '@/components/CaseFileUpload';

function MyPage() {
  const handleComplete = () => {
    console.log('Upload complete!');
    // Refresh documents list, etc.
  };

  return (
    <CaseFileUpload
      caseId="123-456-789"
      onUploadComplete={handleComplete}
    />
  );
}
```

#### Fetching Documents

```typescript
import { supabase } from '@/lib/supabase-client';

const { data, error } = await supabase
  .from('case_documents')
  .select('*')
  .eq('case_id', caseId)
  .order('created_at', { ascending: false });
```

#### Downloading Files

```typescript
const { data } = supabase.storage
  .from('case-files')
  .getPublicUrl(document.storage_path);

window.open(data.publicUrl, '_blank');
```

#### Deleting Files

```typescript
// Delete from storage
await supabase.storage
  .from('case-files')
  .remove([document.storage_path]);

// Delete from database
await supabase
  .from('case_documents')
  .delete()
  .eq('id', document.id);
```

---

## File Organization

### Project Structure

```
casecracker/
├── components/
│   └── CaseFileUpload.tsx          # Drag-and-drop upload component
├── app/
│   └── cases/
│       └── [caseId]/
│           └── files/
│               └── page.tsx         # File management page
└── supabase-storage-setup.sql      # Storage bucket setup
```

---

## Features in Detail

### Automatic Type Detection

The system automatically detects document type based on filename:

- "police_report.pdf" → Police Report
- "witness_statement_john.doc" → Witness Statement
- "forensic_lab_results.pdf" → Forensic Report
- "autopsy.pdf" → Autopsy Report
- "phone_records.csv" → Phone Records
- "bank_statement.pdf" → Financial Records
- "interview_transcript.txt" → Interview Transcript
- "evidence_photo.jpg" → Photo Evidence
- "surveillance_cam1.mp4" → Surveillance Footage

Users can change the detected type if needed.

---

### Upload States

Each file has a status:

1. **Pending** (gray)
   - File selected but not uploaded
   - Can edit metadata
   - Can remove from list

2. **Uploading** (blue, animated)
   - Upload in progress
   - Progress bar showing %
   - Cannot edit

3. **Success** (green checkmark)
   - Upload completed successfully
   - File saved to storage and database
   - Cannot remove

4. **Error** (red X)
   - Upload failed
   - Error message displayed
   - Can retry

---

### File Size Display

Automatically formats file sizes:
- Less than 1 KB: "512 bytes"
- Less than 1 MB: "45.2 KB"
- 1 MB or more: "12.5 MB"

---

### Color-Coded Document Types

Each document type has a unique color badge:

- **Police Report** - Blue
- **Witness Statement** - Purple
- **Forensic Report** - Green
- **Autopsy Report** - Red
- **Phone Records** - Yellow
- **Financial Records** - Orange
- **Surveillance Footage** - Pink
- **Photo Evidence** - Indigo
- **Interview Transcript** - Teal
- **Lab Results** - Cyan
- **Other** - Gray

Makes it easy to visually scan document types.

---

## Analysis Integration

### Timeline Analysis

```typescript
const response = await fetch(`/api/cases/${caseId}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const { timeline, conflicts, personMentions } = await response.json();
```

Analyzes all uploaded documents to:
- Extract timeline events
- Detect time conflicts
- Identify frequently mentioned persons
- Flag unfollowed tips

---

### Deep Analysis

```typescript
const response = await fetch(`/api/cases/${caseId}/deep-analysis`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const { analysis } = await response.json();
```

Runs comprehensive 8-dimensional analysis:
1. Behavioral patterns
2. Evidence gaps
3. Relationship networks
4. Similar cases
5. Overlooked details
6. Interrogation strategies
7. Forensic retesting
8. Master action plan

---

### Victim Timeline

```typescript
const response = await fetch(`/api/cases/${caseId}/victim-timeline`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    victimName: 'Sarah Johnson',
    incidentTime: '2024-03-15T23:00:00Z',
    typicalRoutine: 'Works 9-5, gym after work',
    knownHabits: ['Always texts sister when leaving']
  })
});

const { timeline, routineDeviations } = await response.json();
```

Reconstructs victim's last 24-48 hours:
- Complete movement timeline
- Timeline gaps
- Last seen persons
- Routine deviations
- Digital footprint
- Witness validation

---

## Security

### Row Level Security

All file operations respect agency-based permissions:

```sql
-- Users can only see files for their agency's cases
CREATE POLICY "Users can view their agency case documents"
ON case_documents FOR SELECT
USING (
  case_id IN (
    SELECT id FROM cases WHERE agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  )
);
```

### Storage Policies

- Only authenticated users can upload
- Only authenticated users can delete
- Public viewing (through signed URLs)

---

## Performance

### Optimizations

1. **Batch Upload**
   - Upload multiple files in parallel
   - Progress tracking for each file
   - Continue on individual failures

2. **File Size Limits**
   - Supabase default: 50 MB per file
   - Can be increased in Supabase dashboard

3. **Database Indexing**
   - Index on `case_id` for fast queries
   - Index on `document_type` for filtering

---

## Future Enhancements

Potential improvements:

- [ ] File preview (PDF viewer, image thumbnails)
- [ ] OCR for scanned documents
- [ ] Automatic text extraction
- [ ] Bulk download as ZIP
- [ ] Version control for files
- [ ] File sharing with other agencies
- [ ] Advanced search across file contents
- [ ] Audio/video transcription
- [ ] Automatic redaction of sensitive info

---

## Troubleshooting

### Upload Fails

**Issue:** Files won't upload

**Solutions:**
1. Check Supabase storage bucket exists (`case-files`)
2. Run `supabase-storage-setup.sql`
3. Verify environment variables in `.env.local`
4. Check file size limits
5. Ensure user is authenticated

### Files Not Appearing

**Issue:** Uploaded files don't show in list

**Solutions:**
1. Refresh the page
2. Check `case_documents` table in database
3. Verify `case_id` matches
4. Check Row Level Security policies

### Storage Bucket Not Found

**Issue:** "Bucket not found" error

**Solution:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true);
```

---

## Complete Workflow Example

### Scenario: New Homicide Case

**Step 1: Create Case**
- Investigator creates new case in system
- Case ID: `abc-123-def-456`

**Step 2: Upload Evidence**
- Navigate to `/cases/abc-123-def-456/files`
- Upload 15 files:
  - 3 witness statements (PDF)
  - 5 crime scene photos (JPG)
  - 2 forensic reports (PDF)
  - 1 autopsy report (PDF)
  - 2 phone record spreadsheets (CSV)
  - 1 surveillance video (MP4)
  - 1 detective's notes (DOCX)

**Step 3: Categorize**
- System auto-detects most types
- Investigator adds descriptions:
  - "Witness #1 - neighbor who heard gunshots"
  - "Victim's phone records 3/10-3/17"
  - etc.

**Step 4: Upload All**
- Click "Upload All"
- Watch progress: 0% → 100%
- All 15 files successfully uploaded

**Step 5: Run Timeline Analysis**
- Click "Timeline Analysis"
- System reads all 15 files
- Extracts 47 timeline events
- Detects 3 conflicts
- Identifies 8 frequently mentioned persons
- Flags 2 unfollowed tips

**Step 6: Run Victim Timeline**
- Click "Victim Timeline"
- Enter victim name: "Sarah Johnson"
- Enter incident time: "2024-03-15 23:00"
- System reconstructs last 48 hours
- Identifies critical 3-hour gap
- Flags ex-boyfriend as last person seen with victim

**Step 7: Review Analysis**
- Navigate to timeline visualization
- See conflicts highlighted in red
- View victim's last movements
- Read AI-generated insights
- Export prioritized action plan

**Result:** What would take investigators weeks to manually review and cross-reference is completed in minutes with AI assistance.

---

**The file upload system is the critical first step that makes all the AI-powered analysis possible.**
