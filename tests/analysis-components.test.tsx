import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BehavioralPatternsView from '@/components/analysis/BehavioralPatternsView';
import EvidenceGapsView from '@/components/analysis/EvidenceGapsView';
import RelationshipNetworkView from '@/components/analysis/RelationshipNetworkView';
import type {
  BehaviorPattern,
  EvidenceGap,
  RelationshipNetworkAnalysis,
} from '@/lib/cold-case-analyzer';

function assertIncludes(haystack: string, needle: string, message: string) {
  assert.ok(haystack.includes(needle), message);
}

function assertNotIncludes(haystack: string, needle: string, message: string) {
  assert.ok(!haystack.includes(needle), message);
}

(() => {
  const data: BehaviorPattern[] = [
    {
      personName: 'placeholder:Witness Alpha',
      patterns: [
        {
          type: 'evasion',
          description: 'Avoided sharing specifics about the drive home.',
          examples: ['I just kind of went straight home, I guess.'],
          suspicionLevel: 0.74,
          psychologicalNote: 'Hesitation suggests memory management.',
        },
      ],
      overallAssessment: 'Unknown',
      recommendedFollowUp: ['placeholder:follow-up', 'Press for route verification'],
    },
  ];

  const html = renderToStaticMarkup(<BehavioralPatternsView patterns={data} />);
  assertIncludes(html, 'Unnamed interviewee', 'fallback label should show for placeholder names');
  assertIncludes(html, 'Press for route verification', 'non-placeholder follow-up remains visible');
  assertNotIncludes(html, 'placeholder:Witness Alpha', 'placeholder text should be filtered out');
})();

(() => {
  const gaps: EvidenceGap[] = [
    {
      category: 'forensic',
      gapDescription: 'placeholder: dna missing',
      whyItMatters: 'placeholder: reason',
      howToFill: 'Submit clothing for modern testing',
      priority: 'critical',
      estimatedEffort: 'placeholder:effort',
      potentialBreakthroughValue: 0.92,
    },
  ];

  const html = renderToStaticMarkup(<EvidenceGapsView gaps={gaps} />);
  assertIncludes(html, 'Effort not documented', 'fallback copy clarifies missing effort');
  assertNotIncludes(html, 'placeholder: dna missing', 'gap description placeholder removed');
  assertNotIncludes(html, 'placeholder: reason', 'why it matters placeholder removed');
})();

(() => {
  const analysis: RelationshipNetworkAnalysis = {
    nodes: [
      {
        name: 'placeholder:prime suspect',
        role: 'suspect',
        connections: [
          {
            to: 'Witness One',
            type: 'friend',
            strength: 0.8,
            notes: 'placeholder:note',
            suspicious: true,
          },
        ],
        alibi: 'placeholder:alibi',
        motive: 'Inheritance',
        opportunity: 'Unknown',
      },
    ],
    relationships: [
      {
        from: 'placeholder:prime suspect',
        to: 'Witness One',
        type: 'friend',
        strength: 0.8,
        notes: 'placeholder:note',
        suspicious: true,
      },
    ],
    hiddenConnections: [
      {
        person1: 'placeholder:prime suspect',
        person2: 'Witness Two',
        connectionType: 'business',
        whyItMatters: 'placeholder:why',
        hiddenHow: 'Withheld from reports',
        discoveredFrom: ['Phone dump'],
      },
    ],
    clusters: [],
    insights: {
      primaryConnectors: ['placeholder:prime suspect'],
      potentialConflicts: ['prime suspect ⇄ Witness Two'],
      recommendedFollowUp: ['Re-interview Witness Two'],
    },
  };

  const html = renderToStaticMarkup(<RelationshipNetworkView analysis={analysis} />);
  assertIncludes(html, 'Hidden connections to review', 'relationship view surfaces hidden links');
  assertNotIncludes(html, 'placeholder:prime suspect', 'display text should suppress placeholder names');
})();
