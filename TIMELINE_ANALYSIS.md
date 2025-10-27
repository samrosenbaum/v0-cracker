# Timeline Analysis & Conflict Detection

FreshEyes includes a powerful AI-powered timeline analysis system that automatically:
- Creates visual timelines from case documents
- Detects time conflicts and inconsistencies
- Identifies overlooked suspects mentioned multiple times
- Flags unfollowed tips and leads
- Provides strategic insights

## Features

### 1. **Automated Timeline Generation**
The system analyzes all case documents and extracts events with:
- Dates and times (or time ranges)
- Locations
- People involved
- Source documents
- Confidence scores

### 2. **Conflict Detection**
Automatically identifies:
- **Time Inconsistencies**: Person reported at two places during overlapping times
- **Statement Contradictions**: Different accounts of the same event
- **Alibi Conflicts**: Alibis that don't match other evidence
- **Location Mismatches**: Conflicting location information

### 3. **Overlooked Suspect Identification**
Tracks people mentioned across documents and calculates a "suspicion score" based on:
- Number of different sources mentioning them
- Context of mentions (negative associations)
- Proximity to the incident
- Inconsistencies in their statements

**Alerts you when someone is mentioned 3+ times by different sources but isn't a formal suspect**

### 4. **Unfollowed Tip Tracking**
Identifies:
- Tips mentioned but no follow-up documented
- Persons of interest mentioned but not interviewed
- Evidence suggested but not collected
- Locations suggested but not searched

## Setup

### Prerequisites
```bash
npm install @anthropic-ai/sdk
```

### Environment Variables
Add to your `.env.local`:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get your API key from: https://console.anthropic.com/

### Database
The timeline system uses these Supabase tables (already created):
- `evidence_events` - Timeline events
- `quality_flags` - Conflicts and inconsistencies
- `case_analysis` - Full analysis results
- `suspects` - Formal suspects list

## Usage

### Running Analysis

**API Endpoint:**
```typescript
POST /api/cases/[caseId]/analyze
```

**Using fetch:**
```typescript
const response = await fetch(`/api/cases/${caseId}/analyze`, {
  method: 'POST',
});

const { analysis } = await response.json();
```

### Response Structure

```typescript
{
  timeline: TimelineEvent[],        // All extracted events
  conflicts: Conflict[],            // Detected conflicts
  personMentions: PersonMention[],  // People mentioned across documents
  unfollowedTips: UnfollowedTip[],  // Tips that weren't followed up
  keyInsights: string[],            // Strategic observations
  suspectAnalysis: {                // Risk assessment for each person
    name: string,
    riskScore: number,
    reasoning: string
  }[],
  overlookedSuspects: PersonMention[], // High-suspicion people not formal suspects
  conflictSummary: string           // Plain text summary
}
```

### Using the Timeline Component

```typescript
import CaseTimeline from '@/components/CaseTimeline';

function CaseAnalysisPage({ caseId }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    // Run analysis
    fetch(`/api/cases/${caseId}/analyze`, { method: 'POST' })
      .then(res => res.json())
      .then(data => setAnalysis(data.analysis));
  }, [caseId]);

  if (!analysis) return <div>Analyzing...</div>;

  return (
    <CaseTimeline
      timeline={analysis.timeline}
      conflicts={analysis.conflicts}
      personMentions={analysis.personMentions}
      unfollowedTips={analysis.unfollowedTips}
      keyInsights={analysis.keyInsights}
    />
  );
}
```

## Example Scenarios

### Scenario 1: Time Conflict Detection

**Interview 1** (Witness A):
> "I saw John at the convenience store between 7-9 PM on March 15th"

**Interview 2** (Witness B):
> "John was at my house from 6-8 PM that same night"

**FreshEyes detects:**
- ⚠️ **TIME INCONSISTENCY** (High Severity)
- Description: "John reported at two different locations during overlapping times"
- Details: "According to Witness A, John was at convenience store at 7 PM. However, Witness B places them at witness's house at 7 PM."
- Recommendation: "Re-interview subject about their whereabouts during this time period"

### Scenario 2: Overlooked Suspect

**Across multiple documents:**
- Witness A mentions: "Mike was acting suspicious that night"
- Witness B mentions: "I saw Mike leaving the area around midnight"
- Anonymous tip: "Check out Mike, he had a motive"
- Officer notes: "Need to follow up with Mike"

**FreshEyes detects:**
- 👤 **FREQUENTLY MENTIONED PERSON**
- Name: Mike
- Mentioned by: 4 different sources
- Suspicion Score: 78%
- Status: NOT a formal suspect
- Recommendation: "Consider adding to suspects list for interview"

### Scenario 3: Unfollowed Tips

**Detective notes from Week 1:**
> "Anonymous caller suggested checking surveillance at gas station on 5th street"

**No follow-up documented in subsequent reports**

**FreshEyes detects:**
- 🚩 **UNFOLLOWED TIP** (High Priority)
- Description: "Surveillance footage from gas station on 5th street"
- Suggested Action: "Obtain and review gas station surveillance"
- Reason: "Tip mentioned in initial notes but no follow-up documented"

## Visual Timeline Features

The timeline visualization includes:

✅ **Chronological Display**: Events organized by date with time markers
✅ **Conflict Highlighting**: Red borders on conflicting events
✅ **Interactive Details**: Click events to see conflicts and details
✅ **Confidence Indicators**: Visual badges showing extraction confidence
✅ **Person Tracking**: See all people involved in each event
✅ **Location Markers**: Geographic information for each event
✅ **Source Attribution**: Links back to original documents

## Conflict Severity Levels

- 🔴 **Critical**: Major contradiction that could compromise the case
- 🟠 **High**: Significant inconsistency requiring immediate follow-up
- 🟡 **Medium**: Notable discrepancy worth investigating
- 🔵 **Low**: Minor inconsistency, may be explainable

## Tips for Best Results

1. **Upload comprehensive documents**: More context = better analysis
2. **Include timestamps**: The more specific the time information, the better conflict detection works
3. **Name consistency**: Try to use consistent names (AI handles some variations)
4. **Document types**: Works with interviews, witness statements, police reports, forensic reports, tips
5. **Re-run after updates**: Run analysis again when new documents are added

## Limitations

- Requires clear date/time information in documents for timeline extraction
- Name matching may miss some variations (e.g., "Michael" vs "Mike")
- Confidence scores are estimates based on document clarity
- Works best with English text

## Future Enhancements

- [ ] Photo/video timeline integration
- [ ] Geographic map view
- [ ] Relationship graph visualization
- [ ] Voice transcription support
- [ ] Multi-language support
- [ ] Export timeline to PDF/Excel
- [ ] Real-time collaboration features

## Support

For issues or questions about timeline analysis:
1. Check the analysis confidence scores
2. Review source documents for clarity
3. Re-run analysis after document corrections
4. Open an issue on GitHub

## Technical Details

### AI Model
- **Provider**: Anthropic Claude
- **Model**: claude-3-5-sonnet-20241022
- **Context Window**: 200K tokens
- **Output**: Structured JSON

### Conflict Detection Algorithm
The system uses multiple detection methods:
1. **Time Overlap Detection**: Parses time ranges and checks for overlaps
2. **Semantic Analysis**: AI understands contradictions in statements
3. **Entity Resolution**: Tracks same people/places across documents
4. **Pattern Matching**: Identifies common inconsistency patterns

### Performance
- Analysis time: ~30-60 seconds for typical case (10-20 documents)
- Scales to hundreds of documents
- Results cached in database for fast retrieval
- Incremental updates when new documents added
