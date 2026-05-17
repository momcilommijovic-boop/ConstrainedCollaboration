export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type CellStatus = 'FORMING' | 'ACTIVE' | 'COMPLETE' | 'ABANDONED'
export type CellStage = 'FORMING' | 'BRIEFING' | 'SUBMISSION' | 'EDITING' | 'PUBLICATION' | 'PROMOTION' | 'COMPLETE'
export type MemberRole = 'MEMBER' | 'EDITOR' | 'WRITER' | 'ILLUSTRATOR'
export type MemberStatus = 'ACTIVE' | 'WARNED' | 'SUSPENDED' | 'KICKED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'REWORK_REQUESTED'
export type PublicationStatus = 'ASSEMBLING' | 'PUBLISHED' | 'PROMOTION_OPEN' | 'ARCHIVED'
export type PromotionStatus = 'PENDING' | 'VERIFIED' | 'MISSED'

export type MeritHistoryEntry = {
  event: string
  delta: number
  ts: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          bio: string | null
          avatar_url: string | null
          merit_score: number
          merit_history: Json
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          merit_score?: number
          merit_history?: Json
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          username?: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          merit_score?: number
          merit_history?: Json
          is_admin?: boolean
        }
        Relationships: []
      }
      strategy_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          default_config: Json
          schema: Json | null
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          default_config: Json
          schema?: Json | null
        }
        Update: {
          name?: string
          description?: string | null
          default_config?: Json
          schema?: Json | null
        }
        Relationships: []
      }
      cells: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          strategy_id: string
          strategy_config: Json
          status: string
          owner_id: string
          current_stage: string
          stage_deadline: string | null
          member_cap: number
          min_members: number
          current_cycle: number
          is_recurring: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          strategy_id: string
          strategy_config: Json
          status?: string
          owner_id: string
          current_stage?: string
          stage_deadline?: string | null
          member_cap?: number
          min_members?: number
          current_cycle?: number
          is_recurring?: boolean
          created_at?: string
        }
        Update: {
          slug?: string
          title?: string
          description?: string | null
          strategy_id?: string
          strategy_config?: Json
          status?: string
          owner_id?: string
          current_stage?: string
          stage_deadline?: string | null
          member_cap?: number
          min_members?: number
          current_cycle?: number
          is_recurring?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'cells_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cells_strategy_id_fkey'
            columns: ['strategy_id']
            isOneToOne: false
            referencedRelation: 'strategy_templates'
            referencedColumns: ['id']
          }
        ]
      }
      cell_members: {
        Row: {
          id: string
          cell_id: string
          user_id: string
          role: string
          status: string
          joined_at: string
        }
        Insert: {
          id?: string
          cell_id: string
          user_id: string
          role?: string
          status?: string
          joined_at?: string
        }
        Update: {
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cell_members_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cell_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      briefs: {
        Row: {
          id: string
          cell_id: string
          cycle: number
          editor_id: string
          title: string
          theme: string
          guidance: string
          word_count_min: number
          word_count_max: number
          slots: number
          published_at: string
          deadline: string
        }
        Insert: {
          id?: string
          cell_id: string
          cycle?: number
          editor_id: string
          title: string
          theme: string
          guidance: string
          word_count_min?: number
          word_count_max?: number
          slots: number
          published_at?: string
          deadline: string
        }
        Update: {
          title?: string
          theme?: string
          guidance?: string
          word_count_min?: number
          word_count_max?: number
          slots?: number
          deadline?: string
        }
        Relationships: [
          {
            foreignKeyName: 'briefs_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'briefs_editor_id_fkey'
            columns: ['editor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      invitations: {
        Row: {
          id: string
          brief_id: string
          cell_id: string
          invitee_id: string
          status: string
          sent_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          brief_id: string
          cell_id: string
          invitee_id: string
          status?: string
          sent_at?: string
          responded_at?: string | null
        }
        Update: {
          status?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_invitee_id_fkey'
            columns: ['invitee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      submissions: {
        Row: {
          id: string
          brief_id: string
          cell_id: string
          author_id: string
          title: string | null
          body: string | null
          word_count: number | null
          file_url: string | null
          status: string
          editor_note: string | null
          submitted_at: string | null
          reviewed_at: string | null
          cycle: number
        }
        Insert: {
          id?: string
          brief_id: string
          cell_id: string
          author_id: string
          title?: string | null
          body?: string | null
          word_count?: number | null
          file_url?: string | null
          status?: string
          editor_note?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          cycle?: number
        }
        Update: {
          title?: string | null
          body?: string | null
          word_count?: number | null
          file_url?: string | null
          status?: string
          editor_note?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'submissions_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      publications: {
        Row: {
          id: string
          cell_id: string
          cycle: number
          brief_id: string
          cover_image_url: string | null
          selected_submission_ids: string[]
          assembled_by: string
          published_at: string | null
          promotion_deadline: string | null
          status: string
        }
        Insert: {
          id?: string
          cell_id: string
          cycle: number
          brief_id: string
          cover_image_url?: string | null
          selected_submission_ids?: string[]
          assembled_by: string
          published_at?: string | null
          promotion_deadline?: string | null
          status?: string
        }
        Update: {
          cover_image_url?: string | null
          selected_submission_ids?: string[]
          published_at?: string | null
          promotion_deadline?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'publications_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'publications_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'publications_assembled_by_fkey'
            columns: ['assembled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      promotion_records: {
        Row: {
          id: string
          publication_id: string
          user_id: string
          evidence_url: string | null
          submitted_at: string | null
          status: string
        }
        Insert: {
          id?: string
          publication_id: string
          user_id: string
          evidence_url?: string | null
          submitted_at?: string | null
          status?: string
        }
        Update: {
          evidence_url?: string | null
          submitted_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promotion_records_publication_id_fkey'
            columns: ['publication_id']
            isOneToOne: false
            referencedRelation: 'publications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promotion_records_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      penalty_log: {
        Row: {
          id: string
          cell_id: string
          user_id: string
          reason: string
          merit_delta: number
          stage: string | null
          cycle: number | null
          auto: boolean
          created_at: string
        }
        Insert: {
          id?: string
          cell_id: string
          user_id: string
          reason: string
          merit_delta: number
          stage?: string | null
          cycle?: number | null
          auto?: boolean
          created_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: [
          {
            foreignKeyName: 'penalty_log_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'penalty_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      system_log: {
        Row: {
          id: string
          event_type: string
          cell_id: string | null
          user_id: string | null
          payload: Json | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          cell_id?: string | null
          user_id?: string | null
          payload?: Json | null
          error?: string | null
          created_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      is_cell_member: {
        Args: { p_cell_id: string }
        Returns: boolean
      }
      is_cell_editor: {
        Args: { p_cell_id: string }
        Returns: boolean
      }
      is_cell_owner: {
        Args: { p_cell_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
