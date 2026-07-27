"use client";

import Link from "next/link";
import {
  Activity, CheckCircle2, Hourglass, Layers, Mail, MailWarning, PiggyBank, Send, Users,
} from "lucide-react";
import { adminOverview } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import StatCard from "@/components/ui/StatCard";
import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminOverviewPage() {
  return (
    <AdminGuard
      title="Platform admin"
      subtitle="Every user, circle and message on this deployment, in one place."
    >
      <Overview />
    </AdminGuard>
  );
}

function Overview() {
  const { data, error } = useAsync(() => adminOverview(), []);

  if (error) return <Alert tone="error">{error}</Alert>;

  if (!data) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
    );
  }

  const unverified = Math.max(0, data.users - data.verified_users);
  const waiting = Math.max(0, data.circles - data.active_circles - data.completed_circles);

  return (
    <div className="space-y-6">
      {data.emails_failed > 0 && (
        <Alert tone="error">
          <b>
            {data.emails_failed} email{data.emails_failed === 1 ? "" : "s"} failed to send.
          </b>{" "}
          Invitations and verification links in those messages never reached anyone.{" "}
          <Link href="/admin/emails" className="font-semibold underline">
            Open the outbox
          </Link>{" "}
          to read the error and resend the link by hand.
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={data.users}
          hint={`${data.verified_users} verified · ${unverified} not yet`}
          icon={Users}
        />
        <StatCard
          label="Circles"
          value={data.circles}
          hint={`${waiting} still waiting to start`}
          icon={Layers}
        />
        <StatCard
          label="Running circles"
          value={data.active_circles}
          hint={`${data.completed_circles} completed`}
          icon={Activity}
        />
        <StatCard
          label="Total saved"
          value={formatMoney(data.total_saved, "NGN")}
          hint="Confirmed contributions, totalled in NGN"
          icon={PiggyBank}
        />

        <StatCard
          label="Confirmed contributions"
          value={data.total_confirmed}
          hint="Across every cycle of every circle"
          icon={CheckCircle2}
        />
        <StatCard
          label="Pending join requests"
          value={data.pending_join_requests}
          hint={data.pending_join_requests ? "Leaders have not answered these" : "Nothing waiting"}
          icon={Hourglass}
          tone={data.pending_join_requests ? "accent" : "neutral"}
        />
        <StatCard
          label="Pending invitations"
          value={data.pending_invitations}
          hint={data.pending_invitations ? "Sent, not yet accepted" : "Nothing waiting"}
          icon={Mail}
          tone={data.pending_invitations ? "accent" : "neutral"}
        />
        <StatCard
          label="Emails delivered"
          value={data.emails_sent}
          hint="Handed to SMTP without error"
          icon={Send}
        />
        <StatCard
          label="Emails failed"
          value={data.emails_failed}
          hint={data.emails_failed ? "Needs attention" : "No delivery errors"}
          icon={MailWarning}
          tone={data.emails_failed ? "accent" : "neutral"}
        />
      </div>

      <p className="text-xs text-muted">
        Counts read live from the database. With no mail provider configured, messages are recorded
        as LOGGED instead of delivered, so &ldquo;Emails delivered&rdquo; stays at zero while the{" "}
        <Link href="/admin/emails" className="font-semibold text-primary hover:text-primary-dark">
          outbox
        </Link>{" "}
        still fills up.
      </p>
    </div>
  );
}
