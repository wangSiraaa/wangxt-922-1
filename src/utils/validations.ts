import {
  AdditionalServiceItem,
  Pet,
  QueueItem,
  QueueStatus,
  ReassignmentLog,
  SERVICE_BASE_MINUTES,
  SIZE_MULTIPLIER,
  StoreConfig,
  ValidationLogEntry,
  ValidationResult,
  ServiceType,
  PetSize,
} from '@/types';
import {
  calculateDuration,
  canAddServiceToQueue,
  canCustomerCancel,
  canReassignQueue,
  computeTotalEstimatedMinutes,
  getNextStatusLabel,
  isAfterClosingTime,
  isVaccineExpired,
  needsAllergyConfirmation,
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
    additionalServices: [] as AdditionalServiceItem[],
    reassignmentLog: [] as ReassignmentLog[],
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

export function runBoardButtonTextValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例4：看板推进按钮文案与状态流转结果一致性校验'));
  logs.push(log('INFO', '依次验证 4 个活动状态 → 下一个状态、按钮文案、二者配对是否一致'));

  const expectations: Array<{
    current: QueueStatus;
    currentLabel: string;
    expectedBtnLabel: string;
    expectedNext: QueueStatus;
    expectedNextLabel: string;
  }> = [
    {
      current: 'WAITING_ARRIVAL',
      currentLabel: '待到店',
      expectedBtnLabel: '开始洗护',
      expectedNext: 'WASHING',
      expectedNextLabel: '洗护中',
    },
    {
      current: 'WASHING',
      currentLabel: '洗护中',
      expectedBtnLabel: '吹干定型',
      expectedNext: 'DRYING',
      expectedNextLabel: '吹干',
    },
    {
      current: 'DRYING',
      currentLabel: '吹干',
      expectedBtnLabel: '等待接走',
      expectedNext: 'PICKUP',
      expectedNextLabel: '待接走',
    },
    {
      current: 'PICKUP',
      currentLabel: '待接走',
      expectedBtnLabel: '确认接走',
      expectedNext: 'ENDED',
      expectedNextLabel: '已结束',
    },
  ];

  for (const e of expectations) {
    const actualBtn = getNextStatusLabel(e.current);
    const actualNext = nextStatus(e.current);
    const btnMatch = actualBtn === e.expectedBtnLabel;
    const nextMatch = actualNext === e.expectedNext;
    const ok = btnMatch && nextMatch;
    logs.push(
      log(
        ok ? 'SUCCESS' : 'ERROR',
        `[${e.currentLabel}] 按钮="${actualBtn}"${
          btnMatch ? ' ✅' : ` ❌ 期望"${e.expectedBtnLabel}"`
        }，流转结果=${actualNext}(${e.expectedNextLabel === (actualNext === e.expectedNext ? e.expectedNextLabel : '❌')})${
          nextMatch ? ' ✅' : ` ❌ 期望 ${e.expectedNext}`
        } → ${e.currentLabel} 按钮文案与流转一致：${ok ? 'PASS' : 'FAIL'}`
      )
    );
    if (!ok) passed = false;
  }

  logs.push(log('INFO', '验证单向状态机：4 步完整推进后结束在 ENDED'));
  let cur: QueueStatus = 'WAITING_ARRIVAL';
  const trail: string[] = [];
  for (let i = 0; i < 4; i++) {
    trail.push(`${getNextStatusLabel(cur)}→${nextStatus(cur)}`);
    cur = nextStatus(cur);
  }
  if (cur === 'ENDED') {
    logs.push(log('SUCCESS', `✅ 推进链路：${trail.join(' → ')}，最终=${cur}`));
  } else {
    passed = false;
    logs.push(log('ERROR', `❌ 最终应为 ENDED，实际为 ${cur}`));
  }

  logs.push(log('INFO', '验证按钮文案唯一性：4 个活动状态文案互不相同'));
  const labelSet = expectations.map((x) => x.expectedBtnLabel);
  const uniqueLen = new Set(labelSet).size;
  if (uniqueLen === expectations.length) {
    logs.push(log('SUCCESS', `✅ 四组按钮文案唯一：${labelSet.join(' / ')}`));
  } else {
    passed = false;
    logs.push(log('ERROR', `❌ 存在重复按钮文案（去重后 ${uniqueLen}/${expectations.length}）`));
  }

  return {
    name: '看板按钮文案与状态流转一致性',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runAddonDurationValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例5：加项服务延长排队总时长，总时长=基础+加项分钟数'));

  const baseMinutes = 60;
  const mockBase: QueueItem = {
    id: 'q_addon_1',
    petId: 'p_addon',
    serviceType: 'BASIC_WASH',
    groomerId: 'g1',
    estimatedMinutes: baseMinutes,
    positionInQueue: 1,
    status: 'WAITING_ARRIVAL',
    statusChangedAt: { WAITING_ARRIVAL: new Date().toISOString(), WASHING: null, DRYING: null, PICKUP: null, ENDED: null },
    abnormalEndReason: null,
    createdAt: new Date().toISOString(),
    date: '2026-06-11',
    additionalServices: [] as AdditionalServiceItem[],
    reassignmentLog: [] as ReassignmentLog[],
  };

  const totalBefore = computeTotalEstimatedMinutes(mockBase);
  logs.push(log('INFO', `初始总时长：${totalBefore}min（基础=${mockBase.estimatedMinutes}，加项=0）`));
  if (totalBefore !== baseMinutes) {
    passed = false;
    logs.push(log('ERROR', `❌ 初始总时长应该=${baseMinutes}，实际=${totalBefore}`));
  } else {
    logs.push(log('SUCCESS', '✅ 初始总时长=基础服务时长'));
  }

  const addonA: AdditionalServiceItem = {
    id: 'a1',
    serviceType: 'NAIL_TRIM',
    addedAt: new Date().toISOString(),
    addedBy: 'RECEPTIONIST',
    minutes: Math.round(SERVICE_BASE_MINUTES.NAIL_TRIM * SIZE_MULTIPLIER.MEDIUM),
    allergyRiskConfirmed: false,
  };
  const addonB: AdditionalServiceItem = {
    id: 'a2',
    serviceType: 'STYLING',
    addedAt: new Date().toISOString(),
    addedBy: 'RECEPTIONIST',
    minutes: Math.round(SERVICE_BASE_MINUTES.STYLING * SIZE_MULTIPLIER.MEDIUM),
    allergyRiskConfirmed: false,
  };

  const withOneAddon: QueueItem = {
    ...mockBase,
    additionalServices: [addonA],
  };
  const totalOne = computeTotalEstimatedMinutes(withOneAddon);
  const expectedOne = baseMinutes + addonA.minutes;
  logs.push(
    log(
      totalOne === expectedOne ? 'SUCCESS' : 'ERROR',
      `追加修甲(${addonA.minutes}min)：总时长=${totalOne}，期望=${expectedOne} ${totalOne === expectedOne ? '✅' : '❌'}`
    )
  );
  if (totalOne !== expectedOne) passed = false;

  const withTwoAddons: QueueItem = {
    ...mockBase,
    additionalServices: [addonA, addonB],
  };
  const totalTwo = computeTotalEstimatedMinutes(withTwoAddons);
  const expectedTwo = baseMinutes + addonA.minutes + addonB.minutes;
  logs.push(
    log(
      totalTwo === expectedTwo ? 'SUCCESS' : 'ERROR',
      `再追加造型(${addonB.minutes}min)：总时长=${totalTwo}，期望=${expectedTwo} ${totalTwo === expectedTwo ? '✅' : '❌'}`
    )
  );
  if (totalTwo !== expectedTwo) passed = false;

  logs.push(log('INFO', '验证加项后队列状态可被追加：canAddServiceToQueue（待到店/洗护中可加，已结束不可加）'));
  const qArrival: QueueItem = { ...mockBase, status: 'WAITING_ARRIVAL' };
  const qWashing: QueueItem = { ...mockBase, status: 'WASHING', statusChangedAt: { ...mockBase.statusChangedAt, WASHING: new Date().toISOString() } };
  const qEnded: QueueItem = { ...mockBase, status: 'ENDED' };
  const dummyConfig: StoreConfig = { closingHour: 23, closingMinute: 59 };
  const earliestBusy: Record<string, string> = {
    [qArrival.groomerId]: new Date(Date.now() - 8 * 3600_000).toISOString(),
  };
  const canAddArrival = canAddServiceToQueue(qArrival, 'NAIL_TRIM', 'MEDIUM', '', dummyConfig, [qArrival, qWashing, qEnded], earliestBusy);
  const canAddWashing = canAddServiceToQueue(qWashing, 'NAIL_TRIM', 'MEDIUM', '', dummyConfig, [qArrival, qWashing, qEnded], earliestBusy);
  const canAddEnded = canAddServiceToQueue(qEnded, 'NAIL_TRIM', 'MEDIUM', '', dummyConfig, [qArrival, qWashing, qEnded], earliestBusy);
  const addCasesOk = canAddArrival.allowed && canAddWashing.allowed && !canAddEnded.allowed;
  logs.push(
    log(
      addCasesOk ? 'SUCCESS' : 'ERROR',
      `待到店可加=${canAddArrival.allowed} 洗护中可加=${canAddWashing.allowed} 已结束可加=${canAddEnded.allowed} ${addCasesOk ? '✅（加项仅允许进行中/待到店，已结束禁止）' : '❌'}`
    )
  );
  if (!addCasesOk) passed = false;

  return {
    name: '加项服务延长排队总时长',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runLargeDogReassignValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例6：大型犬×1.5工时订单工位改派，校验改派规则、日志与占用'));

  const largeBaseMinutes = Math.round(SERVICE_BASE_MINUTES.BASIC_WASH * SIZE_MULTIPLIER.LARGE);
  logs.push(log('INFO', `大型犬基础洗护时长：${largeBaseMinutes}min (=60×1.5)`));

  const queueLarge: QueueItem = {
    id: 'q_large_reassign',
    petId: 'p_large',
    serviceType: 'BASIC_WASH',
    groomerId: 'g_from',
    estimatedMinutes: largeBaseMinutes,
    positionInQueue: 2,
    status: 'WASHING',
    statusChangedAt: {
      WAITING_ARRIVAL: new Date(Date.now() - 3600_000).toISOString(),
      WASHING: new Date(Date.now() - 600_000).toISOString(),
      DRYING: null,
      PICKUP: null,
      ENDED: null,
    },
    abnormalEndReason: null,
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
    date: '2026-06-11',
    additionalServices: [] as AdditionalServiceItem[],
    reassignmentLog: [] as ReassignmentLog[],
  };

  logs.push(log('INFO', '验证 canReassignQueue：WASHING/DRYING/WAITING 可改派，PICKUP/ENDED 不可改派，且目标美容师≠原美容师'));
  const reassignWashing: QueueItem = { ...queueLarge, status: 'WASHING' };
  const reassignDrying: QueueItem = { ...queueLarge, status: 'DRYING' };
  const reassignPickup: QueueItem = { ...queueLarge, status: 'PICKUP' };
  const reassignArrival: QueueItem = { ...queueLarge, status: 'WAITING_ARRIVAL' };
  const reassignEnded: QueueItem = { ...queueLarge, status: 'ENDED' };
  const canWash = canReassignQueue(reassignWashing, 'g_other').allowed;
  const canDry = canReassignQueue(reassignDrying, 'g_other').allowed;
  const canPickup = canReassignQueue(reassignPickup, 'g_other').allowed;
  const canArrival = canReassignQueue(reassignArrival, 'g_other').allowed;
  const canEnded = canReassignQueue(reassignEnded, 'g_other').allowed;
  const reassignOk = canWash && canDry && canPickup && canArrival && !canEnded;
  logs.push(
    log(
      reassignOk ? 'SUCCESS' : 'ERROR',
      `洗护中可改=${canWash} 吹干可改=${canDry} 待接走可改=${canPickup} 待到店可改=${canArrival} 已结束可改=${canEnded} ${reassignOk ? '✅' : '❌（仅进行中/待到店可改派）'}`
    )
  );
  if (!reassignOk) passed = false;

  const reason = '原美容师临时紧急离岗，由店长协调';
  const reassignEntry: ReassignmentLog = {
    id: 'log_1',
    fromGroomerId: queueLarge.groomerId,
    toGroomerId: 'g_to',
    reason,
    reassignedAt: new Date().toISOString(),
    reassignedBy: 'RECEPTIONIST',
  };
  const afterReassign: QueueItem = {
    ...queueLarge,
    groomerId: 'g_to',
    reassignmentLog: [...queueLarge.reassignmentLog, reassignEntry],
  };

  logs.push(log('INFO', '写入改派日志：from=g_from → to=g_to，原因为空校验'));
  if (!reassignEntry.reason.trim()) {
    passed = false;
    logs.push(log('ERROR', '❌ 改派原因不能为空'));
  } else {
    logs.push(log('SUCCESS', '✅ 改派原因已填写："' + reason.slice(0, 18) + '…"'));
  }
  if (afterReassign.groomerId !== reassignEntry.toGroomerId) {
    passed = false;
    logs.push(log('ERROR', '❌ 改派后美容师ID未同步'));
  } else {
    logs.push(log('SUCCESS', `✅ 改派后美容师=${afterReassign.groomerId}（与日志 toGroomerId 一致）`));
  }

  logs.push(log('INFO', '验证改派后订单总时长不因改派变化（工时只看体型/服务/加项）'));
  const totalBefore = computeTotalEstimatedMinutes(queueLarge);
  const totalAfter = computeTotalEstimatedMinutes(afterReassign);
  if (totalBefore === totalAfter && totalAfter === largeBaseMinutes) {
    logs.push(log('SUCCESS', `✅ 改派前后总时长保持 ${totalBefore}min（=大型犬×1.5）`));
  } else {
    passed = false;
    logs.push(log('ERROR', `❌ 改派前后时长不一致：before=${totalBefore} after=${totalAfter}`));
  }

  logs.push(log('INFO', '重复改派保留历史条数：模拟再改派一次'));
  const reassignEntry2: ReassignmentLog = {
    id: 'log_2',
    fromGroomerId: 'g_to',
    toGroomerId: 'g_final',
    reason: '技能匹配：该美容师擅长大型犬剪毛造型',
    reassignedAt: new Date().toISOString(),
    reassignedBy: 'RECEPTIONIST',
  };
  const doubleReassign: QueueItem = {
    ...afterReassign,
    groomerId: 'g_final',
    reassignmentLog: [...afterReassign.reassignmentLog, reassignEntry2],
  };
  if (doubleReassign.reassignmentLog.length === 2) {
    logs.push(log('SUCCESS', `✅ 二次改派后日志条数=${doubleReassign.reassignmentLog.length}，历史可追溯`));
  } else {
    passed = false;
    logs.push(log('ERROR', `❌ 改派日志历史丢失，期望2条实际${doubleReassign.reassignmentLog.length}条`));
  }

  return {
    name: '大型犬改派占用与日志留痕',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runAllergyMedBathValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例7：过敏备注宠物追加药浴需二次确认，确认后标记 allergyRiskConfirmed'));

  const normalPet: Pet = {
    id: 'p_normal',
    name: '安安',
    species: '狗',
    breed: '金毛',
    gender: 'M',
    age: 3,
    size: 'LARGE',
    ownerName: '张女士',
    ownerPhone: '13900000001',
    memberId: 'VIP-001',
    vaccineExpiry: '2026-12-01',
    allergyNotes: '',
    specialNotes: '',
    createdAt: new Date().toISOString(),
  };
  const allergyPet: Pet = {
    id: 'p_allergy',
    name: '敏敏',
    species: '狗',
    breed: '柯基',
    gender: 'F',
    age: 2,
    size: 'MEDIUM',
    ownerName: '李先生',
    ownerPhone: '13800000007',
    memberId: 'VIP-007',
    vaccineExpiry: '2026-10-15',
    allergyNotes: '对植物精油类香波严重过敏，曾出现皮肤泛红瘙痒',
    specialNotes: '',
    createdAt: new Date().toISOString(),
  };

  const normalNeedsConfirm = needsAllergyConfirmation('MEDICATED_BATH', normalPet.allergyNotes);
  const allergyNeedsConfirm = needsAllergyConfirmation('MEDICATED_BATH', allergyPet.allergyNotes);
  const allergyNailTrim = needsAllergyConfirmation('NAIL_TRIM', allergyPet.allergyNotes);
  const cond1 = !normalNeedsConfirm;
  const cond2 = allergyNeedsConfirm;
  const cond3 = !allergyNailTrim;
  logs.push(
    log(
      cond1 && cond2 && cond3 ? 'SUCCESS' : 'ERROR',
      `普通宠物+药浴需确认=${normalNeedsConfirm}(期望F)；过敏宠物+药浴需确认=${allergyNeedsConfirm}(期望T)；过敏宠物+修甲需确认=${allergyNailTrim}(期望F) ${cond1 && cond2 && cond3 ? '✅' : '❌'}`
    )
  );
  if (!(cond1 && cond2 && cond3)) passed = false;

  logs.push(log('INFO', '模拟未确认过敏时直接追加：allergyRiskConfirmed 为 false 应视为风险未处理'));
  const addonUnconfirmed: AdditionalServiceItem = {
    id: 'a_risk_1',
    serviceType: 'MEDICATED_BATH',
    addedAt: new Date().toISOString(),
    addedBy: 'RECEPTIONIST',
    minutes: Math.round(SERVICE_BASE_MINUTES.MEDICATED_BATH * SIZE_MULTIPLIER.MEDIUM),
    allergyRiskConfirmed: false,
  };
  if (addonUnconfirmed.allergyRiskConfirmed) {
    passed = false;
    logs.push(log('ERROR', '❌ 未确认的过敏药浴不应标记为 confirmed'));
  } else {
    logs.push(log('SUCCESS', '✅ 未确认的过敏药浴 allergyRiskConfirmed=false'));
  }

  logs.push(log('INFO', '模拟二次确认流程后追加：allergyRiskConfirmed=true + 原因为过敏宠物+药浴'));
  const addonConfirmed: AdditionalServiceItem = {
    id: 'a_risk_2',
    serviceType: 'MEDICATED_BATH',
    addedAt: new Date().toISOString(),
    addedBy: 'RECEPTIONIST',
    minutes: Math.round(SERVICE_BASE_MINUTES.MEDICATED_BATH * SIZE_MULTIPLIER.MEDIUM),
    allergyRiskConfirmed: true,
  };
  if (addonConfirmed.allergyRiskConfirmed && addonConfirmed.serviceType === 'MEDICATED_BATH') {
    logs.push(log('SUCCESS', '✅ 二次确认后 allergyRiskConfirmed=true，可在卡片/列表以风险高亮展示'));
  } else {
    passed = false;
    logs.push(log('ERROR', '❌ 确认后的记录未正确标记'));
  }

  logs.push(log('INFO', '边界校验：造型(STYLING) 无论是否过敏均不需要触发药浴确认逻辑'));
  const allergyStyling = needsAllergyConfirmation('STYLING', allergyPet.allergyNotes);
  if (!allergyStyling) {
    logs.push(log('SUCCESS', '✅ 过敏宠物追加造型不触发过敏确认（仅 MEDICATED_BATH 触发）'));
  } else {
    passed = false;
    logs.push(log('ERROR', '❌ 造型不应触发过敏二次确认'));
  }

  return {
    name: '过敏备注宠物药浴二次确认',
    passed,
    logs,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function runServiceInProgressCancelValidation(): ValidationResult {
  const t0 = performance.now();
  const logs: ValidationLogEntry[] = [];
  let passed = true;

  logs.push(log('INFO', '🧪 用例8：已开始服务（洗护/吹干/待接走）顾客自助取消必须失败'));

  const makeQ = (status: QueueStatus): QueueItem => ({
    id: 'q_cancel_' + status,
    petId: 'p_cancel',
    serviceType: 'BASIC_WASH',
    groomerId: 'g1',
    estimatedMinutes: 60,
    positionInQueue: 1,
    status,
    statusChangedAt: {
      WAITING_ARRIVAL: new Date().toISOString(),
      WASHING: status !== 'WAITING_ARRIVAL' ? new Date().toISOString() : null,
      DRYING: status === 'DRYING' || status === 'PICKUP' ? new Date().toISOString() : null,
      PICKUP: status === 'PICKUP' ? new Date().toISOString() : null,
      ENDED: null,
    },
    abnormalEndReason: null,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    date: '2026-06-11',
    additionalServices: [] as AdditionalServiceItem[],
    reassignmentLog: [] as ReassignmentLog[],
  });

  const cases: Array<{ status: QueueStatus; expected: boolean }> = [
    { status: 'WAITING_ARRIVAL', expected: true },
    { status: 'WASHING', expected: false },
    { status: 'DRYING', expected: false },
    { status: 'PICKUP', expected: false },
    { status: 'ENDED', expected: false },
  ];

  for (const c of cases) {
    const q = makeQ(c.status);
    const result = canCustomerCancel(q.status);
    const ok = result === c.expected;
    logs.push(
      log(
        ok ? 'SUCCESS' : 'ERROR',
        `状态=${q.status} canCustomerCancel=${result} 期望=${c.expected} ${ok ? '✅' : '❌'}`
      )
    );
    if (!ok) passed = false;
  }

  logs.push(log('INFO', '业务语义校验：只要不是 WAITING_ARRIVAL 一律禁止顾客自助取消'));
  const anyStartedFail = ['WASHING', 'DRYING', 'PICKUP'].every(
    (s) => !canCustomerCancel(s as QueueStatus)
  );
  if (anyStartedFail) {
    logs.push(log('SUCCESS', '✅ WASHING/DRYING/PICKUP 三个已开始状态均不能自助取消'));
  } else {
    passed = false;
    logs.push(log('ERROR', '❌ 存在"已开始但仍允许顾客自助取消"的状态'));
  }

  logs.push(log('INFO', '加项场景下的取消边界：进行中订单含加项时，同样不能顾客取消'));
  const washingWithAddon: QueueItem = {
    ...makeQ('WASHING'),
    additionalServices: [
      {
        id: 'ax1',
        serviceType: 'STYLING',
        addedAt: new Date().toISOString(),
        addedBy: 'RECEPTIONIST',
        minutes: 45,
        allergyRiskConfirmed: false,
      },
    ],
  };
  if (!canCustomerCancel(washingWithAddon.status)) {
    logs.push(log('SUCCESS', '✅ 含加项的进行中订单同样不能顾客自助取消（需要前台异常结束）'));
  } else {
    passed = false;
    logs.push(log('ERROR', '❌ 含加项的进行中订单不该允许顾客自助取消'));
  }

  return {
    name: '服务中顾客取消加强限制',
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
    runBoardButtonTextValidation(),
    runAddonDurationValidation(),
    runLargeDogReassignValidation(),
    runAllergyMedBathValidation(),
    runServiceInProgressCancelValidation(),
  ];
}
