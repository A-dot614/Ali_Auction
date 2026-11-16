import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDueAuctions, type CloseAuctionOptions, type CloseDueResult } from "./service.js";

/**
 * Manual close-job entrypoint: `pnpm --filter @aliauction/api auction:close-due` (or
 * `npx tsx src/auction/closeJob.ts`). No production scheduler is added in Slice 4b:
 * scheduling (cron/worker) is a deployment decision (TODO docs/16 §10 / docs/13).
 */
export async function runCloseJob(opts?: CloseAuctionOptions): Promise<CloseDueResult> {
  const result = await closeDueAuctions(opts);
  console.log(
    `[auction:close-due] closed=${result.closed} skipped=${result.skipped} failed=${result.failed}`
  );
  return result;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  runCloseJob().catch((err) => {
    console.error("[auction:close-due] failed", err);
    process.exitCode = 1;
  });
}
