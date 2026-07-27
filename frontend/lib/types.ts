// Shared types mirroring the Sub0 backend endpoint returnables.

export type Role = "OWNER" | "TREASURER" | "MEMBER";
export type CircleStatus = "PENDING" | "ACTIVE" | "COMPLETED";
export type ContributionStatus = "PENDING" | "CONFIRMED";
export type PayoutStatus = "SCHEDULED" | "PAID" | "RECEIVED";

export interface User {
  id: string;
  name: string;
  email: string;
  token?: string;
}

export interface Circle {
  id: string;
  name: string;
  owner_id?: string;
  contribution_amount: number;
  frequency: "WEEKLY" | "MONTHLY";
  max_members: number;
  currency: string;
  status: CircleStatus;
  current_cycle: number;
  rules?: { grace_period_days?: number; late_fee?: number };
  created_at?: string;
}

export interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: Role;
  payout_position: number;
  status: "INVITED" | "ACTIVE";
}

export interface Contribution {
  id: string;
  user_id: string;
  name: string;
  cycle: number;
  amount: number;
  status: ContributionStatus;
  confirmed_by?: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  cycle: number;
  recipient_id: string;
  recipient_name: string;
  amount: number;
  status: PayoutStatus;
  recorded_by?: string;
  created_at: string;
}

export interface DashboardData {
  id: string;
  name: string;
  status: CircleStatus;
  current_cycle: number;
  max_members: number;
  contribution_amount: number;
  currency: string;
  pot: number;
  members_paid: number;
  total_members: number;
  next_recipient: string | null;
  completion_pct: number;
}

export interface Insights {
  most_reliable_member: string | null;
  total_savings: number;
  total_confirmed: number;
  next_payout_member: string | null;
  avg_confirmed_per_cycle: number | null;
}

export interface TrustScoreRow {
  user_id: string;
  name: string;
  total_contributed: number;
  confirmed_count: number;
  pending_count: number;
  reliability_pct: number;
}

export interface CircleHealth {
  id: string;
  name: string;
  status: CircleStatus;
  current_cycle: number;
  max_members: number;
  active_members: number;
  confirmed_contributions: number;
  pending_contributions: number;
  payouts_received: number;
  health_pct: number;
}

/** Shared props for every panel rendered inside the circle detail page. */
export interface PanelProps {
  circleId: string;
  circle: Circle;
  /** The signed-in user's membership in this circle (null while loading). */
  me: Member | null;
  /** Bumped whenever circle data changes; panels refetch on change. */
  version: number;
  /** Call after a mutation so the whole page refreshes. */
  onChanged: () => void;
}

export interface ActivityItem {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  type: string;
  message: string;
  metadata?: string | null;
  created_at: string;
}
