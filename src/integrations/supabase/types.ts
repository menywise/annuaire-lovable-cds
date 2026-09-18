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
      audit_findings: {
        Row: {
          audit_id: string
          code: string
          created_at: string
          description: string
          id: string
          location: string
          resolved: boolean
          severity: string
        }
        Insert: {
          audit_id: string
          code: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          resolved?: boolean
          severity?: string
        }
        Update: {
          audit_id?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          created_at: string
          id: string
          label: string
          max_score: number
          performed_at: string
          score: number
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          max_score?: number
          performed_at?: string
          score?: number
          summary?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          max_score?: number
          performed_at?: string
          score?: number
          summary?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          approved: boolean
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          approved?: boolean
          author_id: string
          author_name?: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          approved?: boolean
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string
          cover_url: string | null
          created_at: string
          excerpt: string
          id: string
          published: boolean
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          position: number
          published: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_follows: {
        Row: {
          created_at: string
          id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_follows_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_likes: {
        Row: {
          created_at: string
          id: string
          reply_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_likes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          accepted: boolean
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          accepted?: boolean
          author_id: string
          author_name?: string
          content: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          accepted?: boolean
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          author_id: string
          author_name: string
          category_id: string | null
          content: string
          created_at: string
          id: string
          last_activity_at: string
          locked: boolean
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id: string
          author_name?: string
          category_id?: string | null
          content: string
          created_at?: string
          id?: string
          last_activity_at?: string
          locked?: boolean
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string
          author_name?: string
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          locked?: boolean
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      masterplan_sections: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          accepts_messages: boolean
          avatar_url: string | null
          bio: string
          created_at: string
          display_name: string
          job_title: string
          listed: boolean
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accepts_messages?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          job_title?: string
          listed?: boolean
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accepts_messages?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          job_title?: string
          listed?: boolean
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          consent_at: string
          created_at: string
          email: string
          first_name: string | null
          id: string
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          consent_at?: string
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          consent_at?: string
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string
          currency: string
          features: Json
          highlighted: boolean
          id: string
          name: string
          period: string
          position: number
          price_cents: number
          tagline: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string
          currency?: string
          features?: Json
          highlighted?: boolean
          id?: string
          name: string
          period?: string
          position?: number
          price_cents?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string
          currency?: string
          features?: Json
          highlighted?: boolean
          id?: string
          name?: string
          period?: string
          position?: number
          price_cents?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved: boolean
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          rating: number
          title: string
        }
        Insert: {
          approved?: boolean
          author_id: string
          author_name?: string
          content: string
          created_at?: string
          id?: string
          rating: number
          title?: string
        }
        Update: {
          approved?: boolean
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          rating?: number
          title?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          created_at: string
          description: string
          id: string
          lot: string
          position: number
          priority: string
          public_visible: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lot?: string
          position?: number
          priority?: string
          public_visible?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lot?: string
          position?: number
          priority?: string
          public_visible?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      template_checks: {
        Row: {
          area: string
          code: string
          created_at: string
          evidence: string
          id: string
          label: string
          position: number
          requirement: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          area: string
          code: string
          created_at?: string
          evidence?: string
          id?: string
          label: string
          position?: number
          requirement?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string
          code?: string
          created_at?: string
          evidence?: string
          id?: string
          label?: string
          position?: number
          requirement?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          approved: boolean
          author_id: string | null
          author_name: string
          avatar_url: string | null
          company: string
          content: string
          created_at: string
          featured: boolean
          id: string
          outcome: string
          position: number
          role_title: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          author_id?: string | null
          author_name: string
          avatar_url?: string | null
          company?: string
          content: string
          created_at?: string
          featured?: boolean
          id?: string
          outcome?: string
          position?: number
          role_title?: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          author_id?: string | null
          author_name?: string
          avatar_url?: string | null
          company?: string
          content?: string
          created_at?: string
          featured?: boolean
          id?: string
          outcome?: string
          position?: number
          role_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_current_user: {
        Args: { _full_name?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      forum_top_members: {
        Args: { _since?: string }
        Returns: {
          display_name: string
          likes: number
          replies: number
          score: number
          topics: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_topic_views: { Args: { _topic_id: string }; Returns: undefined }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
