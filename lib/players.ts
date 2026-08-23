// The only fields the pick screen needs. bootstrap-static is ~5MB and never
// leaves the server; this is the trimmed shape that actually reaches the
// browser (~600 rows, a few dozen bytes each).
export interface PlayerOption {
  code: number;
  web_name: string;
  full_name: string;
  team_short_name: string;
  element_type: number;
  status: string;
  news: string;
}
