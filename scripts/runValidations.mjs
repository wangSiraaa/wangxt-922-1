// 验证脚本：直接运行8个验收用例（纯逻辑，无需浏览器）
import { runAllValidations } from '../src/utils/validations.ts';

console.log('='.repeat(80));
console.log('🐾 宠物美容排队系统 - 自动化验证脚本（8项全量）');
console.log('='.repeat(80));
console.log();

const results = runAllValidations();

let passCount = 0;
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  if (r.passed) passCount++;
  console.log(`${icon} [${r.passed ? '通过' : '失败'}] ${r.name}  (${r.durationMs}ms)`);
  const errors = r.logs.filter(l => l.level === 'ERROR');
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`       ⚠️  ${e.msg}`);
    }
  }
  const lastMsg = r.logs[r.logs.length - 1];
  if (lastMsg && lastMsg.level === 'SUCCESS') {
    console.log(`       📌  ${lastMsg.msg}`);
  }
  console.log();
}

console.log('-'.repeat(80));
const allPassed = passCount === results.length;
console.log(allPassed
  ? `🎉 全部 ${results.length} 个验证用例通过！`
  : `⚠️  通过 ${passCount}/${results.length} 个验证用例`
);
console.log('-'.repeat(80));

process.exit(allPassed ? 0 : 1);
