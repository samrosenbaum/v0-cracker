/**
 * API Route: Semantic Search Across Documents
 *
 * POST /api/cases/[caseId]/search
 *
 * Searches across all document chunks using vector similarity.
 * Enables natural language queries like:
 * - "Find mentions of blue sedan"
 * - "Who saw the victim last?"
 * - "Weapon descriptions"
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseServer } from '@/lib/supabase-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    const body = await request.json();
    const {
      query,
      matchThreshold = 0.7,
      matchCount = 20,
      fileFilter = null,
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    console.log(`[Semantic Search] Query: "${query}" for case: ${caseId}`);

    // Step 1: Generate embedding for search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Search using vector similarity
    const { data: results, error } = await supabaseServer.rpc('search_document_chunks', {
      query_embedding: queryEmbedding as any,
      match_threshold: matchThreshold,
      match_count: matchCount,
      case_id_filter: caseId,
      case_file_id_filter: fileFilter,
    });

    if (error) {
      console.error('[Semantic Search] Database error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    // Step 3: Enhance results with file information
    const enhancedResults = await Promise.all(
      (results || []).map(async (result: any) => {
        // Get file name from case_files
        const { data: fileInfo } = await supabaseServer
          .from('case_files')
          .select('file_name, storage_path')
          .eq('id', result.case_file_id)
          .single();

        // Get file name from case_documents (fallback)
        let fileName = fileInfo?.file_name || 'Unknown file';
        if (!fileInfo) {
          const { data: docInfo } = await supabaseServer
            .from('case_documents')
            .select('file_name')
            .eq('id', result.case_file_id)
            .single();
          fileName = docInfo?.file_name || 'Unknown file';
        }

        return {
          ...result,
          file_name: fileName,
          page_number: result.metadata?.pageNumber || result.chunk_index,
          similarity_percentage: (result.similarity * 100).toFixed(1),
        };
      })
    );

    // Step 4: Sort by similarity (highest first)
    enhancedResults.sort((a, b) => b.similarity - a.similarity);

    console.log(`[Semantic Search] Found ${enhancedResults.length} results`);

    return NextResponse.json({
      success: true,
      query,
      results: enhancedResults,
      count: enhancedResults.length,
      threshold: matchThreshold,
    });
  } catch (error: any) {
    console.error('[Semantic Search] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Search failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
