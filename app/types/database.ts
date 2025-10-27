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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_agency_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
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
