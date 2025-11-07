# Testing Checklist for Document Chunking & Processing Dashboard

## ✅ Pre-Flight Checks

### Environment Setup
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in `.env.local`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`
- [ ] `OPENAI_API_KEY` set in `.env.local`
- [ ] Database migration run successfully in Supabase
- [ ] pgvector extension enabled
- [ ] Tables `processing_jobs` and `document_chunks` exist
- [ ] SQL functions created (search_document_chunks, get_processing_job_stats, get_case_chunks_summary)

### Development Server
- [ ] Run `npm install` to ensure all dependencies installed
- [ ] Start Next.js: `npm run dev`
- [ ] Start Inngest Dev Server: `npx inngest-cli dev`
- [ ] Inngest UI accessible at `http://localhost:8288`
- [ ] App accessible at `http://localhost:3000`

---

## 📦 Phase 1 Testing: Document Chunking Backend

### API Routes
- [ ] `GET /api/documents/trigger-chunking` returns enabled status
- [ ] `POST /api/documents/trigger-chunking` accepts file upload trigger
- [ ] `GET /api/processing-jobs/[jobId]` returns job details
- [ ] `GET /api/cases/[caseId]/processing-jobs` returns jobs list
- [ ] `POST /api/processing-jobs/[jobId]/retry` retries failed chunks
- [ ] `GET /api/processing-jobs/[jobId]/chunks` returns chunk list

### Database Operations
```sql
-- Test database functions
SELECT * FROM processing_jobs;
SELECT * FROM document_chunks;
SELECT * FROM get_processing_job_stats('job-id-here');
SELECT * FROM get_case_chunks_summary('case-id-here');
```

- [ ] Can insert processing_jobs records
- [ ] Can insert document_chunks records
- [ ] Functions return expected results
- [ ] RLS policies allow access for authenticated users

### Inngest Jobs
- [ ] `chunkDocumentJob` appears in Inngest UI
- [ ] `processChunkJob` appears in Inngest UI
- [ ] `aggregateDocumentJob` appears in Inngest UI
- [ ] `generateEmbeddingsJob` appears in Inngest UI
- [ ] Jobs can be triggered manually in Inngest UI

---

## 🎨 Phase 2 Testing: UI Dashboard

### Page Access
- [ ] `/cases/[caseId]/processing` page loads without errors
- [ ] Dashboard displays loading state initially
- [ ] Dashboard shows "No processing jobs" when empty

### Components Render
- [ ] `ProcessingDashboard` component renders
- [ ] `ProcessingJobCard` components render for each job
- [ ] `ChunkDetailsModal` opens when "View Chunks" clicked
- [ ] Filter tabs (All/Active/Completed/Failed) display correctly
- [ ] Statistics cards show correct numbers

### Real-Time Updates
- [ ] Dashboard auto-refreshes every 3 seconds for active jobs
- [ ] Progress bars update in real-time
- [ ] Statistics update automatically
- [ ] Refresh stops when no active jobs
- [ ] Manual refresh button works

### Job Card Features
- [ ] Status icons display correctly (green/red/blue/yellow)
- [ ] Progress bar shows correct percentage
- [ ] Statistics show completed/pending/failed counts
- [ ] Expandable details work (click chevron)
- [ ] Timestamps formatted correctly
- [ ] Duration calculated correctly
- [ ] Retry button appears for failed jobs
- [ ] View Chunks button appears when chunks exist

### Chunk Details Modal
- [ ] Modal opens on "View Chunks" click
- [ ] Modal displays all chunks for the job
- [ ] Filter tabs work (all/completed/failed/pending)
- [ ] Chunk metadata displays (page number, confidence, method)
- [ ] Content preview toggle works
- [ ] Error logs display for failed chunks
- [ ] Close button closes modal

### Retry Functionality
- [ ] Retry button triggers API call
- [ ] Toast notification shows on retry
- [ ] Dashboard refreshes after retry
- [ ] Failed chunks reset to pending
- [ ] Inngest jobs re-triggered

---

## 🔄 End-to-End Testing

### Upload to Processing Flow

#### Test 1: Single PDF Upload
1. [ ] Navigate to a case
2. [ ] Upload a small PDF (1-5 pages)
3. [ ] Document upload succeeds
4. [ ] Chunking job triggered automatically
5. [ ] Navigate to `/cases/[caseId]/processing`
6. [ ] Processing job appears in dashboard
7. [ ] Job status shows "Running"
8. [ ] Progress bar updates from 0% → 100%
9. [ ] Check Inngest UI - see chunk processing jobs
10. [ ] All chunks complete successfully
11. [ ] Job status changes to "Completed"
12. [ ] Statistics update correctly

#### Test 2: Image Upload (OCR)
1. [ ] Upload an image file (JPG/PNG)
2. [ ] Chunking triggered (single chunk for image)
3. [ ] Processing job appears
4. [ ] OCR extraction completes
5. [ ] Check chunk content contains extracted text
6. [ ] Confidence score displayed

#### Test 3: Multiple Documents
1. [ ] Upload 3-5 documents simultaneously
2. [ ] Multiple processing jobs created
3. [ ] All jobs visible in dashboard
4. [ ] Jobs process in parallel
5. [ ] Statistics aggregate correctly

#### Test 4: Large PDF (10+ pages)
1. [ ] Upload a larger PDF
2. [ ] Verify chunks created (one per page)
3. [ ] Watch parallel processing (50 concurrent!)
4. [ ] Progress updates smoothly
5. [ ] All pages extracted
6. [ ] View chunks to verify each page

### Error Handling

#### Test 5: Network Failure Simulation
1. [ ] Start document upload
2. [ ] Simulate network issue (stop Inngest?)
3. [ ] Verify failed chunks tracked
4. [ ] Click retry button
5. [ ] Verify chunks reprocess
6. [ ] Check error logs in chunk details

#### Test 6: Invalid File Upload
1. [ ] Upload unsupported file type
2. [ ] Check how system handles it
3. [ ] Verify error messages

#### Test 7: Missing OpenAI Key
1. [ ] Temporarily remove `OPENAI_API_KEY`
2. [ ] Upload document
3. [ ] Verify embedding generation fails gracefully
4. [ ] Check error logs

---

## 🐛 Debugging Checklist

### If Jobs Don't Appear
- [ ] Check browser console for errors
- [ ] Verify API route responses (Network tab)
- [ ] Check Supabase logs
- [ ] Verify database connection
- [ ] Check RLS policies (use service role key in API routes)

### If Chunking Doesn't Start
- [ ] Check Inngest Dev Server is running
- [ ] Verify `/api/inngest` route accessible
- [ ] Check Inngest UI for error messages
- [ ] Verify event was sent (check server logs)
- [ ] Check `processing_jobs` table has records

### If Chunks Don't Process
- [ ] Check Inngest UI for job execution
- [ ] Look for error messages in job logs
- [ ] Verify storage paths are correct
- [ ] Check file permissions in Supabase Storage
- [ ] Verify `case_files` table has valid storage_path

### If Dashboard Doesn't Update
- [ ] Check auto-refresh is enabled
- [ ] Verify API routes return data
- [ ] Check browser console for errors
- [ ] Try manual refresh
- [ ] Verify job status in database directly

---

## 📊 Performance Testing

### Concurrency Test
- [ ] Upload 20+ documents at once
- [ ] Verify 50 concurrent workers active (check Inngest UI)
- [ ] Monitor system resources
- [ ] Verify all complete successfully
- [ ] Check processing time vs. expected

### Large Document Test
- [ ] Upload 100+ page PDF
- [ ] Verify 100 chunks created
- [ ] Monitor progress in real-time
- [ ] Verify completion time (~2-3 min for 100 pages)
- [ ] Check memory usage

### Database Performance
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM document_chunks WHERE processing_job_id = 'test-id';
EXPLAIN ANALYZE SELECT * FROM processing_jobs WHERE case_id = 'test-id';
```

- [ ] Queries execute quickly (<100ms)
- [ ] Indexes being used
- [ ] No table scans on large datasets

---

## 🔒 Security Testing

### Authentication
- [ ] Logged-out users redirected
- [ ] RLS policies enforce agency boundaries
- [ ] Users can only see their agency's jobs
- [ ] Service role key bypasses RLS in API routes

### Data Integrity
- [ ] Chunks cannot be created for other agencies' files
- [ ] Jobs cannot be accessed cross-agency
- [ ] Retry only works for user's own jobs

---

## 📈 Success Criteria

### Functional
- ✅ Documents upload and trigger processing automatically
- ✅ Chunks created based on file type (pages for PDF, single for images)
- ✅ Parallel processing works (50 concurrent workers)
- ✅ Real-time dashboard updates every 3 seconds
- ✅ Failed chunks can be retried with one click
- ✅ Chunk details viewable with metadata and content
- ✅ Statistics accurate and update in real-time

### Performance
- ✅ 1,000 pages process in <15 minutes
- ✅ Dashboard remains responsive with 10+ active jobs
- ✅ API responses <500ms
- ✅ Database queries <100ms

### Reliability
- ✅ No data loss (all chunks tracked)
- ✅ Failed chunks properly logged with errors
- ✅ Retry mechanism works without duplicates
- ✅ System handles network failures gracefully

---

## 🎯 Quick Smoke Test (5 minutes)

1. **Start servers**
   ```bash
   npm run dev
   npx inngest-cli dev
   ```

2. **Upload a document**
   - Go to a case
   - Upload a small PDF (2-3 pages)

3. **Check processing**
   - Navigate to `/cases/[caseId]/processing`
   - See job appear
   - Watch progress bar update
   - Verify completion

4. **View details**
   - Click "View Chunks"
   - See 2-3 chunks (one per page)
   - Check content preview
   - Verify metadata

5. **Test retry** (if any chunks failed)
   - Click retry button
   - See toast notification
   - Watch chunks reprocess

**If all 5 steps work: ✅ System is functional!**

---

## 📝 Known Issues / Limitations

### Current Limitations
- Scanned PDFs not fully OCR'd (need pdf-poppler)
- Handwriting recognition moderate quality
- Word documents (.docx) not yet implemented
- Embedding generation requires OpenAI API key
- Max 50 concurrent workers (configurable)

### TypeScript Warnings
- Some type mismatches in document-chunker.ts (non-blocking)
- Database type definitions may need regeneration after schema changes
- Using `as any` in some places for flexibility

### Browser Compatibility
- Tested in Chrome/Firefox/Edge
- Real-time updates require modern browser
- Modal requires JavaScript enabled

---

## 🚀 Next Steps After Testing

If all tests pass:
1. **Production Deployment**
   - Set up Inngest Cloud account
   - Configure environment variables
   - Deploy to Vercel/similar
   - Test in production environment

2. **Monitoring Setup**
   - Set up error tracking (Sentry?)
   - Monitor job success rates
   - Track processing times
   - Set up alerts for failures

3. **Phase 3 Features**
   - Semantic search interface
   - Map-reduce AI analysis
   - Advanced handwriting recognition
   - Priority queuing
   - Webhook notifications

---

## 📞 Need Help?

### Debugging Tools
- **Inngest UI**: `http://localhost:8288` - View all jobs and execution logs
- **Supabase Dashboard**: Check database tables and logs
- **Browser DevTools**: Network tab for API calls, Console for errors
- **Server Logs**: Check terminal running `npm run dev`

### Common Fixes
- **Jobs not running**: Restart Inngest Dev Server
- **Database errors**: Check service role key is set
- **Type errors**: Run `npm install` again
- **API timeouts**: Increase timeout in Next.js config

---

**Testing Version**: Phase 1 + Phase 2
**Last Updated**: November 2024
**Status**: Ready for Testing! 🎉
