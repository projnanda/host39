/** Emails are stored and matched trimmed + lowercased (same rule as the NANDA Index). */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ── Sending (Resend HTTP API, no SDK) ────────────────────────────────────────

export const RESEND_API_URL = 'https://api.resend.com/emails';

export interface OutgoingEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Injectable so tests capture emails instead of sending them. */
export type EmailSender = (email: OutgoingEmail) => Promise<void>;

/** Minimal logger surface (satisfied by Fastify's logger). */
export interface EmailLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/** The email provider failed; callers should answer 502, not pretend success. */
export class EmailDeliveryError extends Error {
  readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

export function buildVerificationEmail(to: string, verifyUrl: string): OutgoingEmail {
  return {
    to,
    subject: 'Verify your email for Host39',
    text: `Click to verify your email and publish your agent cards on Host39:\n\n${verifyUrl}\n\nThis link is valid for 24 hours. If you didn't create a Host39 account, you can ignore this email.`,
    html: `<p>Click the link below to verify your email and publish your agent cards on Host39:</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>
           <p>This link is valid for 24 hours. If you didn't create a Host39 account, you can ignore this email.</p>`,
  };
}

/** Extracts Resend's error message from a non-2xx body ({ statusCode, name, message }). */
async function readResendError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown; name?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (typeof body.name === 'string') return body.name;
  } catch {
    // Non-JSON body — fall through.
  }
  return res.statusText || 'unknown error';
}

export function createResendSender(options: {
  apiKey: string;
  from: string;
  log: EmailLogger;
  fetchImpl?: typeof fetch;
}): EmailSender {
  const { apiKey, from, log, fetchImpl = fetch } = options;

  return async (email) => {
    let res: Response;
    try {
      res = await fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html, text: email.text }),
      });
    } catch (err) {
      log.error({ err: (err as Error).message }, 'Resend request failed');
      throw new EmailDeliveryError('could not reach the email provider');
    }

    if (!res.ok) {
      const message = await readResendError(res);
      log.error({ status: res.status, resendError: message }, 'Resend rejected email');
      throw new EmailDeliveryError(`email provider returned ${res.status}`);
    }
  };
}

/** Dev mode (no RESEND_API_KEY): log the email body — which holds the link — instead of sending. */
export function createLogSender(log: EmailLogger): EmailSender {
  return async (email) => {
    log.info({ to: email.to, subject: email.subject, text: email.text }, '[email] RESEND_API_KEY unset — not sending');
  };
}

export function createEmailSender(config: { resendApiKey: string; from: string }, log: EmailLogger): EmailSender {
  return config.resendApiKey
    ? createResendSender({ apiKey: config.resendApiKey, from: config.from, log })
    : createLogSender(log);
}
