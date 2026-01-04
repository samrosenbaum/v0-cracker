/**
 * Comprehensive Test Case Data for Internal Testing
 *
 * This file contains realistic cold case data including:
 * - Victim information
 * - Multiple suspects with detailed interviews
 * - Witness statements
 * - Timeline events
 * - Evidence items
 * - Relationships between all parties
 */

export interface TestInterview {
  speaker: string;
  role: 'suspect' | 'witness' | 'family' | 'associate';
  date: string;
  content: string;
  interviewer: string;
  location: string;
}

export interface TestEntity {
  id: string;
  name: string;
  type: 'person' | 'location' | 'evidence' | 'vehicle' | 'organization';
  role?: 'victim' | 'suspect' | 'witness' | 'family' | 'associate';
  description: string;
  metadata?: Record<string, any>;
}

export interface TestConnection {
  from: string;
  to: string;
  type: string;
  label: string;
  confidence: 'confirmed' | 'probable' | 'possible' | 'unverified';
  evidenceNotes?: string;
  suspicious?: boolean;
}

export interface TestTimelineEvent {
  id: string;
  type: 'victim_action' | 'suspect_movement' | 'witness_account' | 'evidence_found' | 'phone_call' | 'transaction' | 'sighting';
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  personId: string;
  verificationStatus: 'verified' | 'unverified' | 'disputed';
}

export interface TestCaseData {
  caseId: string;
  caseName: string;
  caseDescription: string;
  incidentDate: string;
  incidentLocation: string;
  victim: TestEntity;
  suspects: TestEntity[];
  witnesses: TestEntity[];
  locations: TestEntity[];
  evidence: TestEntity[];
  interviews: TestInterview[];
  connections: TestConnection[];
  timeline: TestTimelineEvent[];
}

// =============================================================================
// THE RIVERSIDE DISAPPEARANCE - A Comprehensive Test Case
// =============================================================================

export const riversideDisappearanceCase: TestCaseData = {
  caseId: 'test-riverside-001',
  caseName: 'The Riverside Disappearance',
  caseDescription: 'Sarah Mitchell, 28, disappeared on October 15, 2019 after leaving work at Riverside Art Museum. Last seen at the overlook parking lot at 6:47 PM. Her car was found abandoned the next morning. Investigation revealed a complex web of relationships involving her ex-boyfriend, business partner, and a mysterious figure seen arguing with her hours before.',
  incidentDate: '2019-10-15',
  incidentLocation: 'Riverside Overlook, Riverside County',

  victim: {
    id: 'victim-sarah',
    name: 'Sarah Mitchell',
    type: 'person',
    role: 'victim',
    description: 'Art curator at Riverside Art Museum. Age 28. Recently broke up with long-term boyfriend Marcus Cole. Had started a side business with colleague Jennifer Walsh. Known to visit the overlook regularly after work.',
    metadata: {
      age: 28,
      occupation: 'Art Curator',
      lastSeen: '2019-10-15 18:47',
      lastKnownLocation: 'Riverside Overlook Parking Lot',
      phoneLastActive: '2019-10-15 19:12',
      financialStatus: 'Moderate debt, recent large deposits'
    }
  },

  suspects: [
    {
      id: 'suspect-marcus',
      name: 'Marcus Cole',
      type: 'person',
      role: 'suspect',
      description: 'Ex-boyfriend of Sarah Mitchell. Construction foreman. Relationship ended 3 weeks before disappearance. Witnesses reported heated arguments. Claims he was at a bar with friends during incident window.',
      metadata: {
        age: 31,
        occupation: 'Construction Foreman',
        relationshipToVictim: 'Ex-boyfriend (3 years)',
        priorIncidents: 'Neighbors reported 2 domestic disturbance calls',
        alibiStrength: 'Partial - friends confirm bar presence until 6pm only',
        motive: 'Jealousy, recent breakup, financial dispute over shared apartment deposit'
      }
    },
    {
      id: 'suspect-jennifer',
      name: 'Jennifer Walsh',
      type: 'person',
      role: 'suspect',
      description: 'Business partner and colleague of Sarah. Started an art authentication side business together. Recent financial disagreements. Was at museum until 5:30 PM on day of disappearance.',
      metadata: {
        age: 32,
        occupation: 'Art Authenticator',
        relationshipToVictim: 'Business partner, colleague',
        financialMotive: 'Business dispute - Sarah discovered discrepancies in accounts',
        alibiStrength: 'Weak - claims went home, no witnesses after 5:30 PM',
        knownVehicle: 'Silver Toyota Camry'
      }
    },
    {
      id: 'suspect-david',
      name: 'David Park',
      type: 'person',
      role: 'suspect',
      description: 'Unknown male seen arguing with Sarah at museum earlier that day. Later identified as art dealer with pending lawsuit against the museum. History of threatening behavior toward museum staff.',
      metadata: {
        age: 45,
        occupation: 'Art Dealer',
        relationshipToVictim: 'Business adversary',
        priorIncidents: 'Restraining order filed by another museum employee',
        alibiStrength: 'None provided initially, later claimed business dinner',
        vehicle: 'Black BMW X5'
      }
    }
  ],

  witnesses: [
    {
      id: 'witness-tom',
      name: 'Tom Bradley',
      type: 'person',
      role: 'witness',
      description: 'Security guard at Riverside Art Museum. Last person to see Sarah at work. Saw her leave at 5:45 PM appearing agitated.',
      metadata: {
        credibility: 'High - employed 8 years, no contradictions',
        observation: 'Saw Sarah on phone, crying, before leaving'
      }
    },
    {
      id: 'witness-maria',
      name: 'Maria Santos',
      type: 'person',
      role: 'witness',
      description: 'Dog walker who frequents overlook trail. Saw Sarah\'s car arrive at 6:15 PM. Saw a man approach the car around 6:30 PM.',
      metadata: {
        credibility: 'Medium - details have shifted slightly between interviews',
        observation: 'Man was tall, dark jacket, couldn\'t see face clearly'
      }
    },
    {
      id: 'witness-james',
      name: 'James Rivera',
      type: 'person',
      role: 'witness',
      description: 'Bartender at O\'Malley\'s Pub. Confirms Marcus Cole was at bar from approximately 4:30 PM to 6:00 PM.',
      metadata: {
        credibility: 'High - has transaction records',
        observation: 'Marcus was drinking heavily, seemed upset about a breakup'
      }
    },
    {
      id: 'witness-karen',
      name: 'Karen Mitchell',
      type: 'person',
      role: 'family',
      description: 'Sarah\'s mother. Last spoke with Sarah at 5:15 PM on day of disappearance. Sarah mentioned she was meeting someone at the overlook.',
      metadata: {
        credibility: 'High - family member',
        observation: 'Sarah said "I need to sort this out once and for all"'
      }
    }
  ],

  locations: [
    {
      id: 'loc-museum',
      name: 'Riverside Art Museum',
      type: 'location',
      description: 'Sarah\'s workplace. Victorian-era building downtown. Security cameras captured Sarah leaving at 5:45 PM.',
      metadata: { hasCamera: true, cameraFootageStatus: 'Obtained' }
    },
    {
      id: 'loc-overlook',
      name: 'Riverside Overlook',
      type: 'location',
      description: 'Scenic overlook with parking lot. Sarah\'s car found here. No security cameras. Remote location, limited cell coverage.',
      metadata: { hasCamera: false, cellCoverage: 'Poor' }
    },
    {
      id: 'loc-omalleys',
      name: 'O\'Malley\'s Pub',
      type: 'location',
      description: 'Bar where Marcus Cole claims alibi. Located 15 minutes from overlook.',
      metadata: { hasCamera: true, cameraFootageStatus: 'Partial - shows entrance only' }
    },
    {
      id: 'loc-jennifer-home',
      name: 'Jennifer Walsh Residence',
      type: 'location',
      description: 'Apartment complex with no exterior cameras. Jennifer claims she went directly home after work.',
      metadata: { hasCamera: false }
    }
  ],

  evidence: [
    {
      id: 'evid-car',
      name: 'Sarah\'s Honda Civic',
      type: 'evidence',
      description: 'Found at overlook parking lot at 7:30 AM next morning. Keys in ignition, purse on passenger seat, phone missing. Fingerprints collected.',
      metadata: {
        fingerprints: 'Sarah\'s, plus 2 unidentified sets',
        dnaFound: 'Hair fibers in back seat - testing pending',
        condition: 'No signs of struggle'
      }
    },
    {
      id: 'evid-phone-records',
      name: 'Phone Records',
      type: 'evidence',
      description: 'Sarah\'s phone records show call at 5:15 PM (mother), text at 5:52 PM (unknown number), call at 6:10 PM (Jennifer Walsh - 4 minutes).',
      metadata: {
        lastPing: '6:47 PM - tower near overlook',
        deletedTexts: 'Recovery attempted',
        unknownNumber: 'Burner phone - untraceable'
      }
    },
    {
      id: 'evid-business-records',
      name: 'Art Authentication Business Records',
      type: 'evidence',
      description: 'Financial records showing $47,000 discrepancy discovered by Sarah one week before disappearance. Email to accountant dated Oct 8.',
      metadata: {
        discrepancyAmount: 47000,
        discoveryDate: '2019-10-08',
        beneficiary: 'Unclear - investigation ongoing'
      }
    },
    {
      id: 'evid-jacket',
      name: 'Dark Jacket Fragment',
      type: 'evidence',
      description: 'Torn fabric found on fence near overlook trail. Black synthetic material consistent with common outdoor jackets.',
      metadata: {
        material: 'Polyester blend',
        brand: 'Common - sold at multiple retailers',
        dnaStatus: 'Testing in progress'
      }
    }
  ],

  interviews: [
    // Marcus Cole - Suspect Interview 1
    {
      speaker: 'Marcus Cole',
      role: 'suspect',
      date: '2019-10-17',
      interviewer: 'Detective Williams',
      location: 'Riverside Police Station',
      content: `I already told you, I was at O'Malley's that night. Ask anyone there. Yeah, Sarah and I broke up, but that doesn't mean I would hurt her. We were together for three years. I loved her. Still do, honestly.

The breakup? She wanted it, not me. Said she needed space, needed to focus on her career. I tried to talk her out of it, maybe I was too persistent. But that's not a crime.

Where was I exactly? I got to the bar around 4:30, maybe 4:45. Had a few beers, talked to James the bartender. Left around... I don't know, sometime after 6. Maybe 6:15? The details are fuzzy, I was drinking.

After the bar? I went home. Alone. No, nobody can confirm that. I live alone now since Sarah kicked me out of our place. Well, her place technically.

The phone calls? Yeah, I tried calling her a few times that week. She wasn't returning my calls. I was worried about her. Is that so wrong? I wanted to know if she was okay, if maybe we could work things out.

No, I wasn't at the overlook. Why would I be there? That was her spot, not mine. She used to go there to think. I respected her space.

Look, I know how this looks. The angry ex-boyfriend. But I swear to God, I didn't touch her. You need to look at that business partner of hers. Jennifer. Something was off about her. Sarah told me she found some problems with their accounts.`
    },

    // Marcus Cole - Suspect Interview 2 (Follow-up)
    {
      speaker: 'Marcus Cole',
      role: 'suspect',
      date: '2019-10-24',
      interviewer: 'Detective Williams',
      location: 'Riverside Police Station',
      content: `I need to correct something from last time. I left the bar closer to 6, not 6:15. I checked my credit card statement. The transaction was at 5:58 PM.

After the bar, I... I didn't go straight home. I drove around for a while. I was upset, thinking about Sarah. I might have driven past her apartment. But I never went to the overlook. I swear.

The two calls to Sarah that day? The first one she didn't answer. The second one went to voicemail. I didn't leave a message. I didn't know what to say.

You found my fingerprints where? On her car door? Yeah, I opened her car door the week before. We were talking, I thought maybe we were getting back together. She got upset, told me to leave her alone. That's the last time I saw her.

The scratch on my arm? I got that at work. Construction site. You can check with my supervisor. It happened two days before Sarah disappeared.

I'm not changing my story. I'm just... I'm remembering things more clearly now. The fog is lifting. I want to help. I want you to find whoever did this.

What about David Park? That art dealer guy? I saw him at the museum once. He was yelling at Sarah. Something about authentication paperwork. She was scared of him. Did you look into him?`
    },

    // Jennifer Walsh - Suspect Interview 1
    {
      speaker: 'Jennifer Walsh',
      role: 'suspect',
      date: '2019-10-17',
      interviewer: 'Detective Martinez',
      location: 'Riverside Police Station',
      content: `Sarah was my best friend and business partner. I can't believe this is happening. We've known each other for six years, worked together at the museum for four.

The side business? Yes, we started Art Verify LLC about two years ago. Authentication services for private collectors. It was going well. Very well, actually.

Financial discrepancies? I don't know what you're talking about. Our books are clean. Maybe Sarah misread something. She wasn't really the numbers person - that was more my area.

The day she disappeared, I left the museum at 5:30. We had a brief conversation around 5:15. She seemed distracted but didn't say why. I asked if she wanted to grab dinner and she said she had somewhere to be.

Did she say where? No, she just said she needed to "handle something." I assumed it was about Marcus. He'd been calling her constantly since the breakup.

After work, I went straight home. No, I don't have anyone who can verify that. I live alone. I made dinner, watched TV, went to bed early. I didn't know anything was wrong until the next day.

The phone call at 6:10? Sarah called me briefly. She asked if I remembered the name of a client we worked with last spring. Thompson, I think? I told her and she hung up. She sounded rushed.

I think you need to focus on Marcus. He couldn't accept the breakup. I heard him threatening her once. He said something like "you'll regret this." Sarah was scared of him.`
    },

    // Jennifer Walsh - Suspect Interview 2
    {
      speaker: 'Jennifer Walsh',
      role: 'suspect',
      date: '2019-10-25',
      interviewer: 'Detective Martinez',
      location: 'Riverside Police Station',
      content: `The $47,000? Okay, yes, Sarah did bring up some questions about our accounting. But it wasn't a discrepancy - it was a timing issue with receivables. Some clients pay late. I explained it to her and she understood.

Her email to the accountant? I wasn't aware she sent that. Why would she go behind my back like that? I told her it was fine.

To be honest, things between us had been... strained. She was spending more time with her new boyfriend. Wait, you didn't know about the new boyfriend? I assumed you'd found out by now.

I don't know his name. She was secretive about it. I just know she was seeing someone. She'd get texts and smile, step away to take calls. This was in the two weeks before she disappeared.

No, it wasn't Marcus. She definitely wasn't back with Marcus. This was someone new. I think that's why she was at the overlook - meeting him.

The call at 6:10 wasn't just about the client name. She also asked me if I'd told anyone about her new relationship. I said no. She seemed relieved but also nervous.

After we hung up, I tried calling her back around 7:30. It went straight to voicemail. I figured her phone died. I wish I'd done something more.

The silver car near the overlook? I drive a silver Camry, yes, but lots of people do. I wasn't there. I was at home. I don't know how to prove it, but I wasn't there.`
    },

    // David Park - Suspect Interview 1
    {
      speaker: 'David Park',
      role: 'suspect',
      date: '2019-10-20',
      interviewer: 'Detective Williams',
      location: 'Attorney\'s Office',
      content: `My lawyer is here because I know how this works. I'm a businessman. I've been around.

Yes, I was at the museum on October 15th. I had a meeting with the acquisitions director, not Sarah Mitchell. Our interaction was brief and professional.

The lawsuit? That's about a business disagreement with the museum, not Sarah personally. They sold a piece I consigned for less than agreed. Standard dispute. Happens all the time in this business.

Did I argue with Sarah? We had words, yes. She was defending the museum's position. She said some things I found disrespectful. I may have raised my voice. I apologize for that. But I left the museum by 3 PM.

Where was I at 6:30 PM? I had a business dinner at Carmine's Italian. Started at 6, ended around 9. I have the receipt and my dinner companion will verify.

The restraining order from another museum? That was a misunderstanding. The employee was mistaken about my intentions. It was dropped after six months.

Sarah Mitchell... I barely knew her. She was just another museum employee protecting her employer. Why would I have any interest in harming her?

My car? Yes, I drive a black BMW X5. No, I was not at the overlook. I was across town at dinner. Check the cameras at the restaurant if you don't believe me.

This is a waste of time. You should be looking at the ex-boyfriend. That's always who it is.`
    },

    // Tom Bradley - Witness Interview
    {
      speaker: 'Tom Bradley',
      role: 'witness',
      date: '2019-10-16',
      interviewer: 'Detective Martinez',
      location: 'Riverside Art Museum',
      content: `I've worked security here for eight years. I know all the staff. Sarah was one of the good ones. Always said hello, asked about my grandkids.

October 15th. She came in around 9 AM like usual. Normal morning. I remember she had a meeting around 11 because I had to let in some visitors for her.

Around 2:30 PM, there was some commotion. That art dealer, David Park, was here. He and Sarah got into it in the hallway. He was loud, aggressive. I was about to intervene when he stormed off.

Sarah looked shaken after. I asked if she was okay and she said "I'm fine, Tom. Just business stuff."

Later, around 5:30, I saw her on her phone near the back entrance. She was crying. Not sobbing, but wiping her eyes. When she noticed me, she tried to smile and said she was leaving for the day.

At 5:45 PM, I watched her walk to her car. She sat there for a few minutes before driving off. She headed east, toward the overlook.

Did I see anyone following her? No. But I wasn't watching the whole parking lot. There were other cars, other staff leaving.

Jennifer Walsh? She left about 15 minutes before Sarah. I saw them talk briefly outside the break room earlier. It looked... tense. Not friendly.

If I had to guess what was bothering Sarah? She seemed like someone with a lot on her mind. Personal stuff, probably. She'd been different the last few weeks. Distracted.`
    },

    // Maria Santos - Witness Interview
    {
      speaker: 'Maria Santos',
      role: 'witness',
      date: '2019-10-16',
      interviewer: 'Detective Williams',
      location: 'Riverside Overlook',
      content: `I walk my dog there every evening. It's quiet, beautiful views. I know all the regulars.

The Honda Civic arrived around 6:15. I remember because I'd just checked my phone for a message. The girl parked in the spot closest to the trail.

She stayed in her car for a while. Looked like she was on her phone. Then she got out and walked toward the overlook railing. Just stood there looking at the river.

The man showed up maybe 6:30, 6:35. He came from the direction of the secondary parking area, the one behind the trees. Walked directly toward her.

Description? Tall, maybe 6 feet. Dark jacket - could have been black or navy. He walked with purpose, like he knew where he was going. Didn't seem like a casual visitor.

I didn't see his face clearly. It was getting dark and I was on the trail below. I saw him approach her from behind. They talked. It looked animated - his arms were moving.

Then I turned the corner and lost sight of them. That was maybe 6:40. When I came back around ten minutes later, neither of them was there. Her car was still there though.

I should have paid more attention. If I'd known something was wrong... I just thought it was a couple having a discussion. People come there to talk all the time.

The jacket? I found the torn piece the next morning when I came back with my dog. It was caught on the fence near the trail. I didn't touch it - called you folks right away.`
    },

    // Karen Mitchell - Family Interview
    {
      speaker: 'Karen Mitchell',
      role: 'family',
      date: '2019-10-16',
      interviewer: 'Detective Martinez',
      location: 'Mitchell Residence',
      content: `My daughter called me at 5:15 PM. We talk every day, usually on her drive home from work.

She sounded stressed. She said she was going to meet someone at the overlook to "sort things out once and for all." Those were her exact words.

Who was she meeting? She didn't say specifically. I assumed it was Marcus. They'd been going back and forth since the breakup. But now I'm not sure.

Actually... she mentioned something about finding answers. She said "Mom, I think I've been too trusting." I asked what she meant and she said she'd tell me more later. That later never came.

The new relationship Jennifer mentioned? Sarah hadn't told me about anyone new. But Sarah was always private about her dating life. She didn't want me to worry or get too involved.

The business with Jennifer? Sarah did mention concerns a week or so before. She said she found some "irregularities" and wasn't sure what to do about it. I told her to talk to Jennifer directly. Maybe that's what the meeting was about?

What I don't understand is why she went alone. If she was confronting someone about something serious, why not bring someone with her? Why go to that isolated spot?

Sarah was smart. Careful. For her to be taken... whoever did this, they knew her. They knew her routines. They knew where she'd be.

Please find my daughter. Please.`
    },

    // James Rivera - Witness Interview
    {
      speaker: 'James Rivera',
      role: 'witness',
      date: '2019-10-17',
      interviewer: 'Detective Williams',
      location: 'O\'Malley\'s Pub',
      content: `Marcus is a regular here. Been coming in for years.

October 15th, he showed up around 4:30, maybe 4:45. Sat at the bar, ordered his usual - Bud Light. He was definitely upset about something.

We talked a bit. He mentioned the breakup with Sarah. Said he couldn't understand why she ended things. He kept checking his phone, like he was waiting for a call or text that never came.

How many drinks? I served him four beers over about an hour and a half. He wasn't drunk, but he wasn't sober either.

His last transaction? I have the receipt - 5:58 PM for his tab. $24 plus tip. He paid cash for some of it, card for the rest.

When he left, he seemed... determined, I guess? Like he'd made a decision about something. He said "I'm gonna fix this" as he walked out. I assumed he meant the relationship.

I didn't see which way he went. The parking lot is around back and I was dealing with other customers.

Marcus a violent guy? Honestly, no. He's always been polite here. Tips well. Never caused trouble. But heartbreak does weird things to people. I've seen it before.

Did anyone else from that night see anything? There were maybe a dozen people in the bar. I can give you the names I know. Some paid with cards so you can track them down.`
    }
  ],

  connections: [
    // Victim connections
    { from: 'victim-sarah', to: 'suspect-marcus', type: 'romantic', label: 'Ex-girlfriend (3 years)', confidence: 'confirmed', evidenceNotes: 'Multiple witnesses confirm relationship, ended Oct 1, 2019' },
    { from: 'victim-sarah', to: 'suspect-jennifer', type: 'business', label: 'Business Partner', confidence: 'confirmed', evidenceNotes: 'Co-owners of Art Verify LLC since 2017' },
    { from: 'victim-sarah', to: 'suspect-david', type: 'adversarial', label: 'Business Conflict', confidence: 'confirmed', evidenceNotes: 'Lawsuit-related confrontation witnessed Oct 15' },
    { from: 'victim-sarah', to: 'witness-tom', type: 'professional', label: 'Workplace', confidence: 'confirmed' },
    { from: 'victim-sarah', to: 'witness-karen', type: 'family', label: 'Mother-Daughter', confidence: 'confirmed' },
    { from: 'victim-sarah', to: 'loc-museum', type: 'works_at', label: 'Employment', confidence: 'confirmed' },
    { from: 'victim-sarah', to: 'loc-overlook', type: 'frequents', label: 'Regular visitor', confidence: 'confirmed', evidenceNotes: 'Multiple witnesses confirm routine visits' },

    // Suspect connections
    { from: 'suspect-marcus', to: 'loc-omalleys', type: 'alibi_location', label: 'Alibi (partial)', confidence: 'probable', evidenceNotes: 'Verified until 5:58 PM only' },
    { from: 'suspect-marcus', to: 'witness-james', type: 'alibi_witness', label: 'Alibi witness', confidence: 'confirmed' },
    { from: 'suspect-marcus', to: 'evid-car', type: 'physical_evidence', label: 'Fingerprints found', confidence: 'confirmed', evidenceNotes: 'Claims from previous encounter', suspicious: true },

    { from: 'suspect-jennifer', to: 'loc-museum', type: 'works_at', label: 'Employment', confidence: 'confirmed' },
    { from: 'suspect-jennifer', to: 'evid-business-records', type: 'access', label: 'Business records access', confidence: 'confirmed', suspicious: true },
    { from: 'suspect-jennifer', to: 'evid-phone-records', type: 'communication', label: 'Phone call 6:10 PM', confidence: 'confirmed', evidenceNotes: '4 minute call before disappearance' },
    { from: 'suspect-jennifer', to: 'loc-jennifer-home', type: 'alibi_location', label: 'Unverified alibi', confidence: 'unverified' },

    { from: 'suspect-david', to: 'loc-museum', type: 'confrontation', label: 'Argument Oct 15', confidence: 'confirmed', evidenceNotes: 'Witnessed by Tom Bradley' },
    { from: 'suspect-david', to: 'victim-sarah', type: 'threat', label: 'Prior threatening behavior', confidence: 'probable', suspicious: true },

    // Evidence connections
    { from: 'evid-car', to: 'loc-overlook', type: 'found_at', label: 'Found Oct 16', confidence: 'confirmed' },
    { from: 'evid-jacket', to: 'loc-overlook', type: 'found_at', label: 'Found Oct 16', confidence: 'confirmed' },
    { from: 'evid-phone-records', to: 'victim-sarah', type: 'belongs_to', label: 'Victim\'s records', confidence: 'confirmed' },

    // Witness connections
    { from: 'witness-maria', to: 'loc-overlook', type: 'present_at', label: 'Evening of Oct 15', confidence: 'confirmed' },
    { from: 'witness-maria', to: 'victim-sarah', type: 'sighting', label: 'Last known sighting', confidence: 'confirmed' },

    // Hidden/suspicious connections
    { from: 'suspect-jennifer', to: 'suspect-marcus', type: 'unknown', label: 'Possible coordination?', confidence: 'unverified', evidenceNotes: 'Both blame each other, both have weak alibis', suspicious: true }
  ],

  timeline: [
    { id: 'tl-1', type: 'victim_action', title: 'Sarah arrives at work', description: 'Arrives at Riverside Art Museum', date: '2019-10-15', time: '09:00', location: 'Riverside Art Museum', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-2', type: 'witness_account', title: 'David Park confrontation', description: 'David Park argues with Sarah in hallway, witnessed by Tom Bradley', date: '2019-10-15', time: '14:30', location: 'Riverside Art Museum', personId: 'suspect-david', verificationStatus: 'verified' },
    { id: 'tl-3', type: 'suspect_movement', title: 'David Park leaves museum', description: 'David Park storms out of museum after confrontation', date: '2019-10-15', time: '15:00', location: 'Riverside Art Museum', personId: 'suspect-david', verificationStatus: 'verified' },
    { id: 'tl-4', type: 'suspect_movement', title: 'Marcus arrives at bar', description: 'Marcus Cole arrives at O\'Malley\'s Pub', date: '2019-10-15', time: '16:30', location: 'O\'Malley\'s Pub', personId: 'suspect-marcus', verificationStatus: 'verified' },
    { id: 'tl-5', type: 'phone_call', title: 'Sarah calls mother', description: 'Sarah speaks with Karen Mitchell, mentions meeting someone', date: '2019-10-15', time: '17:15', location: 'Riverside Art Museum', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-6', type: 'suspect_movement', title: 'Jennifer leaves work', description: 'Jennifer Walsh leaves museum', date: '2019-10-15', time: '17:30', location: 'Riverside Art Museum', personId: 'suspect-jennifer', verificationStatus: 'verified' },
    { id: 'tl-7', type: 'witness_account', title: 'Sarah seen crying', description: 'Tom Bradley sees Sarah on phone, upset, near back entrance', date: '2019-10-15', time: '17:30', location: 'Riverside Art Museum', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-8', type: 'victim_action', title: 'Sarah leaves museum', description: 'Sarah walks to her car and drives east toward overlook', date: '2019-10-15', time: '17:45', location: 'Riverside Art Museum', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-9', type: 'transaction', title: 'Marcus pays tab', description: 'Marcus Cole closes tab at O\'Malley\'s - last verified alibi time', date: '2019-10-15', time: '17:58', location: 'O\'Malley\'s Pub', personId: 'suspect-marcus', verificationStatus: 'verified' },
    { id: 'tl-10', type: 'suspect_movement', title: 'David Park at restaurant', description: 'David Park claims to arrive at Carmine\'s for dinner', date: '2019-10-15', time: '18:00', location: 'Carmine\'s Italian', personId: 'suspect-david', verificationStatus: 'unverified' },
    { id: 'tl-11', type: 'phone_call', title: 'Jennifer calls Sarah', description: 'Jennifer Walsh speaks with Sarah for 4 minutes', date: '2019-10-15', time: '18:10', location: 'Unknown', personId: 'suspect-jennifer', verificationStatus: 'verified' },
    { id: 'tl-12', type: 'sighting', title: 'Sarah arrives at overlook', description: 'Maria Santos sees Sarah\'s Honda arrive at overlook parking', date: '2019-10-15', time: '18:15', location: 'Riverside Overlook', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-13', type: 'sighting', title: 'Unknown man approaches', description: 'Maria Santos sees tall man in dark jacket approach Sarah', date: '2019-10-15', time: '18:30', location: 'Riverside Overlook', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-14', type: 'phone_call', title: 'Last phone activity', description: 'Sarah\'s phone last pings tower near overlook', date: '2019-10-15', time: '18:47', location: 'Riverside Overlook', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-15', type: 'evidence_found', title: 'Car discovered', description: 'Sarah\'s abandoned Honda Civic found by morning jogger', date: '2019-10-16', time: '07:30', location: 'Riverside Overlook', personId: 'victim-sarah', verificationStatus: 'verified' },
    { id: 'tl-16', type: 'evidence_found', title: 'Jacket fragment found', description: 'Maria Santos discovers torn fabric on fence', date: '2019-10-16', time: '08:15', location: 'Riverside Overlook', personId: 'witness-maria', verificationStatus: 'verified' }
  ]
};

// =============================================================================
// Helper Functions for Test Data
// =============================================================================

export function getInterviewsByPerson(caseData: TestCaseData, personId: string): TestInterview[] {
  const entity = [...caseData.suspects, ...caseData.witnesses].find(e => e.id === personId);
  if (!entity) return [];
  return caseData.interviews.filter(i => i.speaker === entity.name);
}

export function getConnectionsForEntity(caseData: TestCaseData, entityId: string): TestConnection[] {
  return caseData.connections.filter(c => c.from === entityId || c.to === entityId);
}

export function getSuspiciousConnections(caseData: TestCaseData): TestConnection[] {
  return caseData.connections.filter(c => c.suspicious);
}

export function getTimelineForPerson(caseData: TestCaseData, personId: string): TestTimelineEvent[] {
  return caseData.timeline.filter(e => e.personId === personId).sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time}`);
    const dateTimeB = new Date(`${b.date}T${b.time}`);
    return dateTimeA.getTime() - dateTimeB.getTime();
  });
}

export function getVictimRelationships(caseData: TestCaseData): TestConnection[] {
  return caseData.connections.filter(c => c.from === caseData.victim.id || c.to === caseData.victim.id);
}

export function getAlibiGaps(caseData: TestCaseData): { suspect: TestEntity; lastVerified: string; nextVerified: string | null; gapMinutes: number }[] {
  const gaps: { suspect: TestEntity; lastVerified: string; nextVerified: string | null; gapMinutes: number }[] = [];

  for (const suspect of caseData.suspects) {
    const suspectTimeline = caseData.timeline
      .filter(e => e.personId === suspect.id && e.verificationStatus === 'verified')
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

    if (suspectTimeline.length > 0) {
      const lastVerified = suspectTimeline[suspectTimeline.length - 1];
      const incidentTime = new Date(`${caseData.incidentDate}T18:47`); // Last phone ping
      const lastVerifiedTime = new Date(`${lastVerified.date}T${lastVerified.time}`);
      const gapMinutes = Math.round((incidentTime.getTime() - lastVerifiedTime.getTime()) / (1000 * 60));

      if (gapMinutes > 0) {
        gaps.push({
          suspect,
          lastVerified: `${lastVerified.date} ${lastVerified.time}`,
          nextVerified: null,
          gapMinutes
        });
      }
    }
  }

  return gaps;
}

// =============================================================================
// SOLVABILITY MATRIX TEST DATA
// =============================================================================

import type {
  EvidenceItem,
  WitnessStatus,
  SuspectStatus,
  InvestigativeAction,
  CaseMetadata,
  SolvabilityInput,
} from '@/lib/solvability-matrix';

/**
 * Convert test case data to solvability input format
 */
export function getSolvabilityInputForCase(caseData: TestCaseData): SolvabilityInput {
  const incidentDate = new Date(caseData.incidentDate);
  const yearsOld = Math.floor(
    (new Date().getTime() - incidentDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  const caseMetadata: CaseMetadata = {
    caseId: caseData.caseId,
    caseName: caseData.caseName,
    incidentDate,
    yearsOld,
    jurisdiction: 'Riverside County',
    caseType: 'missing_person',
    statuteOfLimitations: 'none', // Missing person potentially connected to homicide
    originalInvestigators: ['Detective Williams', 'Detective Martinez'],
    currentAssignment: 'Cold Case Unit',
    mediaAttention: 'medium',
    familyEngagement: 'active',
  };

  // Convert evidence
  const evidence: EvidenceItem[] = [
    {
      id: 'evid-car-dna',
      type: 'dna_biological',
      description: 'Hair fibers found in back seat of victim\'s Honda Civic',
      collectionDate: new Date('2019-10-16'),
      storageLocation: 'Riverside County Crime Lab',
      condition: 'good',
      tested: false,
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
    {
      id: 'evid-fingerprints',
      type: 'fingerprint',
      description: 'Two unidentified fingerprint sets from vehicle',
      collectionDate: new Date('2019-10-16'),
      storageLocation: 'Riverside County Crime Lab',
      condition: 'good',
      tested: true,
      testDate: new Date('2019-10-20'),
      testMethod: 'AFIS',
      testResults: 'No matches found in database',
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
    {
      id: 'evid-jacket-dna',
      type: 'dna_biological',
      description: 'Dark jacket fragment found on fence near overlook',
      collectionDate: new Date('2019-10-16'),
      storageLocation: 'Riverside County Crime Lab',
      condition: 'fair',
      tested: false,
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
    {
      id: 'evid-phone-data',
      type: 'digital',
      description: 'Victim\'s phone records and deleted text recovery',
      collectionDate: new Date('2019-10-17'),
      storageLocation: 'Digital Evidence Unit',
      condition: 'good',
      tested: true,
      testDate: new Date('2019-10-25'),
      testMethod: 'Standard carrier records request',
      testResults: 'Partial recovery - burner phone messages unrecovered',
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
    {
      id: 'evid-surveillance',
      type: 'surveillance',
      description: 'Museum security camera footage',
      collectionDate: new Date('2019-10-16'),
      storageLocation: 'Digital Evidence Unit',
      condition: 'good',
      tested: true,
      testDate: new Date('2019-10-17'),
      testMethod: 'Manual review',
      testResults: 'Victim departure confirmed, no other useful footage',
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
    {
      id: 'evid-vehicle',
      type: 'vehicle',
      description: 'Victim\'s Honda Civic - interior and exterior',
      collectionDate: new Date('2019-10-16'),
      storageLocation: 'Police impound lot',
      condition: 'good',
      tested: true,
      testDate: new Date('2019-10-18'),
      testMethod: 'Standard forensic processing',
      testResults: 'Fingerprints, hair samples collected',
      canBeRetested: true,
      modernTestingOpportunities: [],
      chainOfCustody: 'complete',
    },
  ];

  // Convert witnesses
  const witnesses: WitnessStatus[] = [
    {
      id: 'witness-tom',
      name: 'Tom Bradley',
      role: 'eyewitness',
      originalStatementDate: new Date('2019-10-16'),
      currentStatus: 'alive_contactable',
      lastContactDate: new Date('2019-11-15'),
      willingnessToCooperate: 'cooperative',
      credibilityScore: 0.9,
      criticalityScore: 0.7,
      interviewCount: 2,
      hasBeenReinterviewed: true,
      notes: 'Security guard, last to see victim at work',
    },
    {
      id: 'witness-maria',
      name: 'Maria Santos',
      role: 'eyewitness',
      originalStatementDate: new Date('2019-10-16'),
      currentStatus: 'alive_contactable',
      lastContactDate: new Date('2019-12-01'),
      willingnessToCooperate: 'cooperative',
      credibilityScore: 0.7, // Details shifted between interviews
      criticalityScore: 0.95, // Critical - only person who saw suspect approach victim
      interviewCount: 3,
      hasBeenReinterviewed: true,
      notes: 'Only witness to see unknown male approach victim at overlook',
    },
    {
      id: 'witness-james',
      name: 'James Rivera',
      role: 'alibi_witness',
      originalStatementDate: new Date('2019-10-17'),
      currentStatus: 'alive_contactable',
      lastContactDate: new Date('2019-10-25'),
      willingnessToCooperate: 'cooperative',
      credibilityScore: 0.85,
      criticalityScore: 0.6,
      interviewCount: 1,
      hasBeenReinterviewed: false,
      notes: 'Bartender providing partial alibi for Marcus Cole',
    },
    {
      id: 'witness-karen',
      name: 'Karen Mitchell',
      role: 'other',
      originalStatementDate: new Date('2019-10-16'),
      currentStatus: 'alive_contactable',
      lastContactDate: new Date('2020-06-15'),
      willingnessToCooperate: 'cooperative',
      credibilityScore: 0.95,
      criticalityScore: 0.8,
      interviewCount: 4,
      hasBeenReinterviewed: true,
      notes: 'Victim\'s mother, last known phone contact',
    },
    {
      id: 'witness-bar-patrons',
      name: 'O\'Malley\'s Bar Patrons',
      role: 'alibi_witness',
      originalStatementDate: new Date('2019-10-20'),
      currentStatus: 'alive_unlocated',
      willingnessToCooperate: 'unknown',
      credibilityScore: 0.6,
      criticalityScore: 0.5,
      interviewCount: 0,
      hasBeenReinterviewed: false,
      notes: 'Multiple patrons who may have seen Marcus Cole - never located',
    },
    {
      id: 'witness-dinner-companion',
      name: 'David Park Dinner Companion',
      role: 'alibi_witness',
      originalStatementDate: new Date('2019-10-22'),
      currentStatus: 'alive_contactable',
      lastContactDate: new Date('2019-10-22'),
      willingnessToCooperate: 'reluctant',
      credibilityScore: 0.5, // Business associate, potential bias
      criticalityScore: 0.7,
      interviewCount: 1,
      hasBeenReinterviewed: false,
      notes: 'Business associate providing alibi for David Park - may have conflict of interest',
    },
  ];

  // Suspect statuses
  const suspects: SuspectStatus[] = [
    {
      id: 'suspect-marcus',
      name: 'Marcus Cole',
      currentStatus: 'alive_free',
      ageAtTime: 31,
      currentAge: 31 + yearsOld,
      clearanceStatus: 'person_of_interest',
      clearanceStrength: 'uncleared',
      dnaOnFile: false,
      willingToProvideNewDNA: null,
      statuteApplies: false,
      notes: 'Partial alibi only - not cleared',
    },
    {
      id: 'suspect-jennifer',
      name: 'Jennifer Walsh',
      currentStatus: 'alive_free',
      ageAtTime: 32,
      currentAge: 32 + yearsOld,
      clearanceStatus: 'person_of_interest',
      clearanceStrength: 'uncleared',
      dnaOnFile: false,
      willingToProvideNewDNA: null,
      statuteApplies: false,
      notes: 'No verifiable alibi, financial motive',
    },
    {
      id: 'suspect-david',
      name: 'David Park',
      currentStatus: 'alive_free',
      ageAtTime: 45,
      currentAge: 45 + yearsOld,
      clearanceStatus: 'cleared_other',
      clearanceMethod: 'Restaurant alibi from business associate',
      clearanceStrength: 'weak',
      dnaOnFile: false,
      willingToProvideNewDNA: null,
      statuteApplies: false,
      notes: 'Cleared based on alibi from biased witness - should be reexamined',
    },
  ];

  // Investigative actions
  const investigativeActions: InvestigativeAction[] = [
    {
      id: 'action-canvass',
      type: 'neighborhood_canvass',
      description: 'Door-to-door canvass of overlook area',
      datePerformed: new Date('2019-10-17'),
      performedBy: 'Patrol Officers',
      status: 'partial',
      result: 'Only 3 of 12 nearby residences contacted',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'Incomplete due to staffing constraints',
    },
    {
      id: 'action-background',
      type: 'background_check',
      description: 'Background checks on suspects',
      datePerformed: new Date('2019-10-18'),
      performedBy: 'Detective Williams',
      status: 'completed',
      result: 'David Park prior restraining order discovered',
      shouldHaveBeenDone: true,
      missedOpportunity: false,
    },
    {
      id: 'action-phone',
      type: 'phone_records',
      description: 'Phone records for victim and suspects',
      datePerformed: new Date('2019-10-20'),
      performedBy: 'Detective Martinez',
      status: 'completed',
      result: 'Burner phone number identified but not traced',
      shouldHaveBeenDone: true,
      missedOpportunity: false,
    },
    {
      id: 'action-financial',
      type: 'financial_records',
      description: 'Financial investigation of business dispute',
      status: 'partial',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'Only surface review completed - deep forensic accounting not performed',
    },
    {
      id: 'action-surveillance',
      type: 'surveillance',
      description: 'Collection of area surveillance footage',
      datePerformed: new Date('2019-10-17'),
      performedBy: 'Detective Williams',
      status: 'partial',
      result: 'Only museum footage obtained - nearby businesses not canvassed for cameras',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'Route to overlook may have had traffic cameras',
    },
    {
      id: 'action-forensic',
      type: 'forensic_analysis',
      description: 'Forensic analysis of physical evidence',
      datePerformed: new Date('2019-10-20'),
      performedBy: 'Crime Lab',
      status: 'partial',
      result: 'Fingerprints processed, DNA samples collected but not fully tested',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'DNA samples in backlog - never prioritized',
    },
    {
      id: 'action-polygraph',
      type: 'polygraph',
      description: 'Polygraph examinations',
      status: 'not_done',
      shouldHaveBeenDone: false, // Polygraphs are unreliable
      missedOpportunity: false,
    },
    {
      id: 'action-social',
      type: 'social_media_review',
      description: 'Social media analysis for victim and suspects',
      status: 'not_done',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'Standard practice for 2019 investigation - never performed',
    },
    {
      id: 'action-informant',
      type: 'informant_contact',
      description: 'Informant development',
      status: 'not_done',
      shouldHaveBeenDone: false,
      missedOpportunity: false,
    },
    {
      id: 'action-vehicle-check',
      type: 'vehicle_check',
      description: 'Suspect vehicle examination',
      status: 'not_done',
      shouldHaveBeenDone: true,
      missedOpportunity: true,
      notes: 'Silver Camry and Black BMW X5 never examined',
    },
  ];

  return {
    caseMetadata,
    evidence,
    witnesses,
    suspects,
    investigativeActions,
  };
}

// =============================================================================
// CLEARANCE TRACKER TEST DATA
// =============================================================================

import type {
  ClearanceRecord,
  AlibiDetails,
} from '@/lib/clearance-tracker';

/**
 * Get clearance records for test case suspects
 */
// =============================================================================
// INSIGHT EXTRACTION TEST DATA
// =============================================================================

import type {
  InterviewData,
  CaseKnowledge,
} from '@/lib/insight-extraction';

/**
 * Convert test case interviews to insight extraction format
 */
export function getInterviewDataForInsightExtraction(caseData: TestCaseData): InterviewData[] {
  return caseData.interviews.map((interview, index) => {
    // Match by speaker name since interviews don't have entity IDs
    const speakerName = interview.speaker;

    let role: InterviewData['speakerRole'] = 'other';
    if (caseData.suspects.some(s => s.name === speakerName)) {
      role = 'suspect';
    } else if (caseData.witnesses.some(w => w.name === speakerName)) {
      role = 'witness';
    }

    return {
      id: `interview-${index}-${speakerName.toLowerCase().replace(/\s+/g, '-')}`,
      speakerName: speakerName,
      speakerRole: role,
      interviewDate: new Date(interview.date),
      fullText: interview.content, // Use 'content' not 'fullTranscript'
    };
  });
}

/**
 * Get case knowledge for guilty knowledge detection
 */
export function getCaseKnowledgeForInsightExtraction(caseData: TestCaseData): CaseKnowledge {
  return {
    publiclyKnownFacts: [
      { fact: 'victim was last seen at the museum', disclosureDate: new Date('2019-10-16'), source: 'News report' },
      { fact: 'victim worked at the Natural History Museum', disclosureDate: new Date('2019-10-16'), source: 'News report' },
      { fact: 'vehicle was found at overlook', disclosureDate: new Date('2019-10-17'), source: 'Police statement' },
    ],
    criminallyKnownOnly: [
      'burned',
      'buried near the river',
      'specific injuries',
      'what the victim said before',
    ],
    evidenceDiscoveryDates: [
      { evidence: 'jacket fragment', discoveryDate: new Date('2019-10-16') },
      { evidence: 'hair samples', discoveryDate: new Date('2019-10-18') },
      { evidence: 'burner phone texts', discoveryDate: new Date('2019-10-20') },
    ],
  };
}

export function getClearanceRecordsForCase(caseData: TestCaseData): ClearanceRecord[] {
  return [
    // Marcus Cole - Partial alibi, no DNA, not formally cleared
    {
      id: 'clearance-marcus',
      suspectId: 'suspect-marcus',
      suspectName: 'Marcus Cole',
      clearanceDate: new Date('2019-10-25'),
      clearedBy: 'Detective Williams',
      methods: ['alibi_friend_family', 'passed_interview'],
      alibiDetails: {
        alibiClaim: 'At O\'Malley\'s Pub until 6:00 PM, then went home',
        alibiTimeframe: '4:30 PM - 6:00 PM',
        witnesses: [
          {
            name: 'James Rivera',
            relationship: 'acquaintance',
            statement: 'Marcus was at the bar from around 4:30 to 6 PM',
            credibilityScore: 0.85,
            wasInterviewed: true,
            interviewDate: new Date('2019-10-17'),
            changedStory: false,
            notes: 'Bartender, has transaction records',
          },
        ],
        documentaryEvidence: ['Credit card receipt at 5:58 PM'],
        investigatorVerification: 'partial',
        contradictions: [
          'Alibi only covers until 6 PM; victim last seen at 6:30 PM',
          'Changed story about what time he left the bar',
        ],
      },
      interviewDetails: {
        interviewCount: 2,
        totalDuration: '3.5 hours',
        techniques: ['rapport building', 'timeline questioning'],
        demeanor: 'Initially defensive, became more cooperative',
        cooperationLevel: 'partial',
        storyConsistency: 'minor_changes',
        suspiciousIndicators: [
          'Changed leaving time between interviews',
          'Admitted to driving by victim\'s apartment after bar',
        ],
      },
      notes: 'Partial alibi with gap during critical window',
      documentationAvailable: true,
      wasEverReopened: false,
    },

    // Jennifer Walsh - No alibi after 5:30 PM, cooperative behavior used as clearance
    {
      id: 'clearance-jennifer',
      suspectId: 'suspect-jennifer',
      suspectName: 'Jennifer Walsh',
      clearanceDate: new Date('2019-10-28'),
      clearedBy: 'Detective Martinez',
      methods: ['cooperative_behavior', 'no_apparent_motive', 'passed_interview'],
      alibiDetails: {
        alibiClaim: 'Went home after leaving work at 5:30 PM',
        alibiTimeframe: '5:30 PM onwards',
        witnesses: [],
        documentaryEvidence: [],
        investigatorVerification: 'none',
        contradictions: [],
      },
      interviewDetails: {
        interviewCount: 2,
        totalDuration: '2 hours',
        techniques: ['rapport building', 'behavioral analysis'],
        demeanor: 'Calm and helpful',
        cooperationLevel: 'full',
        storyConsistency: 'minor_changes',
        suspiciousIndicators: [
          'Denied knowing about financial discrepancies, then admitted them',
          'Introduced "mystery boyfriend" theory in second interview',
        ],
      },
      notes: 'Cleared primarily based on cooperative demeanor and lack of obvious motive',
      documentationAvailable: true,
      wasEverReopened: false,
    },

    // David Park - Polygraph + biased alibi witness
    {
      id: 'clearance-david',
      suspectId: 'suspect-david',
      suspectName: 'David Park',
      clearanceDate: new Date('2019-10-30'),
      clearedBy: 'Detective Williams',
      methods: ['polygraph_passed', 'alibi_coworker'],
      alibiDetails: {
        alibiClaim: 'Business dinner at Carmine\'s Italian from 6 PM to 9 PM',
        alibiTimeframe: '6:00 PM - 9:00 PM',
        witnesses: [
          {
            name: 'Robert Chen',
            relationship: 'business_partner',
            statement: 'We had dinner together starting at 6 PM',
            credibilityScore: 0.5,
            wasInterviewed: true,
            interviewDate: new Date('2019-10-22'),
            changedStory: false,
            notes: 'Business partner - potential conflict of interest',
          },
        ],
        documentaryEvidence: ['Restaurant receipt (time unclear)'],
        investigatorVerification: 'partial',
        contradictions: [
          'Witness is business partner with financial ties',
          'Restaurant receipt does not have timestamp',
        ],
      },
      polygraphDetails: {
        examiner: 'Certified Polygraph Services',
        date: new Date('2019-10-28'),
        result: 'passed',
        questionsFocused: ['Were you at the overlook?', 'Did you harm Sarah Mitchell?'],
        notes: 'Subject appeared calm during examination',
      },
      interviewDetails: {
        interviewCount: 1,
        totalDuration: '45 minutes',
        techniques: ['direct questioning'],
        demeanor: 'Defensive but controlled',
        cooperationLevel: 'with_attorney',
        storyConsistency: 'consistent',
        suspiciousIndicators: [],
      },
      notes: 'Cleared after passing polygraph - alibi from biased witness',
      documentationAvailable: true,
      wasEverReopened: false,
    },
  ];
}
