export const SLIP_PREFIX = "SLIP";
export const SLIP_VERSION = "v3";
export const GENERIC_OBJECT = "Generic";
export const MAX_AGENT_ID_LENGTH = 20;
export const MAX_OBJECT_LENGTH = 30;
export const MAX_PAYLOAD_TOKENS = 20;
export const MAX_PAYLOAD_TOKEN_LENGTH = 30;
export const MAX_FALLBACK_REF_LENGTH = 16;

export const FORCE_TOKENS = [
  "Observe",
  "Inform",
  "Ask",
  "Request",
  "Propose",
  "Commit",
  "Eval",
  "Meta",
  "Accept",
  "Reject",
  "Error",
  "Fallback",
] as const;

export type ForceToken = (typeof FORCE_TOKENS)[number];

export const ALPHANUMERIC_TOKEN_PATTERN = /^[A-Za-z0-9]+$/;
