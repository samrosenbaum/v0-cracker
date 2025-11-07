# Semantic Search Implementation Guide

## Overview

The semantic search system allows investigators to search across all case documents using natural language queries. The system understands context and meaning, not just keyword matching.

## How It Works

1. **Document Upload**: When PDFs or documents are uploaded, they're chunked into pages or sections
2. **Embedding Generation**: Each chunk gets converted into a 1536-dimension vector using OpenAI's `text-embedding-3-small` model
3. **Vector Storage**: Embeddings are stored in PostgreSQL using the `pgvector` extension
4. **Search**: User queries are converted to embeddings and compared against all document chunks using cosine similarity
5. **Results**: Matching chunks are ranked by similarity and displayed with context

## Accessing Semantic Search

### Option 1: Direct URL
Navigate to: `/cases/[your-case-id]/search`

Example: `http://localhost:3000/cases/123e4567-e89b-12d3-a456-426614174000/search`

### Option 2: Add Navigation Link
Add a search button to your case detail page or navigation menu.

## Testing the Search

### Prerequisites
1. ✅ Database migration applied (`supabase-document-chunking-migration-clean.sql`)
2. ✅ Documents uploaded to a case
3. ✅ Documents processed (embeddings generated)
4. ⚙️ OpenAI API key configured in `.env.local`

### Quick Test Steps

1. **Upload Test Documents** (if not done already):
   - Go to any case page
   - Upload a PDF document (police report, witness statement, etc.)
   - Wait for processing to complete (check Processing Dashboard)

2. **Access Search Page**:
   ```
   http://localhost:3000/cases/[your-case-id]/search
   ```

3. **Try Example Queries**:
   - "blue sedan" - Find vehicle descriptions
   - "witness statements" - Locate witness testimonies
   - "weapon description" - Find mentions of weapons
   - "suspect alibi" - Search for alibi information
   - "timeline 2-4 PM" - Time-specific searches
   - "What did the witness see?" - Natural language questions

4. **Adjust Settings**:
   - **Similarity Threshold**: Lower = more results (less precise), Higher = fewer results (more precise)
   - **Maximum Results**: Control how many chunks to return (5-50)

## API Endpoint

```typescript
POST /api/cases/[caseId]/search

Request Body:
{
  "query": "blue sedan near 5th street",
  "matchThreshold": 0.7,      // Optional: 0.5-0.95 (default: 0.7)
  "matchCount": 20,            // Optional: 5-50 (default: 20)
  "fileFilter": null           // Optional: filter by specific file ID
}

Response:
{
  "success": true,
  "query": "blue sedan near 5th street",
  "results": [
    {
      "id": "chunk-uuid",
      "case_file_id": "file-uuid",
      "chunk_index": 3,
      "chunk_type": "page",
      "content": "...chunk text content...",
      "metadata": { pageNumber: 5, totalPages: 12 },
      "similarity": 0.87,
      "similarity_percentage": "87.0",
      "file_name": "police-report.pdf",
      "page_number": 5
    },
    ...
  ],
  "count": 15,
  "threshold": 0.7
}
```

## Features

### 1. Natural Language Understanding
The system understands semantic meaning, not just keywords:
- "What did the suspect wear?" matches "clothing description" and "dressed in blue jeans"
- "Where was the victim last seen?" matches location and timeline mentions

### 2. Intelligent Highlighting
Search terms are highlighted in results, even if not exact matches.

### 3. Context Snippets
Shows relevant excerpt with intelligent positioning:
- Finds the best match within the chunk
- Shows surrounding context
- Adds ellipsis for longer content

### 4. Expandable Results
Click to expand and see the full chunk content.

### 5. Metadata Display
Shows:
- File name and page number
- Chunk type (page, section, etc.)
- Extraction method used
- Similarity percentage with color coding:
  - 🟢 Green (>85%): Excellent match
  - 🔵 Blue (>75%): Good match
  - ⚫ Gray (<75%): Acceptable match

## Troubleshooting

### No Results Found

**Issue**: Search returns 0 results

**Solutions**:
1. **Lower the threshold**: Try 0.5 instead of 0.7
2. **Check embeddings**: Run this SQL to verify embeddings exist:
   ```sql
   SELECT COUNT(*) FROM document_chunks
   WHERE content_embedding IS NOT NULL
   AND case_file_id IN (SELECT id FROM case_files WHERE case_id = '[your-case-id]');
   ```
3. **Check processing status**:
   ```sql
   SELECT processing_status, COUNT(*)
   FROM document_chunks
   GROUP BY processing_status;
   ```
4. **Verify documents processed**: Check the Processing Dashboard

### Slow Search

**Issue**: Search takes >5 seconds

**Solutions**:
1. **Check index**: Ensure IVFFlat index exists:
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'document_chunks';
   ```
2. **Rebuild index** if needed:
   ```sql
   DROP INDEX IF EXISTS document_chunks_embedding_idx;
   CREATE INDEX document_chunks_embedding_idx
   ON document_chunks
   USING ivfflat (content_embedding vector_cosine_ops)
   WITH (lists = 100);
   ```

### Empty Chunks

**Issue**: Results show empty content

**Solutions**:
1. **Check extraction**: Verify chunks have content:
   ```sql
   SELECT id, LENGTH(content), processing_status, error_message
   FROM document_chunks
   WHERE LENGTH(content) = 0;
   ```
2. **Retry failed chunks**: Use the Processing Dashboard retry button

### API Errors

**Issue**: "Failed to generate embedding"

**Solutions**:
1. **Verify OpenAI API key**: Check `.env.local` has `OPENAI_API_KEY`
2. **Check API quota**: Ensure OpenAI account has available credits
3. **Test API key**:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

## Performance Metrics

### Expected Performance
- **Query Time**: <1 second for databases with <100,000 chunks
- **Embedding Generation**: ~50ms per query
- **Database Search**: ~100-500ms depending on chunk count
- **Result Enhancement**: ~10-50ms per result

### Optimization Tips
1. **Use specific queries**: "blue Honda Civic" vs "car"
2. **Adjust threshold**: Higher threshold = faster (fewer results to process)
3. **Limit results**: Use 10-20 for most searches instead of 50
4. **File filtering**: Search within specific documents when possible

## Integration Examples

### Adding Search Link to Case Page

```typescript
// In your case detail page
import Link from 'next/link';
import { Search } from 'lucide-react';

<Link
  href={`/cases/${caseId}/search`}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  <Search className="w-4 h-4" />
  Search Documents
</Link>
```

### Programmatic Search

```typescript
// From any component
async function searchDocuments(caseId: string, query: string) {
  const response = await fetch(`/api/cases/${caseId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      matchThreshold: 0.7,
      matchCount: 20,
    }),
  });

  const data = await response.json();
  return data.results;
}
```

## Next Steps

After testing semantic search, you can implement:

1. **Save Search Queries**: Save frequently used searches
2. **Search History**: Track what investigators have searched
3. **Advanced Filters**: Filter by date, file type, confidence score
4. **Export Results**: Export search results to CSV/PDF
5. **Bulk Actions**: Tag or annotate multiple search results at once
6. **Alert System**: Get notified when new documents match saved searches

## Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for API errors
3. Verify database connection
4. Ensure Inngest is running (for document processing)
5. Check Supabase dashboard for table/index status
