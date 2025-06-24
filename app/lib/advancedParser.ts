export interface ParsedDocument {
    id: string;
    filename: string;
    type: DocumentType;
    content: StructuredContent;
    metadata: DocumentMetadata;
    entities: ExtractedEntity[];
    relationships: DocumentRelationship[];
    qualityScore: number;
  }
  
  export interface StructuredContent {
    rawText: string;
    sections: DocumentSection[];
    tables: ExtractedTable[];
    dates: ExtractedDate[];
    locations: ExtractedLocation[];
    people: ExtractedPerson[];
    organizations: ExtractedOrganization[];
    vehicles: ExtractedVehicle[];
    communications: ExtractedCommunication[];
    financials: ExtractedFinancial[];
    evidence: ExtractedEvidence[];
  }
  
  export class AdvancedDocumentParser {
    
    static async parseDocument(file: File): Promise<ParsedDocument> {
      console.log(`🔍 Advanced parsing: ${file.name}`);
      
      // Step 1: Extract raw text with enhanced methods
      const rawText = await this.extractTextWithContext(file);
      
      // Step 2: Identify document type and structure
      const documentType = this.identifyDocumentType(rawText, file.name);
      const sections = this.extractDocumentSections(rawText, documentType);
      
      // Step 3: Extract structured data using multiple passes
      const structuredContent = await this.extractStructuredContent(rawText, sections, documentType);
      
      // Step 4: Perform entity recognition and relationship extraction
      const entities = await this.extractEntitiesWithContext(structuredContent);
      const relationships = this.extractDocumentRelationships(entities, structuredContent);
      
      // Step 5: Calculate quality and completeness scores
      const qualityScore = this.assessDocumentQuality(structuredContent, entities);
      
      return {
        id: this.generateDocumentId(file),
        filename: file.name,
        type: documentType,
        content: structuredContent,
        metadata: this.extractMetadata(file, rawText),
        entities,
        relationships,
        qualityScore
      };
    }
  
    private static async extractTextWithContext(file: File): Promise<string> {
      let text = "";
      
      if (file.type === 'application/pdf') {
        // Enhanced PDF extraction with layout preservation
        text = await this.extractPDFWithLayout(file);
      } else if (file.type.includes('word')) {
        // Enhanced DOCX extraction with formatting
        text = await this.extractDOCXWithFormatting(file);
      } else {
        text = await file.text();
      }
      
      // Clean and normalize text while preserving important formatting
      return this.cleanAndNormalizeText(text);
    }
  
    private static async extractPDFWithLayout(file: File): Promise<string> {
      try {
        const PDFParser = (await import('pdf2json')).default;
        const pdfParser = new PDFParser();
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfData = Buffer.from(arrayBuffer);
        
        return new Promise<string>((resolve, reject) => {
          pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            try {
              // Enhanced extraction that preserves layout information
              const pages = pdfData.Pages.map((page: any, pageNum: number) => {
                const pageText = page.Texts.map((textItem: any) => {
                  // Preserve positioning information for layout analysis
                  const x = textItem.x;
                  const y = textItem.y;
                  const text = decodeURIComponent(textItem.R.map((r: any) => r.T).join(''));
                  
                  return {
                    text,
                    x,
                    y,
                    page: pageNum + 1
                  };
                });
                
                // Sort by position to maintain reading order
                pageText.sort((a: any, b: any) => {
                  if (Math.abs(a.y - b.y) < 5) return a.x - b.x; // Same line
                  return a.y - b.y; // Different lines
                });
                
                return `\n--- PAGE ${pageNum + 1} ---\n` + 
                       pageText.map((item: any) => item.text).join(' ');
              });
              
              resolve(pages.join('\n'));
            } catch (err) {
              reject(err);
            }
          });
          
          pdfParser.on('pdfParser_dataError', (errData: any) => {
            reject(new Error(`PDF parsing error: ${errData.parserError}`));
          });
          
          pdfParser.parseBuffer(pdfData);
        });
      } catch (error) {
        console.error('PDF extraction error:', error);
        return `[PDF FILE: ${file.name} - Enhanced extraction failed]`;
      }
    }
  
    private static async extractDOCXWithFormatting(file: File): Promise<string> {
      try {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Extract with HTML to preserve some formatting
        const result = await mammoth.convertToHtml({ buffer });
        
        // Convert HTML back to structured text while preserving important formatting
        const text = this.htmlToStructuredText(result.value);
        
        return text;
      } catch (error) {
        console.error('DOCX extraction error:', error);
        return `[DOCX FILE: ${file.name} - Enhanced extraction failed]`;
      }
    }
  
    private static htmlToStructuredText(html: string): string {
      // Convert HTML elements to structured text markers
      let text = html
        .replace(/<h[1-6][^>]*>/gi, '\n\n=== HEADER: ')
        .replace(/<\/h[1-6]>/gi, ' ===\n')
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<\/p>/gi, '')
        .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
        .replace(/<\/strong>|<\/b>/gi, '**')
        .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
        .replace(/<\/em>|<\/i>/gi, '*')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<\/li>/gi, '')
        .replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
      
      return text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up extra newlines
    }
  
    private static cleanAndNormalizeText(text: string): string {
      return text
        // Normalize whitespace but preserve structure
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Preserve intentional formatting
        .replace(/\n{3,}/g, '\n\n')
        // Fix common OCR errors
        .replace(/\b(\d+)[oO](\d+)\b/g, '$1-$2') // Phone numbers
        .replace(/\bl(\d+)/g, '1$1') // Leading 'l' should be '1'
        .replace(/(\d+)l\b/g, '$11') // Trailing 'l' should be '1'
        // Normalize quotes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .trim();
    }
  
    private static identifyDocumentType(text: string, filename: string): DocumentType {
      const content = text.toLowerCase();
      
      // Police report patterns
      if (content.includes('incident report') || 
          content.includes('police report') ||
          content.includes('case number') ||
          filename.toLowerCase().includes('report')) {
        return 'police_report';
      }
      
      // Interview/interrogation patterns
      if (content.includes('interview') || 
          content.includes('interrogation') ||
          content.includes('q:') && content.includes('a:') ||
          content.includes('question:') && content.includes('answer:')) {
        return 'interview';
      }
      
      // Witness statement patterns
      if (content.includes('witness statement') ||
          content.includes('i witnessed') ||
          content.includes('i saw') && content.includes('statement')) {
        return 'witness_statement';
      }
      
      // Evidence log patterns
      if (content.includes('evidence') && (content.includes('log') || content.includes('inventory') || content.includes('chain of custody'))) {
        return 'evidence_log';
      }
      
      // Autopsy/medical patterns
      if (content.includes('autopsy') || 
          content.includes('medical examiner') ||
          content.includes('cause of death') ||
          content.includes('toxicology')) {
        return 'medical_report';
      }
      
      // Financial records
      if (content.includes('bank statement') ||
          content.includes('transaction') ||
          content.includes('account balance') ||
          filename.toLowerCase().includes('financial')) {
        return 'financial_record';
      }
      
      // Communications
      if (content.includes('phone records') ||
          content.includes('call log') ||
          content.includes('text message') ||
          content.includes('email')) {
        return 'communication_record';
      }
      
      // Surveillance
      if (content.includes('surveillance') ||
          content.includes('camera') ||
          content.includes('footage') ||
          filename.toLowerCase().includes('surveillance')) {
        return 'surveillance_report';
      }
      
      return 'general_document';
    }
  
    private static extractDocumentSections(text: string, type: DocumentType): DocumentSection[] {
      const sections: DocumentSection[] = [];
      
      // Common section patterns
      const sectionPatterns = [
        /(?:^|\n)\s*(?:SECTION|PART|CHAPTER)\s*[:\-]?\s*(.+?)(?=\n|$)/gim,
        /(?:^|\n)\s*([A-Z][A-Z\s]{5,}):?\s*\n/gm, // ALL CAPS headers
        /(?:^|\n)\s*===\s*(.+?)\s*===\s*\n/gm, // Our marked headers
        /(?:^|\n)\s*(\d+\.?\s+[A-Z][^.\n]+):/gm, // Numbered sections
      ];
      
      let sectionIndex = 0;
      sectionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          sections.push({
            id: `section_${sectionIndex++}`,
            title: match[1].trim(),
            startIndex: match.index,
            type: this.classifySectionType(match[1], type)
          });
        }
      });
      
      // Sort by position and add content
      sections.sort((a, b) => a.startIndex - b.startIndex);
      
      for (let i = 0; i < sections.length; i++) {
        const start = sections[i].startIndex;
        const end = i < sections.length - 1 ? sections[i + 1].startIndex : text.length;
        sections[i].content = text.substring(start, end).trim();
      }
      
      return sections;
    }
  
    private static classifySectionType(title: string, docType: DocumentType): string {
      const titleLower = title.toLowerCase();
      
      if (titleLower.includes('summary') || titleLower.includes('overview')) return 'summary';
      if (titleLower.includes('incident') || titleLower.includes('event')) return 'incident_details';
      if (titleLower.includes('witness') || titleLower.includes('statement')) return 'witness_info';
      if (titleLower.includes('suspect') || titleLower.includes('person of interest')) return 'suspect_info';
      if (titleLower.includes('evidence') || titleLower.includes('physical')) return 'evidence';
      if (titleLower.includes('timeline') || titleLower.includes('chronology')) return 'timeline';
      if (titleLower.includes('recommendation') || titleLower.includes('action')) return 'recommendations';
      if (titleLower.includes('conclusion') || titleLower.includes('finding')) return 'conclusions';
      
      return 'general';
    }
  
    private static async extractStructuredContent(
      text: string, 
      sections: DocumentSection[], 
      type: DocumentType
    ): Promise<StructuredContent> {
      
      return {
        rawText: text,
        sections,
        tables: this.extractTables(text),
        dates: this.extractDates(text),
        locations: this.extractLocations(text),
        people: this.extractPeople(text),
        organizations: this.extractOrganizations(text),
        vehicles: this.extractVehicles(text),
        communications: this.extractCommunications(text),
        financials: this.extractFinancials(text),
        evidence: this.extractEvidence(text)
      };
    }
  
    private static extractDates(text: string): ExtractedDate[] {
      const dates: ExtractedDate[] = [];
      const patterns = [
        // MM/DD/YYYY and variations
        /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
        /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
        // Month Day, Year
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
        // Day Month Year
        /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
        // Time patterns
        /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g,
        // Relative dates
        /\b(yesterday|today|tomorrow|last\s+\w+|next\s+\w+)\b/gi
      ];
  
      patterns.forEach((pattern, patternIndex) => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          dates.push({
            id: `date_${dates.length}`,
            originalText: match[0],
            normalizedDate: this.normalizeDateString(match[0]),
            context: this.getContext(text, match.index, 50),
            confidence: this.assessDateConfidence(match[0]),
            type: this.classifyDateType(match[0], text, match.index)
          });
        }
      });
  
      return dates;
    }
  
    private static extractLocations(text: string): ExtractedLocation[] {
      const locations: ExtractedLocation[] = [];
      const patterns = [
        // Full addresses
        /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way)\b[^.]*?(?:\d{5}(?:-\d{4})?)?/gi,
        // Intersections
        /\b[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd)\s+(?:and|&|\+)\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd)\b/gi,
        // Cities and states
        /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\b/g,
        // Business locations
        /\b(?:at|near|in front of|behind|inside|outside)\s+(?:the\s+)?([A-Z][A-Za-z\s&'-]+(?:Store|Shop|Market|Bank|Hotel|Restaurant|Bar|Club|Hospital|School|University|Building|Center|Plaza))\b/gi,
        // Landmarks and geographic features
        /\b(?:the\s+)?([A-Z][A-Za-z\s]+(?:Park|Bridge|River|Lake|Mountain|Hill|Beach|Forest|Highway|Freeway))\b/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          locations.push({
            id: `location_${locations.length}`,
            originalText: match[0],
            normalizedLocation: this.normalizeLocation(match[0]),
            context: this.getContext(text, match.index, 100),
            confidence: this.assessLocationConfidence(match[0]),
            type: this.classifyLocationType(match[0]),
            coordinates: null // Could be enhanced with geocoding
          });
        }
      });
  
      return locations;
    }
  
    private static extractPeople(text: string): ExtractedPerson[] {
      const people: ExtractedPerson[] = [];
      const patterns = [
        // Full names (First Last, First Middle Last)
        /\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15}(?:\s+[A-Z][a-z]{1,15})?)\b/g,
        // Names with titles
        /\b(Mr|Ms|Mrs|Dr|Officer|Detective|Agent|Captain|Lieutenant|Sergeant)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        // Nicknames in quotes
        /\b([A-Z][a-z]+)\s+"([A-Z][a-z]+)"\s+([A-Z][a-z]+)/g,
        // First name aka nickname Last name
        /\b([A-Z][a-z]+)\s+(?:aka|a\.k\.a\.)\s+"?([A-Z][a-z]+)"?\s+([A-Z][a-z]+)/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          // Filter out common false positives
          if (this.isLikelyPersonName(match[0])) {
            people.push({
              id: `person_${people.length}`,
              originalText: match[0],
              firstName: this.extractFirstName(match[0]),
              lastName: this.extractLastName(match[0]),
              middleName: this.extractMiddleName(match[0]),
              nickname: this.extractNickname(match[0]),
              title: this.extractTitle(match[0]),
              context: this.getContext(text, match.index, 150),
              confidence: this.assessPersonConfidence(match[0], text, match.index),
              role: this.inferPersonRole(text, match.index)
            });
          }
        }
      });
  
      return people;
    }
  
    private static extractVehicles(text: string): ExtractedVehicle[] {
      const vehicles: ExtractedVehicle[] = [];
      const patterns = [
        // License plates
        /\b[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{3,4}\b/g,
        // Make Model Year
        /\b(19|20)\d{2}\s+(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|BMW|Mercedes|Audi|Volkswagen|VW|Dodge|Plymouth|Pontiac|Buick|Cadillac|Lincoln|Jeep|GMC|Subaru|Mazda|Mitsubishi|Hyundai|Kia|Lexus|Acura|Infiniti)\s+([A-Za-z0-9\-]+)/gi,
        // Color Make Model
        /\b(red|blue|green|yellow|black|white|silver|gray|grey|brown|tan|gold|maroon|purple|orange|pink)\s+(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|BMW|Mercedes|Audi|Volkswagen|VW|Dodge|Plymouth|Pontiac|Buick|Cadillac|Lincoln|Jeep|GMC|Subaru|Mazda|Mitsubishi|Hyundai|Kia|Lexus|Acura|Infiniti)\s+([A-Za-z0-9\-]+)/gi,
        // Vehicle types
        /\b(sedan|SUV|truck|pickup|van|minivan|coupe|convertible|wagon|hatchback|motorcycle|bike)\b/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          vehicles.push({
            id: `vehicle_${vehicles.length}`,
            originalText: match[0],
            make: this.extractVehicleMake(match[0]),
            model: this.extractVehicleModel(match[0]),
            year: this.extractVehicleYear(match[0]),
            color: this.extractVehicleColor(match[0]),
            licensePlate: this.extractLicensePlate(match[0]),
            context: this.getContext(text, match.index, 100),
            confidence: this.assessVehicleConfidence(match[0])
          });
        }
      });
  
      return vehicles;
    }

    private static extractOrganizations(text: string): ExtractedOrganization[] {
      const organizations: ExtractedOrganization[] = [];
      const patterns = [
        // Government agencies
        /\b(FBI|CIA|NSA|ATF|DEA|Department of Justice|Department of Defense|Secret Service|Homeland Security)\b/gi,
        // Law enforcement
        /\b([A-Z][a-z]+\s+(?:Police|Sheriff|Department|Bureau|Agency|Office))\b/gi,
        // Medical organizations
        /\b([A-Z][a-z]+\s+(?:Hospital|Medical Center|Clinic|Health System))\b/gi,
        // Educational institutions
        /\b([A-Z][a-z]+\s+(?:University|College|School|Institute))\b/gi,
        // Corporations and businesses
        /\b([A-Z][a-z]+\s+(?:Corporation|Corp|Company|Co|Inc|LLC|Ltd|Industries|Group|Associates))\b/gi,
        // Banks and financial
        /\b([A-Z][a-z]+\s+(?:Bank|Credit Union|Financial|Insurance|Investment))\b/gi
      ];
    
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const orgName = match[0].trim();
          if (orgName.length > 3) { // Minimum length filter
            organizations.push({
              id: `org_${organizations.length}`,
              name: orgName,
              type: this.classifyOrganizationType(orgName),
              context: this.getContext(text, match.index, 100),
              confidence: this.assessOrganizationConfidence(orgName)
            });
          }
        }
      });
    
      return organizations;
    }
    
    private static classifyOrganizationType(orgName: string): string {
      const nameLower = orgName.toLowerCase();
      
      if (nameLower.includes('police') || nameLower.includes('sheriff') || nameLower.includes('fbi') || nameLower.includes('cia')) {
        return 'law_enforcement';
      }
      if (nameLower.includes('hospital') || nameLower.includes('medical') || nameLower.includes('clinic')) {
        return 'medical';
      }
      if (nameLower.includes('university') || nameLower.includes('college') || nameLower.includes('school')) {
        return 'educational';
      }
      if (nameLower.includes('bank') || nameLower.includes('financial') || nameLower.includes('insurance')) {
        return 'financial';
      }
      if (nameLower.includes('corp') || nameLower.includes('company') || nameLower.includes('inc')) {
        return 'corporation';
      }
      
      return 'general';
    }
    
    private static assessOrganizationConfidence(orgName: string): number {
      // Higher confidence for well-known organizations
      const wellKnownOrgs = ['FBI', 'CIA', 'Police', 'Hospital', 'University', 'Bank'];
      if (wellKnownOrgs.some(org => orgName.toLowerCase().includes(org.toLowerCase()))) {
        return 90;
      }
      
      // Medium confidence for properly formatted org names
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(orgName)) {
        return 75;
      }
      
      return 60;
    }
  
    private static extractCommunications(text: string): ExtractedCommunication[] {
      const communications: ExtractedCommunication[] = [];
      const patterns = [
        // Phone numbers
        /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        // Email addresses
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // Social media handles
        /\b@[A-Za-z0-9_]+\b/g,
        // Messaging apps
        /\b(?:WhatsApp|Telegram|Signal|Snapchat|Instagram|Facebook)\s+(?:message|chat|conversation)/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          communications.push({
            id: `comm_${communications.length}`,
            originalText: match[0],
            type: this.classifyCommunicationType(match[0]),
            normalizedValue: this.normalizeCommunication(match[0]),
            context: this.getContext(text, match.index, 100),
            confidence: this.assessCommunicationConfidence(match[0])
          });
        }
      });
  
      return communications;
    }
  
    private static extractFinancials(text: string): ExtractedFinancial[] {
      const financials: ExtractedFinancial[] = [];
      const patterns = [
        // Currency amounts
        /\$\s*([0-9,]+\.?[0-9]*)/g,
        // Bank account numbers
        /\b(?:account|acct)\.?\s*#?\s*([0-9\-]{8,17})\b/gi,
        // Credit card patterns
        /\b[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b/g,
        // Check numbers
        /\b(?:check|ck)\.?\s*#?\s*([0-9]{3,8})\b/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          financials.push({
            id: `financial_${financials.length}`,
            originalText: match[0],
            type: this.classifyFinancialType(match[0]),
            amount: this.extractAmount(match[0]),
            context: this.getContext(text, match.index, 100),
            confidence: this.assessFinancialConfidence(match[0])
          });
        }
      });
  
      return financials;
    }
  
    private static extractEvidence(text: string): ExtractedEvidence[] {
      const evidence: ExtractedEvidence[] = [];
      const patterns = [
        // Evidence numbers
        /\b(?:evidence|exhibit)\s*#?\s*([A-Z0-9\-]+)/gi,
        // Physical evidence descriptions
        /\b(DNA|fingerprint|blood|fiber|bullet|casing|weapon|knife|gun|firearm)\b[^.]*?(?=\.|;|\n|$)/gi,
        // Digital evidence
        /\b(hard drive|USB|SD card|computer|laptop|phone|tablet|camera|surveillance|CCTV|video|audio|recording)\b[^.]*?(?=\.|;|\n|$)/gi
      ];
  
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          evidence.push({
            id: `evidence_${evidence.length}`,
            originalText: match[0],
            type: this.classifyEvidenceType(match[0]),
            description: match[0],
            context: this.getContext(text, match.index, 150),
            confidence: this.assessEvidenceConfidence(match[0])
          });
        }
      });
  
      return evidence;
    }
  
    // Utility methods for context and confidence assessment
    
    private static getContext(text: string, index: number, radius: number): string {
      const start = Math.max(0, index - radius);
      const end = Math.min(text.length, index + radius);
      return text.substring(start, end).trim();
    }
  
    private static isLikelyPersonName(name: string): boolean {
      const commonWords = ['case', 'report', 'date', 'time', 'street', 'avenue', 'police', 'department'];
      const nameLower = name.toLowerCase();
      return !commonWords.some(word => nameLower.includes(word)) && 
             name.length > 3 && 
             /^[A-Z][a-z]/.test(name);
    }
  
    // Assessment methods for confidence scoring
    
    private static assessDateConfidence(dateStr: string): number {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return 90;
      if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i.test(dateStr)) return 95;
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(dateStr)) return 85;
      return 70;
    }
  
    private static assessLocationConfidence(location: string): number {
      if (/\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd)/.test(location)) return 90;
      if (/[A-Za-z\s]+,\s*[A-Z]{2}/.test(location)) return 85;
      return 70;
    }
  
    private static assessPersonConfidence(name: string, text: string, index: number): number {
      const context = this.getContext(text, index, 100).toLowerCase();
      
      // Higher confidence if surrounded by person-related context
      if (context.includes('witness') || context.includes('suspect') || context.includes('victim')) return 95;
      if (context.includes('interviewed') || context.includes('statement')) return 90;
      if (context.includes('officer') || context.includes('detective')) return 85;
      
      // Title present increases confidence
      if (/^(Mr|Ms|Mrs|Dr|Officer|Detective)\.?\s+/.test(name)) return 90;
      
      return 75;
    }
  
    private static assessVehicleConfidence(vehicle: string): number {
      if (/\b(19|20)\d{2}\s+/.test(vehicle)) return 90; // Has year
      if (/\b(red|blue|green|yellow|black|white|silver|gray|grey|brown)\s+/i.test(vehicle)) return 85; // Has color
      if (/\b[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{3,4}\b/.test(vehicle)) return 95; // License plate
      return 70;
    }
  
    private static assessCommunicationConfidence(comm: string): number {
      if (/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(comm)) return 95; // Phone
      if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(comm)) return 95; // Email
      return 80;
    }
  
    private static assessFinancialConfidence(financial: string): number {
      if (/^\$\s*[0-9,]+\.?[0-9]*$/.test(financial)) return 90; // Currency
      if (/\b[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b/.test(financial)) return 85; // Card
      return 75;
    }
  
    private static assessEvidenceConfidence(evidence: string): number {
      if (evidence.toLowerCase().includes('evidence #') || evidence.toLowerCase().includes('exhibit #')) return 95;
      if (/\b(DNA|fingerprint|blood|bullet|weapon)\b/i.test(evidence)) return 90;
      return 80;
    }
  
    // Classification and extraction helper methods
    
    private static classifyDateType(date: string, text: string, index: number): string {
      const context = this.getContext(text, index, 50).toLowerCase();
      if (context.includes('incident') || context.includes('occurred')) return 'incident_date';
      if (context.includes('interview') || context.includes('statement')) return 'interview_date';
      if (context.includes('arrest')) return 'arrest_date';
      if (context.includes('report')) return 'report_date';
      return 'general_date';
    }
  
    private static classifyLocationType(location: string): string {
      const locLower = location.toLowerCase();
      if (/\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd)/.test(locLower)) return 'address';
      if (locLower.includes('park') || locLower.includes('bridge')) return 'landmark';
      if (locLower.includes('store') || locLower.includes('restaurant')) return 'business';
      return 'general_location';
    }
  
    private static classifyCommunicationType(comm: string): string {
      if (/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(comm)) return 'phone';
      if (/@/.test(comm)) return 'email';
      if (comm.startsWith('@')) return 'social_media';
      return 'other';
    }
  
    private static classifyFinancialType(financial: string): string {
    if (financial.startsWith('$')) return 'amount';
      if (/\b[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b/.test(financial)) return 'card_number';
      if (financial.toLowerCase().includes('account')) return 'account_number';
      if (financial.toLowerCase().includes('check')) return 'check_number';
      return 'other';
    }
  
    private static classifyEvidenceType(evidence: string): string {
      const evidenceLower = evidence.toLowerCase();
      if (evidenceLower.includes('dna') || evidenceLower.includes('blood')) return 'biological';
      if (evidenceLower.includes('fingerprint')) return 'fingerprint';
      if (evidenceLower.includes('bullet') || evidenceLower.includes('weapon')) return 'ballistic';
      if (evidenceLower.includes('digital') || evidenceLower.includes('computer')) return 'digital';
      if (evidenceLower.includes('video') || evidenceLower.includes('audio')) return 'audiovisual';
      return 'physical';
    }
  
    // Additional helper methods for normalization and extraction
    
    private static normalizeDateString(date: string): string {
      // Implement date normalization logic
      return date;
    }
  
    private static normalizeLocation(location: string): string {
      // Implement location normalization logic
      return location;
    }
  
    private static normalizeCommunication(comm: string): string {
      // Implement communication normalization logic
      return comm;
    }
  
    private static extractFirstName(name: string): string {
      return name.split(' ')[0];
    }
  
    private static extractLastName(name: string): string {
      const parts = name.split(' ');
      return parts[parts.length - 1];
    }
  
    private static extractMiddleName(name: string): string | null {
      const parts = name.split(' ');
      return parts.length > 2 ? parts[1] : null;
    }
  
    private static extractNickname(name: string): string | null {
      const nickMatch = name.match(/"([^"]+)"/);
      return nickMatch ? nickMatch[1] : null;
    }
  
    private static extractTitle(name: string): string | null {
      const titleMatch = name.match(/^(Mr|Ms|Mrs|Dr|Officer|Detective|Agent|Captain|Lieutenant|Sergeant)\.?\s+/i);
      return titleMatch ? titleMatch[1] : null;
    }
  
    private static extractVehicleMake(vehicle: string): string | null {
      const makes = ['Ford', 'Chevrolet', 'Chevy', 'Toyota', 'Honda', 'Nissan', 'BMW', 'Mercedes'];
      for (const make of makes) {
        if (vehicle.toLowerCase().includes(make.toLowerCase())) return make;
      }
      return null;
    }
  
    private static extractVehicleModel(vehicle: string): string | null {
      // Implement vehicle model extraction logic
      return null;
    }
  
    private static extractVehicleYear(vehicle: string): number | null {
      const yearMatch = vehicle.match(/\b(19|20)\d{2}\b/);
      return yearMatch ? parseInt(yearMatch[0]) : null;
    }
  
    private static extractVehicleColor(vehicle: string): string | null {
      const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'silver', 'gray', 'grey', 'brown'];
      for (const color of colors) {
        if (vehicle.toLowerCase().includes(color)) return color;
      }
      return null;
    }
  
    private static extractLicensePlate(vehicle: string): string | null {
      const plateMatch = vehicle.match(/\b[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{3,4}\b/);
      return plateMatch ? plateMatch[0] : null;
    }
  
    private static extractAmount(financial: string): number | null {
      const amountMatch = financial.match(/\$\s*([0-9,]+\.?[0-9]*)/);
      if (amountMatch) {
        return parseFloat(amountMatch[1].replace(/,/g, ''));
      }
      return null;
    }
  
    private static inferPersonRole(text: string, index: number): string {
      const context = this.getContext(text, index, 100).toLowerCase();
      if (context.includes('suspect') || context.includes('accused')) return 'suspect';
      if (context.includes('witness') || context.includes('saw')) return 'witness';
      if (context.includes('victim')) return 'victim';
      if (context.includes('officer') || context.includes('detective')) return 'law_enforcement';
      return 'unknown';
    }
  
    private static extractTables(text: string): ExtractedTable[] {
      // Implement table extraction logic for structured data
      return [];
    }
  
    private static extractEntitiesWithContext(content: StructuredContent): Promise<ExtractedEntity[]> {
      // Combine all extracted entities into unified list with relationships
      const entities: ExtractedEntity[] = [];
      
      // Convert dates to entities
      content.dates.forEach(date => {
        entities.push({
          id: date.id,
          type: 'event',
          name: date.originalText,
          aliases: [],
          attributes: { normalizedDate: date.normalizedDate, type: date.type },
          mentions: [{ document: 'current', context: date.context, confidence: date.confidence }],
          confidence: date.confidence,
          sources: ['current_document']
        });
      });
  
      // Convert people to entities
      content.people.forEach(person => {
        entities.push({
          id: person.id,
          type: 'person',
          name: `${person.firstName} ${person.lastName}`.trim(),
          aliases: person.nickname ? [person.nickname] : [],
          attributes: { 
            firstName: person.firstName, 
            lastName: person.lastName, 
            title: person.title,
            role: person.role 
          },
          mentions: [{ document: 'current', context: person.context, confidence: person.confidence }],
          confidence: person.confidence,
          sources: ['current_document']
        });
      });
  
      // Add other entity types...
      
      return Promise.resolve(entities);
    }
  
    private static extractDocumentRelationships(entities: ExtractedEntity[], content: StructuredContent): DocumentRelationship[] {
      // Extract relationships between entities within the document
      return [];
    }
  
    private static assessDocumentQuality(content: StructuredContent, entities: ExtractedEntity[]): number {
      // Calculate overall document quality score based on completeness and clarity
      let score = 50; // Base score
      
      if (entities.length > 5) score += 20; // Rich in entities
      if (content.dates.length > 2) score += 15; // Good temporal information
      if (content.locations.length > 2) score += 10; // Good location data
      if (content.people.length > 2) score += 15; // Multiple people mentioned
      
      return Math.min(100, score);
    }
  
    private static extractMetadata(file: File, text: string): DocumentMetadata {
      return {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        wordCount: text.split(/\s+/).length,
        pageCount: (text.match(/--- PAGE \d+ ---/g) || []).length || 1,
        extractedAt: new Date().toISOString(),
        language: 'en', // Could be detected
        encoding: 'utf-8'
      };
    }
  
    private static generateDocumentId(file: File): string {
      return `doc_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  }
  
  // Type definitions
  type DocumentType = 'police_report' | 'interview' | 'witness_statement' | 'evidence_log' | 
                     'medical_report' | 'financial_record' | 'communication_record' | 
                     'surveillance_report' | 'general_document';
  
  interface DocumentSection {
    id: string;
    title: string;
    startIndex: number;
    type: string;
    content?: string;
  }
  
  interface ExtractedTable {
    id: string;
    headers: string[];
    rows: string[][];
    context: string;
  }
  
  interface ExtractedDate {
    id: string;
    originalText: string;
    normalizedDate: string;
    context: string;
    confidence: number;
    type: string;
  }
  
  interface ExtractedLocation {
    id: string;
    originalText: string;
    normalizedLocation: string;
    context: string;
    confidence: number;
    type: string;
    coordinates: { lat: number; lng: number } | null;
  }
  
  interface ExtractedPerson {
    id: string;
    originalText: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    nickname: string | null;
    title: string | null;
    context: string;
    confidence: number;
    role: string;
  }
  
  interface ExtractedOrganization {
    id: string;
    name: string;
    type: string;
    context: string;
    confidence: number;
  }
  
  interface ExtractedVehicle {
    id: string;
    originalText: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    licensePlate: string | null;
    context: string;
    confidence: number;
  }
  
  interface ExtractedCommunication {
    id: string;
    originalText: string;
    type: string;
    normalizedValue: string;
    context: string;
    confidence: number;
  }
  
  interface ExtractedFinancial {
    id: string;
    originalText: string;
    type: string;
    amount: number | null;
    context: string;
    confidence: number;
  }
  
  interface ExtractedEvidence {
    id: string;
    originalText: string;
    type: string;
    description: string;
    context: string;
    confidence: number;
  }
  
  interface ExtractedEntity {
    id: string;
    type: string;
    name: string;
    aliases: string[];
    attributes: Record<string, any>;
    mentions: EntityMention[];
    confidence: number;
    sources: string[];
  }
  
  interface EntityMention {
    document: string;
    context: string;
    confidence: number;
  }
  
  interface DocumentRelationship {
    fromEntity: string;
    toEntity: string;
    type: string;
    confidence: number;
  }
  
  interface DocumentMetadata {
    filename: string;
    fileSize: number;
    fileType: string;
    wordCount: number;
    pageCount: number;
    extractedAt: string;
    language: string;
    encoding: string;
  }