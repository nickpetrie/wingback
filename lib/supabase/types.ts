// Hand-written to match supabase/migrations/*.sql. There is no live project
// here to run `supabase gen types` against; keep this in sync by hand
// whenever a migration changes a shape the app actually queries.
//
// `Relationships` is required by @supabase/postgrest-js's GenericTable /
// GenericView shape (it drives embedded-resource type inference for
// `.select("teams(short_name)")` etc). Leaving it off doesn't error here —
// it just makes every derived query type quietly collapse to `never`.

export type PlayerStatus = "a" | "d" | "i" | "s" | "u" | "n";
export type Stake = 3 | 6;

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: { id: number; code: number | null; name: string; short_name: string };
        Insert: { id: number; code?: number | null; name: string; short_name: string };
        Update: Partial<{ id: number; code: number | null; name: string; short_name: string }>;
        Relationships: [];
      };
      players: {
        Row: {
          code: number;
          fpl_id: number;
          web_name: string;
          first_name: string;
          second_name: string;
          team_id: number;
          element_type: number;
          status: PlayerStatus;
          news: string;
          chance_of_playing_next_round: number | null;
          photo: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["players"]["Row"]> & { code: number; fpl_id: number };
        Update: Partial<Database["public"]["Tables"]["players"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      gameweeks: {
        Row: { id: number; deadline_time: string | null; lock_at: string | null; finished: boolean };
        Insert: { id: number; deadline_time?: string | null; finished?: boolean };
        Update: Partial<{ deadline_time: string | null; finished: boolean }>;
        Relationships: [];
      };
      fixtures: {
        Row: {
          id: number;
          event: number | null;
          team_h: number;
          team_a: number;
          kickoff_time: string | null;
          finished: boolean;
          finished_provisional: boolean;
          started: boolean;
          minutes: number;
          played: boolean;
        };
        // `played` is a generated column, so it is never written.
        Insert: Omit<Database["public"]["Tables"]["fixtures"]["Row"], "played">;
        Update: Partial<Omit<Database["public"]["Tables"]["fixtures"]["Row"], "played">>;
        Relationships: [
          {
            foreignKeyName: "fixtures_team_h_fkey";
            columns: ["team_h"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_team_a_fkey";
            columns: ["team_a"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      entrants: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string | null;
          display_name: string;
          phone: string | null;
          sms_opt_in: boolean;
          nomination_player_code: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["entrants"]["Row"]> & { display_name: string };
        Update: Partial<Database["public"]["Tables"]["entrants"]["Row"]>;
        Relationships: [];
      };
      picks: {
        Row: {
          id: number;
          entrant_id: string;
          gameweek: number;
          player_code: number;
          fixture_id: number | null;
          stake: Stake;
          goals: number;
          is_substitution: boolean;
          substituted_from_player_code: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          entrant_id: string;
          gameweek: number;
          player_code: number;
          fixture_id?: number | null;
          stake?: Stake;
          is_substitution?: boolean;
        };
        Update: Partial<{
          player_code: number;
          fixture_id: number | null;
          stake: Stake;
          is_substitution: boolean;
          goals: number;
        }>;
        Relationships: [
          {
            foreignKeyName: "picks_player_code_fkey";
            columns: ["player_code"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "picks_entrant_id_fkey";
            columns: ["entrant_id"];
            isOneToOne: false;
            referencedRelation: "entrants";
            referencedColumns: ["id"];
          },
        ];
      };
      fixture_goals: {
        Row: { fixture_id: number; player_code: number; goals: number };
        Insert: { fixture_id: number; player_code: number; goals?: number };
        Update: Partial<{ goals: number }>;
        Relationships: [];
      };
      season_winners: {
        Row: { season_label: string; entrant_id: string; points: number | null };
        Insert: { season_label: string; entrant_id: string; points?: number | null };
        Update: Partial<{ points: number | null }>;
        Relationships: [
          {
            foreignKeyName: "season_winners_entrant_id_fkey";
            columns: ["entrant_id"];
            isOneToOne: false;
            referencedRelation: "entrants";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders_sent: {
        Row: {
          entrant_id: string;
          gameweek: number;
          channel: "email" | "sms";
          window_key: "t24h" | "t2h";
          sent_at: string;
        };
        Insert: {
          entrant_id: string;
          gameweek: number;
          channel: "email" | "sms";
          window_key: "t24h" | "t2h";
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      pick_scores: {
        Row: {
          pick_id: number;
          entrant_id: string;
          gameweek: number;
          player_code: number;
          stake: Stake;
          goals: number;
          base_points: number;
          double_penalty: number;
          points: number;
        };
        Relationships: [];
      };
      leaderboard: {
        Row: {
          entrant_id: string;
          display_name: string;
          total_points: number;
          scoring_gameweeks: number;
        };
        Relationships: [];
      };
      double_gameweek_teams: {
        Row: { event: number; team: number; fixture_count: number };
        Relationships: [];
      };
    };
    Functions: {
      pick_points: {
        Args: { element_type: number; stake: number; goals: number };
        Returns: number;
      };
    };
  };
}
