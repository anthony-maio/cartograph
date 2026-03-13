import {
  ALPHANUMERIC_TOKEN_PATTERN,
  FORCE_TOKENS,
  GENERIC_OBJECT,
  MAX_AGENT_ID_LENGTH,
  MAX_FALLBACK_REF_LENGTH,
  MAX_OBJECT_LENGTH,
  MAX_PAYLOAD_TOKEN_LENGTH,
  MAX_PAYLOAD_TOKENS,
  SLIP_PREFIX,
  SLIP_VERSION,
  type ForceToken,
} from "./constants";

const FORCE_TOKEN_SET = new Set<string>(FORCE_TOKENS);

export interface SlipMessage {
  version: typeof SLIP_VERSION;
  src: string;
  dst: string;
  force: ForceToken;
  obj: string;
  payload: string[];
  fallbackRef?: string;
  isFallback: boolean;
  wire: string;
  tokenCountEstimate: number;
}

export class SlipValidationError extends Error {}
export class SlipParseError extends Error {}

export function formatSlip(
  src: string,
  dst: string,
  force: ForceToken,
  obj: string,
  payload: string[] = [],
): string {
  const issues = validateTokens(src, dst, force, obj, payload);
  if (issues.length > 0) {
    throw new SlipValidationError(issues.join("; "));
  }

  return buildWire(src, dst, force, obj, payload);
}

export function formatFallback(src: string, dst: string, ref: string): string {
  return formatSlip(src, dst, "Fallback", GENERIC_OBJECT, [ref]);
}

export function parseSlip(raw: string): SlipMessage {
  const normalized = normalizeWire(raw);
  const issues = validateSlip(normalized);
  if (issues.length > 0) {
    throw new SlipParseError(issues.join("; "));
  }

  const [, version, src, dst, force, obj, ...rest] = normalized.split(" ");
  const isFallback = force === "Fallback";
  const fallbackRef = isFallback ? rest[0] : undefined;
  const payload = isFallback ? [] : rest;
  const wire = isFallback ? formatFallback(src, dst, fallbackRef!) : formatSlip(src, dst, force as ForceToken, obj, payload);

  return {
    version: version as typeof SLIP_VERSION,
    src,
    dst,
    force: force as ForceToken,
    obj,
    payload,
    fallbackRef,
    isFallback,
    wire,
    tokenCountEstimate: wire.split(" ").length,
  };
}

export function validateSlip(raw: string): string[] {
  const normalized = normalizeWire(raw);
  if (!normalized) {
    return ["Wire is empty"];
  }

  const tokens = normalized.split(" ");
  if (tokens.length < 6) {
    return [`Too short: need >= 6 tokens, got ${tokens.length}`];
  }

  const [prefix, version, src, dst, force, obj, ...payload] = tokens;
  const issues: string[] = [];

  if (prefix !== SLIP_PREFIX || version !== SLIP_VERSION) {
    if (prefix !== SLIP_PREFIX) {
      issues.push(`Bad prefix: '${prefix}'`);
    }

    if (version !== SLIP_VERSION) {
      issues.push(`Bad version: '${version}'`);
    }
  }

  if (!FORCE_TOKEN_SET.has(force)) {
    issues.push(`Unknown force: '${force}'`);
  }

  issues.push(...validateAgentId(src, "src"));
  issues.push(...validateAgentId(dst, "dst"));
  issues.push(...validateDataToken(obj, "object", MAX_OBJECT_LENGTH));

  if (payload.length > MAX_PAYLOAD_TOKENS) {
    issues.push(`Too many payload tokens: ${payload.length}`);
  }

  for (const token of payload) {
    issues.push(...validateDataToken(token, "payload", MAX_PAYLOAD_TOKEN_LENGTH));
  }

  if (force === "Fallback") {
    if (obj !== GENERIC_OBJECT) {
      issues.push(`Fallback must use object '${GENERIC_OBJECT}'`);
    }

    if (payload.length !== 1) {
      issues.push("Fallback messages require exactly one ref token");
    } else {
      issues.push(...validateDataToken(payload[0], "fallback ref", MAX_FALLBACK_REF_LENGTH));
    }
  }

  return issues;
}

function validateTokens(src: string, dst: string, force: string, obj: string, payload: string[]): string[] {
  const wire = buildWire(src, dst, force, obj, payload);
  return validateSlip(wire);
}

function buildWire(src: string, dst: string, force: string, obj: string, payload: string[]): string {
  return [SLIP_PREFIX, SLIP_VERSION, src, dst, force, obj, ...payload].join(" ");
}

function normalizeWire(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function validateAgentId(value: string, label: string): string[] {
  return validateBoundedToken(value, label, MAX_AGENT_ID_LENGTH);
}

function validateDataToken(value: string, label: string, maxLength: number): string[] {
  return validateBoundedToken(value, label, maxLength);
}

function validateBoundedToken(value: string, label: string, maxLength: number): string[] {
  const issues: string[] = [];
  if (!value) {
    issues.push(`Missing ${label}`);
    return issues;
  }

  if (!ALPHANUMERIC_TOKEN_PATTERN.test(value)) {
    issues.push(`Invalid ${label}: '${value}'`);
  }

  if (value.length > maxLength) {
    issues.push(`${label} too long: '${value}'`);
  }

  return issues;
}
