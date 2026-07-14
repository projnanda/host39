import type { Reliability, RawReliability } from '../types.js';

export function parseReliability(raw: RawReliability): Reliability {
  return {
    provider: raw.provider,
    monitoring: raw.monitoring,
    verdict: raw.verdict,
    status: raw.status,
    uptimePct: raw.uptime_pct,
    passRate: raw.pass_rate,
    lastCheckedAt: raw.last_checked_at,
    reliabilityLabel: raw.reliability_label,
    reportUrl: raw.report_url,
    badgeUrl: raw.badge_url,
    claimUrl: raw.claim_url,
  };
}

/** Serializes the internal (camelCase) representation back to the documented wire shape. */
export function serializeReliability(reliability: Reliability): RawReliability {
  return {
    provider: reliability.provider,
    monitoring: reliability.monitoring,
    verdict: reliability.verdict,
    status: reliability.status,
    uptime_pct: reliability.uptimePct,
    pass_rate: reliability.passRate,
    last_checked_at: reliability.lastCheckedAt,
    reliability_label: reliability.reliabilityLabel,
    report_url: reliability.reportUrl,
    badge_url: reliability.badgeUrl,
    claim_url: reliability.claimUrl,
  };
}
