import { unixSeconds } from '../clock.js';

export function canRefreshSession(session, nowMs) {
  if (session.revoked) return false;
  return session.refreshExpiresAt > unixSeconds(nowMs);
}
