/**
 * 跑全部 scenario，輸出 ✅/❌ 報表
 *
 * 執行前提：
 *   - docker compose up 所有服務在跑（backend、postgres、mysql、redis）
 *   - 遊戲 DB schema 已建立（見 setup/01-game-db-schema.sql）
 *   - module_configs.gameDb 已設定（見 setup/02-module-config.ts）
 *
 * 使用：
 *   cd backend
 *   npx ts-node scripts/test-reservation-distribution/run-all.ts
 */
import { runScenario, type ScenarioResult } from './lib/assert';
import { resetAuth } from './lib/http';

// 手動逐一 import（保持順序明確）
import { run as s01 } from './scenarios/01-validate-no-item';
import { run as s02 } from './scenarios/02-validate-threshold-not-reached';
import { run as s03 } from './scenarios/03-validate-ok';
import { run as s04 } from './scenarios/04-happy-path';
import { run as s05 } from './scenarios/05-idempotent';
import { run as s06 } from './scenarios/06-edit-locked-after-sent';
import { run as s07 } from './scenarios/07-edit-syncs-snapshot';
import { run as s08 } from './scenarios/08-distribute-all-reached';
import { run as s09 } from './scenarios/09-unique-constraint';
import { run as s10 } from './scenarios/10-summary-includes-processing';

const SCENARIOS: Array<{ name: string; fn: () => Promise<void> }> = [
  { name: '01-validate-no-item', fn: s01 },
  { name: '02-validate-threshold-not-reached', fn: s02 },
  { name: '03-validate-ok', fn: s03 },
  { name: '04-happy-path (end-to-end)', fn: s04 },
  { name: '05-idempotent (no duplicate send)', fn: s05 },
  { name: '06-edit-locked-after-sent', fn: s06 },
  { name: '07-edit-syncs-pending-snapshot', fn: s07 },
  { name: '08-distribute-all-reached', fn: s08 },
  { name: '09-unique-constraint-under-concurrency', fn: s09 },
  { name: '10-summary-includes-processing', fn: s10 },
];

async function main() {
  resetAuth();
  console.log('==== Reservation Distribution Integration Tests ====\n');

  const results: ScenarioResult[] = [];
  for (const sc of SCENARIOS) {
    process.stdout.write(`Running ${sc.name} ... `);
    const r = await runScenario(sc.name, sc.fn);
    results.push(r);
    if (r.skipped) {
      console.log(`⏭️  SKIP (${r.skipReason})`);
    } else if (r.ok) {
      console.log(`✅ PASS (${r.durationMs}ms)`);
    } else {
      console.log(`❌ FAIL (${r.durationMs}ms)`);
      console.log(`   ${r.error?.split('\n').join('\n   ')}`);
    }
  }

  console.log('\n==== Summary ====');
  const pass = results.filter((r) => r.ok && !r.skipped).length;
  const fail = results.filter((r) => !r.ok).length;
  const skip = results.filter((r) => r.skipped).length;
  console.log(`Total: ${results.length}  |  ✅ ${pass}  |  ❌ ${fail}  |  ⏭️  ${skip}`);

  if (fail > 0) {
    console.log('\n---- Failed scenarios ----');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`\n❌ ${r.name}`);
      console.log(`   ${r.error}`);
    }
    process.exit(1);
  }

  console.log('\n🎉 All scenarios passed!');
}

main().catch((err) => {
  console.error('[runner crashed]', err);
  process.exit(1);
});
