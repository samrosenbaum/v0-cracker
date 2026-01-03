export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          role: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          role?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      case_analysis: {
        Row: {
          agency_id: string
          analysis_data: Json
          analysis_type: string
          case_id: string
          confidence_score: number | null
          created_at: string
          id: string
          updated_at: string
          used_prompt: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string
          analysis_data: Json
          analysis_type: string
          case_id: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          used_prompt?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          analysis_data?: Json
          analysis_type?: string
          case_id?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          used_prompt?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_analysis_agency_id_fkey"
            columns: ["agency_id"]
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_analysis_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_analysis_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document_type: string
          file_name: string
          id: string
          metadata: Json
          storage_path: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          document_type: string
          file_name: string
          id?: string
          metadata?: Json
          storage_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          metadata?: Json
          storage_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      case_files: {
        Row: {
          case_id: string
          checksum: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          checksum?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          checksum?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_files_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      cases: {
        Row: {
          agency_id: string
          ai_prompt: string | null
          created_at: string
          description: string | null
          id: string
          lastUpdated: string
          name: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
          assignedTo: string | null
        }
        Insert: {
          agency_id?: string
          ai_prompt?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lastUpdated?: string
          name: string
          priority?: string
          status?: string
          updated_at?: string
          user_id: string
          assignedTo?: string | null
        }
        Update: {
          agency_id?: string
          ai_prompt?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lastUpdated?: string
          name?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string
          assignedTo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_agency_id_fkey"
            columns: ["agency_id"]
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      evidence_events: {
        Row: {
          case_id: string
          created_at: string
          date: string
          description: string
          id: string
          location: string | null
          personnel: string | null
          priority: string | null
          related_events: string[] | null
          sample_id: string | null
          status: string | null
          tags: string[] | null
          time: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          date: string
          description: string
          id?: string
          location?: string | null
          personnel?: string | null
          priority?: string | null
          related_events?: string[] | null
          sample_id?: string | null
          status?: string | null
          tags?: string[] | null
          time?: string | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          location?: string | null
          personnel?: string | null
          priority?: string | null
          related_events?: string[] | null
          sample_id?: string | null
          status?: string | null
          tags?: string[] | null
          time?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_events_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      quality_flags: {
        Row: {
          affected_findings: string[]
          analysis_id: string | null
          case_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          recommendation: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: "low" | "medium" | "high" | "critical"
          status: "active" | "reviewed" | "resolved" | "dismissed"
          title: string
          type:
            | "low_confidence"
            | "no_suspects"
            | "missing_data"
            | "inconsistency"
            | "incomplete_analysis"
          updated_at: string
        }
        Insert: {
          affected_findings?: string[]
          analysis_id?: string | null
          case_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          recommendation?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: "low" | "medium" | "high" | "critical"
          status?: "active" | "reviewed" | "resolved" | "dismissed"
          title: string
          type:
            | "low_confidence"
            | "no_suspects"
            | "missing_data"
            | "inconsistency"
            | "incomplete_analysis"
          updated_at?: string
        }
        Update: {
          affected_findings?: string[]
          analysis_id?: string | null
          case_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          recommendation?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: "low" | "medium" | "high" | "critical"
          status?: "active" | "reviewed" | "resolved" | "dismissed"
          title?: string
          type?:
            | "low_confidence"
            | "no_suspects"
            | "missing_data"
            | "inconsistency"
            | "incomplete_analysis"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_flags_analysis_id_fkey"
            columns: ["analysis_id"]
            referencedRelation: "case_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_flags_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      suspects: {
        Row: {
          alias: string | null
          analysis_id: string | null
          case_id: string
          confidence: number | null
          created_at: string
          description: string | null
          evidence: Json
          id: string
          location: string | null
          metadata: Json
          name: string
          notes: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          alias?: string | null
          analysis_id?: string | null
          case_id: string
          confidence?: number | null
          created_at?: string
          description?: string | null
          evidence?: Json
          id?: string
          location?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          alias?: string | null
          analysis_id?: string | null
          case_id?: string
          confidence?: number | null
          created_at?: string
          description?: string | null
          evidence?: Json
          id?: string
          location?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suspects_analysis_id_fkey"
            columns: ["analysis_id"]
            referencedRelation: "case_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspects_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      processing_jobs: {
        Row: {
          id: string
          case_id: string
          job_type: "document_extraction" | "ai_analysis" | "embedding_generation"
          total_units: number
          completed_units: number
          failed_units: number
          status: "pending" | "running" | "completed" | "failed" | "cancelled"
          progress_percentage: number
          estimated_completion: string | null
          started_at: string | null
          completed_at: string | null
          error_summary: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          job_type: "document_extraction" | "ai_analysis" | "embedding_generation"
          total_units?: number
          completed_units?: number
          failed_units?: number
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          estimated_completion?: string | null
          started_at?: string | null
          completed_at?: string | null
          error_summary?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          job_type?: "document_extraction" | "ai_analysis" | "embedding_generation"
          total_units?: number
          completed_units?: number
          failed_units?: number
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          estimated_completion?: string | null
          started_at?: string | null
          completed_at?: string | null
          error_summary?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      document_chunks: {
        Row: {
          id: string
          case_file_id: string
          processing_job_id: string | null
          chunk_index: number
          chunk_type: "page" | "section" | "paragraph" | "sliding-window"
          content: string | null
          content_embedding: string | null
          content_length: number | null
          extraction_confidence: number | null
          extraction_method: "pdf-parse" | "pdfjs-dist" | "ocr-tesseract" | "ocr-google" | "whisper-transcription" | "direct-read" | "cached" | null
          metadata: Json
          processing_status: "pending" | "processing" | "completed" | "failed" | "skipped"
          processing_attempts: number
          error_log: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_file_id: string
          processing_job_id?: string | null
          chunk_index: number
          chunk_type?: "page" | "section" | "paragraph" | "sliding-window"
          content?: string | null
          content_embedding?: string | null
          extraction_confidence?: number | null
          extraction_method?: "pdf-parse" | "pdfjs-dist" | "ocr-tesseract" | "ocr-google" | "whisper-transcription" | "direct-read" | "cached" | "mammoth-docx" | "xlsx-parse" | "csv-parse" | null
          metadata?: Json
          processing_status?: "pending" | "processing" | "completed" | "failed" | "skipped"
          processing_attempts?: number
          error_log?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_file_id?: string
          processing_job_id?: string | null
          chunk_index?: number
          chunk_type?: "page" | "section" | "paragraph" | "sliding-window"
          content?: string | null
          content_embedding?: string | null
          extraction_confidence?: number | null
          extraction_method?: "pdf-parse" | "pdfjs-dist" | "ocr-tesseract" | "ocr-google" | "whisper-transcription" | "direct-read" | "cached" | "mammoth-docx" | "xlsx-parse" | "csv-parse" | null
          metadata?: Json
          processing_status?: "pending" | "processing" | "completed" | "failed" | "skipped"
          processing_attempts?: number
          error_log?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_case_file_id_fkey"
            columns: ["case_file_id"]
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_processing_job_id_fkey"
            columns: ["processing_job_id"]
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      case_entities: {
        Row: {
          id: string
          case_id: string
          entity_type: "person" | "location" | "evidence" | "vehicle" | "organization" | "other"
          name: string
          role: string | null
          description: string | null
          image_url: string | null
          color: string | null
          icon: string | null
          metadata: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          case_id: string
          entity_type: "person" | "location" | "evidence" | "vehicle" | "organization" | "other"
          name: string
          role?: string | null
          description?: string | null
          image_url?: string | null
          color?: string | null
          icon?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          case_id?: string
          entity_type?: "person" | "location" | "evidence" | "vehicle" | "organization" | "other"
          name?: string
          role?: string | null
          description?: string | null
          image_url?: string | null
          color?: string | null
          icon?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_entities_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      case_connections: {
        Row: {
          id: string
          case_id: string
          from_entity_id: string
          to_entity_id: string
          connection_type: string
          label: string | null
          description: string | null
          confidence: "confirmed" | "probable" | "possible" | "unverified" | null
          evidence_document_ids: string[] | null
          evidence_notes: string | null
          line_style: "solid" | "dashed" | "dotted" | null
          line_color: string | null
          line_weight: number | null
          metadata: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          case_id: string
          from_entity_id: string
          to_entity_id: string
          connection_type: string
          label?: string | null
          description?: string | null
          confidence?: "confirmed" | "probable" | "possible" | "unverified" | null
          evidence_document_ids?: string[] | null
          evidence_notes?: string | null
          line_style?: "solid" | "dashed" | "dotted" | null
          line_color?: string | null
          line_weight?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          case_id?: string
          from_entity_id?: string
          to_entity_id?: string
          connection_type?: string
          label?: string | null
          description?: string | null
          confidence?: "confirmed" | "probable" | "possible" | "unverified" | null
          evidence_document_ids?: string[] | null
          evidence_notes?: string | null
          line_style?: "solid" | "dashed" | "dotted" | null
          line_color?: string | null
          line_weight?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_connections_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_connections_from_entity_id_fkey"
            columns: ["from_entity_id"]
            referencedRelation: "case_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_connections_to_entity_id_fkey"
            columns: ["to_entity_id"]
            referencedRelation: "case_entities"
            referencedColumns: ["id"]
          }
        ]
      }
      timeline_events: {
        Row: {
          id: string
          case_id: string
          event_type: "victim_action" | "suspect_movement" | "witness_account" | "evidence_found" | "phone_call" | "transaction" | "sighting" | "other"
          title: string
          description: string | null
          event_time: string | null
          event_date: string | null
          time_precision: "exact" | "approximate" | "estimated" | "unknown" | null
          time_range_start: string | null
          time_range_end: string | null
          location: string | null
          location_coordinates: string | null
          primary_entity_id: string | null
          related_entity_ids: string[] | null
          verification_status: "verified" | "unverified" | "disputed" | "false" | null
          verified_by: string | null
          confidence_score: number | null
          source_type: string | null
          source_document_id: string | null
          source_notes: string | null
          color: string | null
          icon: string | null
          metadata: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          case_id: string
          event_type: "victim_action" | "suspect_movement" | "witness_account" | "evidence_found" | "phone_call" | "transaction" | "sighting" | "other"
          title: string
          description?: string | null
          event_time?: string | null
          event_date?: string | null
          time_precision?: "exact" | "approximate" | "estimated" | "unknown" | null
          time_range_start?: string | null
          time_range_end?: string | null
          location?: string | null
          location_coordinates?: string | null
          primary_entity_id?: string | null
          related_entity_ids?: string[] | null
          verification_status?: "verified" | "unverified" | "disputed" | "false" | null
          verified_by?: string | null
          confidence_score?: number | null
          source_type?: string | null
          source_document_id?: string | null
          source_notes?: string | null
          color?: string | null
          icon?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          case_id?: string
          event_type?: "victim_action" | "suspect_movement" | "witness_account" | "evidence_found" | "phone_call" | "transaction" | "sighting" | "other"
          title?: string
          description?: string | null
          event_time?: string | null
          event_date?: string | null
          time_precision?: "exact" | "approximate" | "estimated" | "unknown" | null
          time_range_start?: string | null
          time_range_end?: string | null
          location?: string | null
          location_coordinates?: string | null
          primary_entity_id?: string | null
          related_entity_ids?: string[] | null
          verification_status?: "verified" | "unverified" | "disputed" | "false" | null
          verified_by?: string | null
          confidence_score?: number | null
          source_type?: string | null
          source_document_id?: string | null
          source_notes?: string | null
          color?: string | null
          icon?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_primary_entity_id_fkey"
            columns: ["primary_entity_id"]
            referencedRelation: "case_entities"
            referencedColumns: ["id"]
          }
        ]
      }
      alibi_entries: {
        Row: {
          id: string
          case_id: string
          subject_entity_id: string
          version_number: number
          statement_date: string
          interviewer: string | null
          alibi_start_time: string
          alibi_end_time: string
          location_claimed: string
          activity_claimed: string
          full_statement: string | null
          corroborating_entity_ids: string[] | null
          verification_status: "verified" | "partial" | "unverified" | "contradicted" | "false" | null
          verification_notes: string | null
          changes_from_previous: string | null
          inconsistencies: Json
          source_document_id: string | null
          source_notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          case_id: string
          subject_entity_id: string
          version_number?: number
          statement_date?: string
          interviewer?: string | null
          alibi_start_time: string
          alibi_end_time: string
          location_claimed: string
          activity_claimed: string
          full_statement?: string | null
          corroborating_entity_ids?: string[] | null
          verification_status?: "verified" | "partial" | "unverified" | "contradicted" | "false" | null
          verification_notes?: string | null
          changes_from_previous?: string | null
          inconsistencies?: Json
          source_document_id?: string | null
          source_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          case_id?: string
          subject_entity_id?: string
          version_number?: number
          statement_date?: string
          interviewer?: string | null
          alibi_start_time?: string
          alibi_end_time?: string
          location_claimed?: string
          activity_claimed?: string
          full_statement?: string | null
          corroborating_entity_ids?: string[] | null
          verification_status?: "verified" | "partial" | "unverified" | "contradicted" | "false" | null
          verification_notes?: string | null
          changes_from_previous?: string | null
          inconsistencies?: Json
          source_document_id?: string | null
          source_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alibi_entries_case_id_fkey"
            columns: ["case_id"]
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alibi_entries_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            referencedRelation: "case_entities"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_agency_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      search_document_chunks: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          case_id_filter?: string
          case_file_id_filter?: string
        }
        Returns: Array<{
          id: string
          case_file_id: string
          chunk_index: number
          chunk_type: string
          content: string
          metadata: Json
          similarity: number
        }>
      }
      get_processing_job_stats: {
        Args: {
          job_id_param: string
        }
        Returns: Array<{
          total_chunks: number
          completed_chunks: number
          failed_chunks: number
          pending_chunks: number
          processing_chunks: number
          total_characters: number
          avg_confidence: number
          progress_pct: number
        }>
      }
      get_case_chunks_summary: {
        Args: {
          case_id_param: string
        }
        Returns: Array<{
          total_files: number
          total_chunks: number
          completed_chunks: number
          failed_chunks: number
          total_characters: number
          avg_confidence: number
          completion_pct: number
        }>
      }
      get_entity_connections: {
        Args: {
          entity_uuid: string
        }
        Returns: Array<{
          connection_id: string
          direction: string
          connected_entity_id: string
          connected_entity_name: string
          connection_type: string
          label: string
          confidence: string
        }>
      }
      get_timeline_events_in_range: {
        Args: {
          p_case_id: string
          start_date: string
          end_date: string
        }
        Returns: Array<{
          event_id: string
          event_type: string
          title: string
          description: string
          event_time: string
          location: string
          entity_name: string
          verification_status: string
          confidence_score: number
        }>
      }
      detect_alibi_inconsistencies: {
        Args: {
          p_subject_entity_id: string
        }
        Returns: Array<{
          version_1: number
          version_2: number
          inconsistency_type: string
          details: string
        }>
      }
      get_case_board_summary: {
        Args: {
          p_case_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
