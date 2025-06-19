// lib/qualityControl.ts
export interface QualityFlag {
    id: string;
    analysis_id: string;
    case_id: string;
    type: 'low_confidence' | 'no_suspects' | 'missing_data' | 'inconsistency' | 'incomplete_analysis';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    recommendation: string;
    affected_findings: string[];
    status: 'active' | 'reviewed' | 'resolved' | 'dismissed';
    created_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    resolution_notes?: string;
  }
  
  export class QualityControlAnalyzer {
    static analyzeResults(analysisData: any, analysisId: string, caseId: string): QualityFlag[] {
      const flags: QualityFlag[] = [];
      const timestamp = new Date().toISOString();
  
      // 1. Check confidence scores
      if (analysisData.findings) {
        const lowConfidenceFindings = analysisData.findings.filter((f: any) => 
          f.confidenceScore && f.confidenceScore < 60
        );
  
        if (lowConfidenceFindings.length > 0) {
          const averageConfidence = lowConfidenceFindings.reduce((sum: number, f: any) => 
            sum + (f.confidenceScore || 0), 0) / lowConfidenceFindings.length;
  
          flags.push({
            id: `low-confidence-${analysisId}`,
            analysis_id: analysisId,
            case_id: caseId,
            type: 'low_confidence',
            severity: averageConfidence < 40 ? 'critical' : averageConfidence < 50 ? 'high' : 'medium',
            title: 'Low Confidence Findings Detected',
            description: `${lowConfidenceFindings.length} findings have confidence scores below 60% (average: ${Math.round(averageConfidence)}%)`,
            recommendation: 'Review these findings manually, gather additional evidence, or consider re-running analysis with more data',
            affected_findings: lowConfidenceFindings.map((f: any) => f.title || f.id),
            status: 'active',
            created_at: timestamp
          });
        }
      }
  
      // 2. Check for missing suspects
      if (!analysisData.suspects || analysisData.suspects.length === 0) {
        flags.push({
          id: `no-suspects-${analysisId}`,
          analysis_id: analysisId,
          case_id: caseId,
          type: 'no_suspects',
          severity: 'high',
          title: 'No Suspects Identified',
          description: 'Analysis completed without identifying any persons of interest',
          recommendation: 'Review case materials for overlooked individuals, expand data sources, or check if analysis prompt needs refinement',
          affected_findings: ['Suspect Analysis'],
          status: 'active',
          created_at: timestamp
        });
      }
  
      // 3. Check for missing critical findings
      const hasFindings = analysisData.findings && analysisData.findings.length > 0;
      const hasConnections = analysisData.connections && analysisData.connections.length > 0;
      const hasRecommendations = analysisData.recommendations && analysisData.recommendations.length > 0;
  
      if (!hasFindings) {
        flags.push({
          id: `no-findings-${analysisId}`,
          analysis_id: analysisId,
          case_id: caseId,
          type: 'missing_data',
          severity: 'high',
          title: 'No Key Findings Identified',
          description: 'Analysis did not produce any key findings or discoveries',
          recommendation: 'Check input quality, verify file readability, or consider adjusting analysis parameters',
          affected_findings: ['Analysis Output'],
          status: 'active',
          created_at: timestamp
        });
      }
  
      // 4. Check for inconsistencies
      if (analysisData.findings && analysisData.findings.length > 2) {
        const contradictoryFindings = this.detectContradictions(analysisData.findings);
        if (contradictoryFindings.length > 0) {
          flags.push({
            id: `inconsistency-${analysisId}`,
            analysis_id: analysisId,
            case_id: caseId,
            type: 'inconsistency',
            severity: 'medium',
            title: 'Contradictory Findings Detected',
            description: `Found ${contradictoryFindings.length} potentially contradictory findings that may need reconciliation`,
            recommendation: 'Review flagged findings for conflicts and determine which information is more reliable',
            affected_findings: contradictoryFindings,
            status: 'active',
            created_at: timestamp
          });
        }
      }
  
      // 5. Check for incomplete analysis
      const analysisCompleteness = this.calculateCompleteness(analysisData);
      if (analysisCompleteness < 70) {
        flags.push({
          id: `incomplete-${analysisId}`,
          analysis_id: analysisId,
          case_id: caseId,
          type: 'incomplete_analysis',
          severity: analysisCompleteness < 50 ? 'critical' : 'high',
          title: 'Incomplete Analysis Detected',
          description: `Analysis appears incomplete (${analysisCompleteness}% complete). Missing key components.`,
          recommendation: 'Re-run analysis with complete data set or review input files for quality issues',
          affected_findings: ['Overall Analysis'],
          status: 'active',
          created_at: timestamp
        });
      }
  
      return flags;
    }
  
    private static detectContradictions(findings: any[]): string[] {
      const contradictions: string[] = [];
      
      // Simple contradiction detection - this could be much more sophisticated
      const timelineFindings = findings.filter(f => f.category === 'timeline');
      
      // Check for timeline conflicts (simplified)
      if (timelineFindings.length > 1) {
        const lowConfidenceTimeline = timelineFindings.filter(f => f.confidenceScore < 70);
        if (lowConfidenceTimeline.length > 1) {
          contradictions.push(...lowConfidenceTimeline.map(f => f.title || f.id));
        }
      }
  
      // Check for conflicting suspect information
      const suspectFindings = findings.filter(f => 
        f.category === 'suspect' || f.description.toLowerCase().includes('suspect')
      );
      
      if (suspectFindings.length > 1) {
        const conflictingSuspects = suspectFindings.filter(f => f.confidenceScore < 60);
        if (conflictingSuspects.length > 0) {
          contradictions.push(...conflictingSuspects.map(f => f.title || f.id));
        }
      }
  
      return contradictions;
    }
  
    private static calculateCompleteness(analysisData: any): number {
      let score = 0;
  
      // Basic completeness scoring
      if (analysisData.suspects && analysisData.suspects.length > 0) score += 25;
      if (analysisData.findings && analysisData.findings.length > 0) score += 25;
      if (analysisData.connections && analysisData.connections.length > 0) score += 20;
      if (analysisData.recommendations && analysisData.recommendations.length > 0) score += 15;
      if (analysisData.overlookedLeads && analysisData.overlookedLeads.length > 0) score += 15;
  
      return score;
    }
  
    static async storeQualityFlags(flags: QualityFlag[], supabase: any): Promise<boolean> {
      if (flags.length === 0) {
        console.log('No quality flags to store');
        return true;
      }
  
      try {
        const { error } = await supabase
          .from('quality_flags')
          .insert(flags);
  
        if (error) {
          console.error('Error storing quality flags:', error);
          return false;
        } else {
          console.log(`✅ Stored ${flags.length} quality flags`);
          return true;
        }
      } catch (error) {
        console.error('Exception storing quality flags:', error);
        return false;
      }
    }
  
    // Helper method to get quality summary for dashboard
    static getQualitySummary(flags: QualityFlag[]) {
      return {
        totalFlags: flags.length,
        criticalFlags: flags.filter(f => f.severity === 'critical').length,
        highFlags: flags.filter(f => f.severity === 'high').length,
        activeFlags: flags.filter(f => f.status === 'active').length,
        needsAttention: flags.some(f => 
          (f.severity === 'critical' || f.severity === 'high') && f.status === 'active'
        ),
        overallScore: Math.max(0, 100 - (flags.length * 10)) // Simple scoring
      };
    }
  }