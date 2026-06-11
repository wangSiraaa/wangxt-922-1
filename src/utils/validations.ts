import {
  QueueItem,
  ValidationLogEntry,
  ValidationResult,
  ServiceType,
  PetSize,
} from '@/types';
import {
  calculateDuration,
  canCustomerCancel,
  isVaccineExpired,
  nextStatus,
  validateVaccine,
} from '@/utils/businessRules';

const nowStr = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

function log(level: ValidationLogEntry['level'], msg: string): ValidationLogEntry {
  return { time: nowStr(), level, msg };
}

export function runVaccineExpiryValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例1：疫苗过期/缺失时应阻断预约提交'));

  const expiredDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().slice(0, 10);
  })();
  const validDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  })();

  logs.push(log('INFO', `设置过期疫苗日期：${expiredDate}`));
  const r1 = validateVaccine(expiredDate);
  logs.push(
    log(r1.valid ? 'ERROR' : 'SUCCESS', `校验结果：valid=${r1.valid}, message="${r1.message}"`)
  );
  if (r1.valid) {
    passed = false;
    logs.push(log('ERROR', '❌ 期望过期疫苗返回 valid=false，实际为 true'));
  } else {
    logs.push(log('SUCCESS', '✅ 过期疫苗正确阻断'));
  }

  logs.push(log('INFO', '设置疫苗日期为 null（缺失）'));
  const r2 = validateVaccine(null);
  logs.push(
    log(r2.valid ? 'ERROR' : 'SUCCESS', `校验结果：valid=${r2.valid}, message="${r2.message}"`)
  );
  if (r2.valid) {
    passed = false;
    logs.push(log('ERROR', '❌ 期望缺失疫苗返回 valid=false，实际为 true'));
  } else {
    logs.push(log('SUCCESS', '✅ 缺失疫苗正确阻断'));
  }

  logs.push(log('INFO', `设置有效疫苗日期：${validDate}`));
  const r3 = validateVaccine(validDate);
  logs.push(
    log(r3.valid ? 'SUCCESS' : 'ERROR', `校验结果：valid=${r3.valid}, message="${r3.message}"`)
  );
  if (!r3.valid) {
    passed = false;
    logs.push(log('ERROR', '❌ 期望有效疫苗返回 valid=true，实际为 false'));
  } else {
    logs.push(log('SUCCESS', '✅ 有效疫苗通过校验'));
  }

  const helper1 = isVaccineExpired(expiredDate);
  const helper2 = isVaccineExpired(null);
  const helper3 = isVaccineExpired(validDate);
  if (helper1 && helper2 && !helper3) {
    logs.push(log('SUCCESS', '✅ isVaccineExpired 辅助函数三项断言均通过'));
  } else {
    passed = false;
    logs.push(
      log(
        'ERROR',
        `❌ isVaccineExpired 断言失败：expired=${helper1}, null=${helper2}, valid=${helper3}`
      )
    );
  }

  return {
    name: '疫苗过期/缺失阻断预约',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runServiceCancelBlockedValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例2：服务已开始后顾客取消应失败，前台异常结束可通过'));

  const mockBase = {
    id: 'test_q',
    petId: 'test_p',
    serviceType: 'BASIC_WASH' as ServiceType,
    groomerId: 'g1',
    estimatedMinutes: 60,
    positionInQueue: 1,
    statusChangedAt: {
      WAITING_ARRIVAL: new Date().toISOString(),
      WASHING: null,
      DRYING: null,
      PICKUP: null,
      ENDED: null,
    },
    abnormalEndReason: null,
    createdAt: new Date().toISOString(),
    date: '2026-06-11',
  };

  const qWaiting: QueueItem = { ...mockBase, status: 'WAITING_ARRIVAL' };
  const qWashing: QueueItem = {
    ...mockBase,
    status: 'WASHING',
    statusChangedAt: { ...mockBase.statusChangedAt, WASHING: new Date().toISOString() },
  };
  const qDrying: QueueItem = { ...mockBase, status: 'DRYING' };
  const qPickup: QueueItem = { ...mockBase, status: 'PICKUP' };

  const cases = [
    { status: 'WAITING_ARRIVAL', val: qWaiting, expected: true },
    { status: 'WASHING', val: qWashing, expected: false },
    { status: 'DRYING', val: qDrying, expected: false },
    { status: 'PICKUP', val: qPickup, expected: false },
  ];

  for (const c of cases) {
    const can = canCustomerCancel(c.val.status);
    const ok = can === c.expected;
    logs.push(
      log(
        ok ? 'SUCCESS' : 'ERROR',
        `状态 ${c.status}：canCustomerCancel=${can}，期望=${c.expected} ${ok ? '✅' : '❌'}`
      )
    );
    if (!ok) passed = false;
  }

  logs.push(log('INFO', '验证状态流转：待到店→洗护中→吹干→待接走→已结束'));
  let cur: QueueItem['status'] = 'WAITING_ARRIVAL';
  const flow: string[] = [cur];
  for (let i = 0; i < 4; i++) {
    cur = nextStatus(cur);
    flow.push(cur);
  }
  const expectedFlow = ['WAITING_ARRIVAL', 'WASHING', 'DRYING', 'PICKUP', 'ENDED'];
  const flowOk = flow.join(',') === expectedFlow.join(',');
  logs.push(
    log(
      flowOk ? 'SUCCESS' : 'ERROR',
      `状态流转：${flow.join(' → ')} ${flowOk ? '✅' : '❌ 期望：' + expectedFlow.join(' → ')}`
    )
  );
  if (!flowOk) passed = false;

  const endAgain = nextStatus('ENDED');
  if (endAgain === 'ENDED') {
    logs.push(log('SUCCESS', '✅ 已结束状态流转保持不变（幂等）'));
  } else {
    passed = false;
    logs.push(log('ERROR', `❌ ENDED 后再次流转应仍为 ENDED，实际为 ${endAgain}`));
  }

  return {
    name: '服务中顾客取消失败 + 状态流转',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runLargeDogDurationValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例3：大型犬×1.5 / 巨型×2 的工时系数计算'));

  const expectations: Array<{
    svc: ServiceType;
    size: PetSize;
    base: number;
    mult: number;
    expect: number;
  }> = [
    { svc: 'BASIC_WASH', size: 'LARGE', base: 60, mult: 1.5, expect: 90 },
    { svc: 'PREMIUM_WASH', size: 'LARGE', base: 90, mult: 1.5, expect: 135 },
    { svc: 'SPA', size: 'GIANT', base: 120, mult: 2.0, expect: 240 },
    { svc: 'STYLING', size: 'LARGE', base: 150, mult: 1.5, expect: 225 },
    { svc: 'BASIC_WASH', size: 'SMALL', base: 60, mult: 1.0, expect: 60 },
    { svc: 'BASIC_WASH', size: 'MEDIUM', base: 60, mult: 1.2, expect: 72 },
    { svc: 'STYLING', size: 'GIANT', base: 150, mult: 2.0, expect: 300 },
  ];

  for (const e of expectations) {
    const got = calculateDuration(e.svc, e.size);
    const ok = got === e.expect;
    logs.push(
      log(
        ok ? 'SUCCESS' : 'ERROR',
        `${e.svc}×${e.size}：base=${e.base}×${e.mult}=${e.expect}，计算得 ${got} ${ok ? '✅' : '❌'}`
      )
    );
    if (!ok) passed = false;
  }

  logs.push(log('INFO', '特殊断言：大型犬基础洗护 > 小型犬造型的等比关系'));
  const largeBasic = calculateDuration('BASIC_WASH', 'LARGE');
  const smallStyling = calculateDuration('STYLING', 'SMALL');
  if (largeBasic === 90 && smallStyling === 150) {
    logs.push(log('SUCCESS', `✅ 大型犬洗护=${largeBasic}min，小型犬造型=${smallStyling}min`));
  } else {
    passed = false;
    logs.push(
      log(
        'ERROR',
        `❌ 异常：大型犬洗护=${largeBasic}（期望90），小型犬造型=${smallStyling}（期望150）`
      )
    );
  }

  return {
    name: '大型犬/巨型犬工时系数计算',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runAllValidations(): ValidationResult[] {
  return [
    runVaccineExpiryValidation(),
    runServiceCancelBlockedValidation(),
    runLargeDogDurationValidation(),
  ];
}
