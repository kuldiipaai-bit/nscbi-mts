export type Role = "admin" | "me" | "se" | "gm";
export type Priority = "low" | "medium" | "high" | "critical";
export type ObsStatus = "open" | "resolved";
export type Recurrence = "daily" | "weekly" | "monthly" | "quarterly";
export type RemarkKind = "remark" | "resolve" | "reopen";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  employee_id: string | null;
  phone: string | null;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  location: string | null;
  owner_me_id: string | null;
  active: boolean;
}

export interface ObservationLite {
  id: string;
  status: ObsStatus;
  monitored: boolean;
  created_at: string;
  submitted_by: string;
  submitter: { full_name: string } | null;
}

export interface Activity {
  id: string;
  service_id: string;
  schedule_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  activity_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  priority: Priority;
  agency: string | null;
  checklist: string[];
  services?: { name: string; owner_me_id: string | null } | null;
  observations?: ObservationLite[];
}

export interface ChecklistResult {
  item: string;
  done: boolean;
}

export interface Observation {
  id: string;
  activity_id: string;
  submitted_by: string;
  monitored: boolean;
  checklist_results: ChecklistResult[];
  remarks: string | null;
  status: ObsStatus;
  resolved_by: string | null;
  resolved_role: Role | null;
  resolved_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface RemarkRow {
  id: string;
  observation_id: string;
  author_id: string;
  author_role: Role;
  body: string;
  kind: RemarkKind;
  created_at: string;
  author: { full_name: string } | null;
}

export interface NotificationRow {
  id: string;
  observation_id: string | null;
  kind: string;
  message: string;
  read: boolean;
  created_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  me: "Maintenance Engineer",
  se: "Shift Engineer",
  gm: "GM / Dept Head",
};

export const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];
