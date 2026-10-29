// Cross-platform ledger reset: node scripts/reset-db.mjs
import { rmSync } from "node:fs";
for (const f of ["data/guardian.db", "data/guardian.db-wal", "data/guardian.db-shm"]) {
  try {
    rmSync(f);
  } catch {
    /* not present */
  }
}
console.log("Guardian ledger reset.");
