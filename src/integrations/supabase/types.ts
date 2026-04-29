export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      shelby_deployments: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          message: string
          project_id: string
          status: string
          trigger: string
          version_url: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          message?: string
          project_id: string
          status: string
          trigger?: string
          version_url: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          status?: string
          trigger?: string
          version_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelby_deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "shelby_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shelby_domain_mappings: {
        Row: {
          content_hash: string
          created_at: string
          domain: string
          id: string
          kv_key: string
          project_id: string
          slug: string
          status: string
          target: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          domain: string
          id?: string
          kv_key: string
          project_id: string
          slug: string
          status?: string
          target?: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          domain?: string
          id?: string
          kv_key?: string
          project_id?: string
          slug?: string
          status?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelby_domain_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "shelby_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shelby_github_accounts: {
        Row: {
          access_token_encrypted: string
          account_type: string
          avatar_url: string | null
          connected_at: string
          created_at: string
          github_user_id: number
          html_url: string | null
          id: string
          login: string
          name: string | null
          owner_id: string
          scopes: string[]
          token_last_four: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          account_type?: string
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          github_user_id: number
          html_url?: string | null
          id?: string
          login: string
          name?: string | null
          owner_id?: string
          scopes?: string[]
          token_last_four?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          account_type?: string
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          github_user_id?: number
          html_url?: string | null
          id?: string
          login?: string
          name?: string | null
          owner_id?: string
          scopes?: string[]
          token_last_four?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shelby_github_connections: {
        Row: {
          account: string
          branch: string
          created_at: string
          id: string
          last_push_at: string | null
          project_id: string
          repository: string
          updated_at: string
          webhook_status: string
          workflow_file: string
        }
        Insert: {
          account: string
          branch?: string
          created_at?: string
          id?: string
          last_push_at?: string | null
          project_id: string
          repository: string
          updated_at?: string
          webhook_status?: string
          workflow_file?: string
        }
        Update: {
          account?: string
          branch?: string
          created_at?: string
          id?: string
          last_push_at?: string | null
          project_id?: string
          repository?: string
          updated_at?: string
          webhook_status?: string
          workflow_file?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelby_github_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "shelby_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shelby_github_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          owner_id: string
          redirect_to: string
          state: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          owner_id?: string
          redirect_to?: string
          state: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          owner_id?: string
          redirect_to?: string
          state?: string
        }
        Relationships: []
      }
      shelby_projects: {
        Row: {
          build_output: string
          chain: string
          content_hash: string
          created_at: string
          deployed_at: string
          description: string
          files: Json
          framework: string
          id: string
          latest_version_url: string
          name: string
          owner_id: string
          size_bytes: number
          slug: string
          source: string
          status: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          build_output?: string
          chain?: string
          content_hash: string
          created_at?: string
          deployed_at?: string
          description?: string
          files?: Json
          framework?: string
          id?: string
          latest_version_url: string
          name: string
          owner_id?: string
          size_bytes?: number
          slug: string
          source?: string
          status?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          build_output?: string
          chain?: string
          content_hash?: string
          created_at?: string
          deployed_at?: string
          description?: string
          files?: Json
          framework?: string
          id?: string
          latest_version_url?: string
          name?: string
          owner_id?: string
          size_bytes?: number
          slug?: string
          source?: string
          status?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      shelby_wallet_connections: {
        Row: {
          address: string
          chain: string
          created_at: string
          id: string
          owner_id: string
          status: string
          updated_at: string
          wallet_provider: string
        }
        Insert: {
          address: string
          chain: string
          created_at?: string
          id?: string
          owner_id?: string
          status?: string
          updated_at?: string
          wallet_provider: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          id?: string
          owner_id?: string
          status?: string
          updated_at?: string
          wallet_provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
