import nodemailer, { type Transporter } from "nodemailer";
import { query } from "./db";
import { newId } from "./ids";

/**
 * Email delivery.
 *
 * Every message is written to the `_emails` outbox first, then delivery is attempted.
 * With SMTP configured the row is marked SENT; without it the row is marked LOGGED and the
 * message is printed to the server console — so invitations, join requests and verification
 * links are all demoable (and testable) with no mail provider at all.
 *
 * Configure delivery with either:
 *   SMTP_URL=smtps://user:pass@smtp.example.com:465
 * or:
 *   SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... SMTP_SECURE=false
 * plus:
 *   MAIL_FROM="CircleSafe <no-reply@yourdomain>"
 *   APP_URL=https://your-deployment      (used to build links; REQUIRED once SMTP is configured)
 */

/** Unset is fine while the outbox is the only delivery; with SMTP it is a refusal to send. */
const APP_URL_SET = Boolean(process.env.APP_URL);
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MAIL_FROM = process.env.MAIL_FROM ?? "CircleSafe <no-reply@circlesafe.local>";

declare global {
  // eslint-disable-next-line no-var
  var __circlesafeMailer: Transporter | null | undefined;
}

function transport(): Transporter | null {
  if (globalThis.__circlesafeMailer !== undefined) return globalThis.__circlesafeMailer;

  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;

  if (url) {
    globalThis.__circlesafeMailer = nodemailer.createTransport(url);
  } else if (host) {
    globalThis.__circlesafeMailer = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
  } else {
    globalThis.__circlesafeMailer = null; // outbox-only mode
  }

  return globalThis.__circlesafeMailer;
}

export const emailConfigured = () => Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);

interface Message {
  to: string;
  subject: string;
  template: string;
  /** Plain-text body. Rendered into a simple branded HTML wrapper for delivery. */
  text: string;
  /** Optional call-to-action rendered as a button in the HTML version. */
  action?: { label: string; url: string };
}

function html({ subject, text, action }: Message): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#1C2B27">${escapeHtml(p)}</p>`)
    .join("");

  const button = action
    ? `<p style="margin:28px 0"><a href="${action.url}" style="background:#0FA968;color:#fff;
         text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;
         display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#5C7268">
         If the button doesn't work, paste this link into your browser:<br>
         <span style="word-break:break-all">${action.url}</span></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#F4FAF7;
    font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="font-weight:700;font-size:20px;color:#07231B;margin-bottom:24px">CircleSafe</div>
      <div style="background:#fff;border:1px solid #E4EFE9;border-radius:16px;padding:28px">
        <h1 style="margin:0 0 18px;font-size:20px;color:#07231B">${escapeHtml(subject)}</h1>
        ${paragraphs}${button}
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#5C7268">
        CircleSafe — transparent savings circles. You received this because someone used your
        email address on CircleSafe.
      </p>
    </div></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Records the message in the outbox and attempts delivery.
 * Never throws: a mail failure must not roll back the action that triggered it — which is
 * exactly why the returned `status` (SENT | LOGGED | FAILED) has to be read by the caller.
 * Anything other than SENT means nobody received this, so the link has to reach them some
 * other way (see `fallbackLink` in lib/server/resources.ts).
 */
export async function sendEmail(message: Message): Promise<{ status: string; id: string }> {
  const id = newId();
  const bodyForOutbox = message.action
    ? `${message.text.trim()}\n\n${message.action.label}: ${message.action.url}`
    : message.text.trim();

  let status = "LOGGED";
  let error: string | null = null;

  const mailer = transport();
  if (mailer && !APP_URL_SET) {
    // Every template carries a link. Delivering them built on the fallback origin would send
    // real recipients to their own machine, so a configured provider without APP_URL is a
    // refusal to send: the row is FAILED, and the caller gets the link back to pass on by hand.
    status = "FAILED";
    error =
      "APP_URL is not set, so every link in this message would point at http://localhost:3000. " +
      "Set APP_URL to the address your users reach this deployment on.";
    console.error(`[email] refusing to send "${message.template}" to ${message.to}: ${error}`);
  } else if (mailer) {
    try {
      await mailer.sendMail({
        from: MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: bodyForOutbox,
        html: html(message),
      });
      status = "SENT";
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message.slice(0, 500) : "Unknown mail error";
      console.error("[email] delivery failed:", error);
    }
  } else {
    console.log(
      `\n[email:${message.template}] → ${message.to}\n  ${message.subject}\n` +
        bodyForOutbox.split("\n").map((l) => `  ${l}`).join("\n") +
        "\n  (no SMTP configured — logged to the outbox only)\n",
    );
  }

  try {
    await query(
      `INSERT INTO _emails (id, to_email, subject, template, body, status, error, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
      [id, message.to, message.subject, message.template, bodyForOutbox, status, error,
       new Date().toISOString()],
    );
  } catch (err) {
    console.error("[email] could not write to the outbox:", err);
  }

  return { status, id };
}

/* ----------------------------- templates ----------------------------- */

export const emails = {
  verifyEmail: (to: string, name: string, token: string) =>
    sendEmail({
      to,
      template: "VERIFY_EMAIL",
      subject: "Confirm your email address",
      text: `Hi ${name},\n\nWelcome to CircleSafe. Confirm this address to activate your account — you'll need it before you can create or join a savings circle.\n\nThis link expires in 24 hours.`,
      action: { label: "Confirm my email", url: `${APP_URL}/verify/${token}` },
    }),

  invitation: (to: string, inviterName: string, circleName: string, token: string) =>
    sendEmail({
      to,
      template: "INVITATION",
      subject: `${inviterName} invited you to the "${circleName}" savings circle`,
      text: `${inviterName} has invited you to join "${circleName}" on CircleSafe — a transparent way to run an Ajo/Esusu savings circle, where every contribution and payout is recorded and visible to all members.\n\nYou can accept or decline. If you don't have a CircleSafe account yet, you'll be able to create one first.\n\nThis invitation expires in 14 days.`,
      action: { label: "View the invitation", url: `${APP_URL}/invite/${token}` },
    }),

  joinRequestReceived: (
    to: string, ownerName: string, requesterName: string, requesterEmail: string,
    circleName: string, circleId: string, message?: string | null,
  ) =>
    sendEmail({
      to,
      template: "JOIN_REQUEST",
      subject: `${requesterName} asked to join "${circleName}"`,
      text: `Hi ${ownerName},\n\n${requesterName} (${requesterEmail}) has requested to join your circle "${circleName}".${
        message ? `\n\nTheir message: "${message}"` : ""
      }\n\nYou decide — approving adds them to the circle and gives them the next payout position. Rejecting simply declines the request.`,
      action: { label: "Review the request", url: `${APP_URL}/circles/${circleId}?tab=requests` },
    }),

  joinRequestDecided: (
    to: string, requesterName: string, circleName: string, circleId: string, approved: boolean,
  ) =>
    sendEmail({
      to,
      template: approved ? "JOIN_APPROVED" : "JOIN_REJECTED",
      subject: approved
        ? `You're in — "${circleName}" accepted your request`
        : `Your request to join "${circleName}" was declined`,
      text: approved
        ? `Hi ${requesterName},\n\nYour request to join "${circleName}" was approved. You now have a payout position in the rotation and can start contributing once the circle begins.`
        : `Hi ${requesterName},\n\nYour request to join "${circleName}" was declined. Circles have a fixed number of seats, so this often just means the circle is full.\n\nYou can browse other open circles any time.`,
      action: approved
        ? { label: "Open the circle", url: `${APP_URL}/circles/${circleId}` }
        : { label: "Find another circle", url: `${APP_URL}/circles/discover` },
    }),

  invitationAccepted: (to: string, ownerName: string, memberName: string, circleName: string, circleId: string) =>
    sendEmail({
      to,
      template: "INVITE_ACCEPTED",
      subject: `${memberName} joined "${circleName}"`,
      text: `Hi ${ownerName},\n\n${memberName} accepted your invitation and is now a member of "${circleName}".`,
      action: { label: "Open the circle", url: `${APP_URL}/circles/${circleId}` },
    }),

  circleStarted: (to: string, memberName: string, circleName: string, circleId: string) =>
    sendEmail({
      to,
      template: "CIRCLE_STARTED",
      subject: `"${circleName}" has started — cycle 1 is open`,
      text: `Hi ${memberName},\n\n"${circleName}" has started. Cycle 1 is open, so you can record your contribution now. The rules and payout order are locked from this point on.`,
      action: { label: "Go to the circle", url: `${APP_URL}/circles/${circleId}` },
    }),
};
