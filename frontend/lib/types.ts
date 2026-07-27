// Shared types mirroring the Sub0 backend endpoint returnables.

export type Role = "OWNER" | "TREASURER" | "MEMBER";
export type CircleStatus = "PENDING" | "ACTIVE" | "COMPLETED";
export type ContributionStatus = "PENDING" | "CONFIRMED";
export type PayoutStatus = "SCHEDULED" | "PAID" | "RECEIVED";
/** Platform-level role, distinct from the per-circle `Role` above. */
export type AccountRole = "USER" | "ADMIN";
export type Visibility = "PUBLIC" | "PRIVATE";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface User {
  id: string;
  name: string;
  email: string;
  token?: string;
  /** null / undefined until the address is confirmed. */
  email_verified_at?: string | null;
  role?: AccountRole;
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
  /** Planned start. Members see a countdown; the owner can still start early. */
  starts_at?: string | null;
  /** PUBLIC circles appear in discovery and accept join requests. */
  visibility?: Visibility;
  description?: string | null;
  /** Derived, present on discovery and detail reads. */
  members_count?: number;
  seats_left?: number;
  owner_name?: string;
  /** The signed-in user's own pending request, if any. */
  my_request_status?: JoinRequestStatus | null;
}

export interface Invitation {
  id: string;
  circle_id: string;
  circle_name?: string;
  email: string;
  invited_by?: string;
  inviter_name?: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
  responded_at?: string | null;
  /** Only returned by the public token lookup, never by list endpoints. */
  contribution_amount?: number;
  currency?: string;
  frequency?: "WEEKLY" | "MONTHLY";
  max_members?: number;
  seats_left?: number;
}

export interface JoinRequest {
  id: string;
  circle_id: string;
  circle_name?: string;
  user_id: string;
  name?: string;
  email?: string;
  message?: string | null;
  status: JoinRequestStatus;
  created_at: string;
  decided_at?: string | null;
}

/** One row of the email outbox — admin-only. */
export interface EmailRecord {
  id: string;
  to_email: string;
  subject: string;
  template: string;
  body: string;
  status: "SENT" | "LOGGED" | "FAILED";
  error?: string | null;
  created_at: string;
}

export interface AdminOverview {
  users: number;
  verified_users: number;
  circles: number;
  active_circles: number;
  completed_circles: number;
  total_confirmed: number;
  total_saved: number;
  pending_join_requests: number;
  pending_invitations: number;
  emails_sent: number;
  emails_failed: number;
}

export interface AdminCircleRow {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  status: CircleStatus;
  visibility: Visibility;
  current_cycle: number;
  max_members: number;
  members_count: number;
  contribution_amount: number;
  currency: string;
  confirmed_contributions: number;
  pending_contributions: number;
  total_saved: number;
  payouts_count: number;
  starts_at?: string | null;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  email_verified_at?: string | null;
  circles_count: number;
  created_at: string;
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
