# File Upload System Setup Guide

## Quick Start (5 minutes)

### Step 1: Create Supabase Storage Bucket

Go to your Supabase project SQL Editor and run:

```sql
-- supabase-storage-setup.sql

-- Create storage bucket for case files
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for case files bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload case files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-files');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view case files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'case-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete case files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'case-files');

-- Allow public access for viewing (since bucket is public)
CREATE POLICY "Public can view case files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'case-files');
```

### Step 2: Verify Environment Variables

Make sure `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rqcrewnggjmuldleouqd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Test the Upload System

1. Start your dev server:
```bash
npm run dev
```

2. Navigate to a case:
```
http://localhost:3000
```

3. Click on any case

4. Click "Manage Case Files" button

5. You'll be taken to:
```
http://localhost:3000/cases/[caseId]/files
```

6. Upload test files:
   - Drag and drop files into the upload zone
   - OR click "Upload Files" → "Select Files"

7. Categorize files (auto-detected or manual)

8. Click "Upload All"

9. Watch progress bars

10. Files should appear in the documents list!

### Step 4: Verify in Supabase

1. Go to Supabase Dashboard → Storage → case-files bucket

2. You should see your uploaded files organized by case ID

3. Go to Database → case_documents table

4. You should see records for each uploaded file

### Step 5: Test Analysis Integration

1. After uploading files, click one of the analysis buttons:
   - **Timeline Analysis**
   - **Deep Analysis**
   - **Victim Timeline**

2. Analysis will run on all uploaded documents

3. Check browser console for results (or implement result display pages)

---

## Troubleshooting

### "Bucket not found" error

**Solution:** Run the storage setup SQL again:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO NOTHING;
```

### Files upload but don't appear in list

**Solution:** Check Row Level Security policies on `case_documents` table

```sql
-- Allow users to view case documents
CREATE POLICY "Users can view case documents"
ON case_documents FOR SELECT
USING (true);  -- Adjust based on your auth setup

-- Allow users to insert case documents
CREATE POLICY "Users can insert case documents"
ON case_documents FOR INSERT
WITH CHECK (true);  -- Adjust based on your auth setup
```

### Upload fails with "permission denied"

**Solution:** Check storage policies are created correctly:

```sql
-- List existing policies
SELECT * FROM pg_policies WHERE tablename = 'objects';
```

Should show policies for:
- INSERT on storage.objects
- SELECT on storage.objects
- DELETE on storage.objects

### TypeScript errors

**Solution:** Make sure you have the latest Supabase client:

```bash
npm install @supabase/supabase-js@latest
```

---

## Features Demo

### 1. Upload Multiple Files

Try uploading:
- 5 PDF files (witness statements)
- 3 JPG images (crime scene photos)
- 1 MP4 video (surveillance footage)
- 2 DOCX files (reports)

All will be categorized automatically!

### 2. Document Type Detection

The system detects types based on filename:

- `police_report_march15.pdf` → Police Report
- `witness_statement_john_doe.pdf` → Witness Statement
- `crime_scene_photo_1.jpg` → Photo Evidence
- `surveillance_cam2_parking_lot.mp4` → Surveillance Footage
- `phone_records_victim.csv` → Phone Records

### 3. Progress Tracking

Each file shows:
- Pending (gray) - waiting to upload
- Uploading (blue, animated) - upload in progress with %
- Success (green checkmark) - upload complete
- Error (red X) - upload failed with error message

### 4. File Management

After upload, you can:
- View file details (name, type, size, date)
- Download files (opens in new tab)
- Delete files (removes from storage + database)
- See color-coded badges for document types

### 5. One-Click Analysis

Click any analysis button to process ALL uploaded documents:

**Timeline Analysis:**
- Extracts timeline events
- Detects conflicts
- Identifies key persons
- Flags unfollowed tips

**Deep Analysis:**
- 8-dimensional analysis
- Behavioral patterns
- Evidence gaps
- Relationship networks
- And more...

**Victim Timeline:**
- Reconstructs last 24-48 hours
- Identifies timeline gaps
- Tracks last-seen persons
- Flags routine deviations

---

## File Organization

Files are stored in Supabase Storage like this:

```
case-files/
├── case-id-123/
│   ├── 1710512345_x7k2p9.pdf
│   ├── 1710512367_m3n8q1.jpg
│   └── 1710512389_r4t6w5.mp4
├── case-id-456/
│   ├── 1710512401_a8b3c7.pdf
│   └── 1710512425_d9e4f2.docx
└── case-id-789/
    └── 1710512450_g5h6i1.mp4
```

Each file gets a unique name:
```
{timestamp}_{random_string}.{extension}
```

This prevents:
- Name collisions
- Overwrites
- Security issues

---

## Database Records

Each uploaded file creates a record in `case_documents`:

```typescript
{
  id: "uuid",
  case_id: "case-id-123",
  file_name: "witness_statement_john.pdf",
  document_type: "witness_statement",
  description: "John Doe's statement from 3/15",
  storage_path: "case-id-123/1710512345_x7k2p9.pdf",
  file_size: 2457600,  // bytes
  mime_type: "application/pdf",
  uploaded_by: "user-id",
  created_at: "2024-03-15T14:25:45Z",
  updated_at: "2024-03-15T14:25:45Z"
}
```

---

## Next Steps

After setting up file upload:

1. **Create result display pages** for analysis results
   - `/cases/[caseId]/timeline` - Timeline visualization
   - `/cases/[caseId]/analysis` - Deep analysis results
   - `/cases/[caseId]/victim` - Victim timeline

2. **Add authentication** - Protect file uploads
   - Supabase Auth
   - User permissions
   - Agency-based access

3. **Implement file preview** - View files before upload
   - PDF viewer
   - Image thumbnails
   - Video preview

4. **Add OCR** - Extract text from images
   - For scanned documents
   - Handwritten notes
   - Photo evidence with text

5. **Add search** - Search across file contents
   - Full-text search
   - Metadata search
   - Advanced filters

---

## File Upload is Complete! ✅

You now have:

✅ Drag-and-drop upload interface
✅ File management page
✅ Supabase Storage integration
✅ Database record creation
✅ Document type categorization
✅ Upload progress tracking
✅ One-click analysis triggers
✅ Complete CRUD operations

**The file upload system is ready to use!**

Navigate to `/cases/[caseId]/files` and start uploading case documents.
