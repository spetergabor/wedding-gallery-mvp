export type MetaHealthState = "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTED" | "SYNCING" | "HEALTHY" | "DEGRADED" | "ERROR";

export function deriveMetaHealthState(input: {
  databaseConnected: boolean;
  configured: boolean;
  connectedAccounts: number;
  syncing: boolean;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  latestDataAt: Date | null;
  mappingsComplete: boolean;
  schedulesActive: boolean;
  now: Date;
}): MetaHealthState {
  if (!input.databaseConnected) return "ERROR";
  if (!input.configured) return "NOT_CONFIGURED";
  if (input.syncing) return "SYNCING";
  if (input.lastFailureAt && (!input.lastSuccessAt || input.lastFailureAt > input.lastSuccessAt)) return "ERROR";
  if (input.connectedAccounts === 0) return "CONFIGURED";
  if (!input.lastSuccessAt || !input.latestDataAt) return "CONNECTED";
  const stale = input.now.getTime() - input.latestDataAt.getTime() > 6 * 60 * 60 * 1_000;
  if (stale || !input.mappingsComplete || !input.schedulesActive) return "DEGRADED";
  return "HEALTHY";
}
