/**
 * D5 (Slice 10): liveness (process up only) and readiness (dependency checks).
 * Response bodies contain only ok/fail per check — no error text, hosts or URLs.
 */

export type CheckResult = "ok" | "fail";
export type ReadinessResponse = {
  status: "ok" | "fail";
  checks: { postgres: CheckResult; redis: CheckResult };
};

export type ReadinessDeps = {
  postgres: () => Promise<unknown>;
  redis: () => Promise<unknown>;
  timeoutMs?: number;
};

function withTimeout<T>(work: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    work().then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export function liveness(): { status: "ok" } {
  return { status: "ok" };
}

export async function readiness(deps: ReadinessDeps): Promise<ReadinessResponse> {
  const timeoutMs = deps.timeoutMs ?? 2000; // NOT FOR PRODUCTION placeholder
  const [pg, redis] = await Promise.all([
    withTimeout(deps.postgres, timeoutMs).then(() => "ok" as const, () => "fail" as const),
    withTimeout(deps.redis, timeoutMs).then(() => "ok" as const, () => "fail" as const),
  ]);
  return {
    status: pg === "ok" && redis === "ok" ? "ok" : "fail",
    checks: { postgres: pg, redis },
  };
}
