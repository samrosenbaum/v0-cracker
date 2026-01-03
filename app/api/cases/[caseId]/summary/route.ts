import { NextRequest, NextResponse } from 'next/server';
import { generateCaseSummary, exportSummaryToMarkdown } from '@/lib/case-summary-generator';

type RouteParams = { params: Promise<{ caseId: string }> };

/**
 * POST /api/cases/[caseId]/summary
 * Generate a comprehensive case summary
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { caseId } = await params;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const options = {
      includeFullTimeline: body.includeFullTimeline ?? false,
      includeAllPersons: body.includeAllPersons ?? true,
      generateAIInsights: body.generateAIInsights ?? true,
    };

    console.log(`[API] Generating case summary for: ${caseId}`);

    const summary = await generateCaseSummary(caseId, options);

    return NextResponse.json({
      success: true,
      summary,
      statistics: summary.statistics,
    });

  } catch (error: any) {
    console.error('[API] Case summary generation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Summary generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/[caseId]/summary?format=markdown
 * Get the case summary (optionally as markdown)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // Generate the summary
    const summary = await generateCaseSummary(caseId, {
      includeFullTimeline: true,
      includeAllPersons: true,
      generateAIInsights: true,
    });

    // Return as markdown if requested
    if (format === 'markdown' || format === 'md') {
      const markdown = exportSummaryToMarkdown(summary);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="case-summary-${caseId.slice(0, 8)}.md"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      summary,
    });

  } catch (error: any) {
    console.error('[API] Case summary retrieval failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve summary' },
      { status: 500 }
    );
  }
}
