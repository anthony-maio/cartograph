import { randomUUID } from "node:crypto";
import { SLIP_VERSION } from "./constants";

export const SLIP_A2A_EXTENSION_URI =
  "https://github.com/anthony-maio/slipcore/extensions/a2a-slipstream/v1";

export interface BuildSlipA2AMessageOptions {
  slipWire: string;
  role?: string;
  messageId?: string;
  ucrVersion?: string;
  ucrHash?: string;
  confidence?: number;
}

export interface SlipA2AMessage {
  messageId: string;
  role: string;
  parts: Array<{ text: string }>;
  extensions: string[];
  metadata: Record<string, Record<string, string | number>>;
}

export function buildSlipA2AMessage(opts: BuildSlipA2AMessageOptions): SlipA2AMessage {
  const metadata: Record<string, string | number> = {
    slipVersion: SLIP_VERSION,
    encoding: "force-object",
  };

  if (opts.ucrVersion) metadata.ucrVersion = opts.ucrVersion;
  if (opts.ucrHash) metadata.ucrHash = opts.ucrHash;
  if (opts.confidence !== undefined) metadata.confidence = opts.confidence;

  return {
    messageId: opts.messageId ?? randomUUID(),
    role: opts.role ?? "user",
    parts: [{ text: opts.slipWire }],
    extensions: [SLIP_A2A_EXTENSION_URI],
    metadata: {
      [SLIP_A2A_EXTENSION_URI]: metadata,
    },
  };
}
