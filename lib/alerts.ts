import type { createClient } from "@/lib/supabase/server";

export type AlertChannel = "email" | "sms" | "push";
export type AlertType =
  | "pick_reminders"
  | "pick_activity"
  | "goal_alerts"
  | "injury_alerts"
  | "results";

export interface AlertPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  pick_reminders: boolean;
  pick_activity: boolean;
  goal_alerts: boolean;
  injury_alerts: boolean;
  results: boolean;
}

export const DEFAULT_PREFS: AlertPrefs = {
  email: true,
  sms: false,
  push: true,
  pick_reminders: true,
  pick_activity: false,
  goal_alerts: true,
  injury_alerts: true,
  results: true,
};

/** Copy lives here rather than in the component so the settings screen and
 * anything else describing an alert can't drift apart. */
export const CHANNELS: { key: AlertChannel; label: string; note: string }[] = [
  { key: "email", label: "Email", note: "To the address you sign in with." },
  { key: "sms", label: "SMS", note: "Needs a mobile number below." },
  { key: "push", label: "Push", note: "This device only — turn it on per device." },
];

export const ALERT_TYPES: { key: AlertType; label: string; note: string }[] = [
  {
    key: "pick_reminders",
    label: "Make your pick",
    note: "Three nudges a gameweek: when it opens, around midday at the halfway point, and an hour before the deadline. They stop the moment you pick.",
  },
  {
    key: "pick_activity",
    label: "Someone else picks",
    note: "Who they took, and for which club, as it happens.",
  },
  {
    key: "goal_alerts",
    label: "Goals",
    note: "Any time anyone's pick scores — including your own.",
  },
  {
    key: "injury_alerts",
    label: "News on your pick",
    note: "If the player you've picked turns doubtful, injured or suspended before the deadline, while you can still change it.",
  },
  {
    key: "results",
    label: "Gameweek results",
    note: "The final word once a gameweek settles: who won it, and where you finished.",
  },
];

export interface AppNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
}

export async function loadAlertPrefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entrantId: string,
): Promise<AlertPrefs> {
  const { data } = await supabase
    .from("alert_prefs")
    .select("email, sms, push, pick_reminders, pick_activity, goal_alerts, injury_alerts, results")
    .eq("entrant_id", entrantId)
    .maybeSingle();
  // The row is created by a trigger on entrants, so a missing one means an
  // entrant who predates this table and hasn't been backfilled — the defaults
  // are what they would have got anyway.
  return data ?? DEFAULT_PREFS;
}

export async function loadNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entrantId: string,
  limit = 30,
): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, url, created_at, read_at")
    .eq("entrant_id", entrantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
