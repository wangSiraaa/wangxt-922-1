import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Play,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import {
  ToastContainer,
  ToastCtx,
  type ToastData,
} from '@/components/Toast';
import { useAppStore } from '@/store/useAppStore';
import type { ValidationResult } from '@/types';
import {
  runAllValidations,
  runLargeDogDurationValidation,
  runServiceCancelBlockedValidation,
  runVaccineExpiryValidation,
} from '@/utils/validations';
import { uid } from '@/utils/businessRules';

interface ExtendedResult extends ValidationResult {
  expanded: boolean;
  running: boolean;
  progress: number;
}

export default function ValidationPanelPage() {
  const { resetAll } = useAppStore();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const push = (t: Omit<ToastData, 'id'>) => {
    const id = uid('t_');
    setToasts((ts) => [...ts, { id, ...t }]);
    return id;
  };
  const close = (id: string) => setToasts((ts) => ts.filter((x) => x.id !== id));

  const [results, setResults] = useState<ExtendedResult[]>(() => [
    seedResult('疫苗过期/缺失阻断预约', '🧪'),
    seedResult('服务中顾客取消失败 + 状态流转', '🔒'),
    seedResult('大型犬/巨型犬工时系数计算', '📏'),
  ]);

  const [globalRunning, setGlobalRunning] = useState(false);

  function seedResult(name: string, icon: string): ExtendedResult {
    return {
      name,
      passed: false,
      logs: [
        {
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          level: 'INFO',
          msg: `${icon} 用例 "${name}" 已就绪，点击运行开始验证…`,
        },
      ],
      durationMs: 0,
      expanded: true,
      running: false,
      progress: 0,
    };
  }

  const toggleExpand = (idx: number) => {
    setResults((rs) => rs.map((r, i) => (i === idx ? { ...r, expanded: !r.expanded } : r)));
  };

  const runOne = async (idx: number) => {
    const validators = [
      runVaccineExpiryValidation,
      runServiceCancelBlockedValidation,
      runLargeDogDurationValidation,
    ];
    setResults((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, running: true, progress: 0, passed: false } : r))
    );
    for (let p = 10; p <= 90; p += 20) {
      await new Promise((r) => setTimeout(r, 120));
      setResults((rs) => rs.map((r, i) => (i === idx ? { ...r, progress: p } : r)));
    }
    const result = validators[idx]();
    setResults((rs) =>
      rs.map((r, i) =>
        i === idx
          ? {
              ...r,
              running: false,
              progress: 100,
              passed: result.passed,
              logs: result.logs,
              durationMs: result.durationMs,
            }
          : r
      )
    );
    push({
      type: result.passed ? 'success' : 'error',
      title: result.passed ? '✅ 验证通过' : '❌ 验证失败',
      message: result.name + `（耗时 ${result.durationMs}ms）`,
      duration: 2600,
    });
  };

  const runAll = async () => {
    setGlobalRunning(true);
    for (let i = 0; i < 3; i++) {
      await runOne(i);
      if (i < 2) await new Promise((r) => setTimeout(r, 200));
    }
    setGlobalRunning(false);
    const passed = results.filter((r) => r.passed).length;
    setTimeout(() => {
      push({
        type: passed === 3 ? 'success' : 'warning',
        title: passed === 3 ? '🎉 全部验证通过！' : `通过 ${passed}/3`,
        message: '核心业务规则自检完成',
      });
    }, 100);
  };

  const resetStorage = () => {
    if (confirm('确认重置所有数据到初始示例状态？此操作不可恢复。')) {
      resetAll();
      setResults([
        seedResult('疫苗过期/缺失阻断预约', '🧪'),
        seedResult('服务中顾客取消失败 + 状态流转', '🔒'),
        seedResult('大型犬/巨型犬工时系数计算', '📏'),
      ]);
      push({ type: 'success', title: '已重置', message: '数据已还原到初始示例。' });
    }
  };

  useEffect(() => {
    // 页面加载后 1 秒内，将所有验证函数注册到 window 对象上，便于容器内页面脚本直接调用
    // 注意：这些函数运行结果不会直接更新到 UI 面板，但会在控制台输出结构化 JSON
    const api = {
      runAll: () => runAllValidations(),
      runVaccine: () => runVaccineExpiryValidation(),
      runCancel: () => runServiceCancelBlockedValidation(),
      runDuration: () => runLargeDogDurationValidation(),
      diagnose: () => {
        const res = runAllValidations();
        const summary = {
          timestamp: new Date().toISOString(),
          passedCount: res.filter((r) => r.passed).length,
          totalCount: res.length,
          allPassed: res.every((r) => r.passed),
          cases: res.map((r) => ({
            name: r.name,
            passed: r.passed,
            durationMs: r.durationMs,
            errors: r.logs.filter((l) => l.level === 'ERROR').map((l) => l.msg),
          })),
        };
        console.log('[PET-GROOMING-VALIDATION]', JSON.stringify(summary, null, 2));
        return summary;
      },
    };
    (window as any).__PET_GROOMING_VALIDATE__ = api;
    console.log(
      '%c🐾 宠物美容排队系统验证接口已就绪',
      'background:#F4A261;color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:13px;',
      '\n调用方式：\n  window.__PET_GROOMING_VALIDATE__.diagnose()   // 一键诊断并输出JSON\n  window.__PET_GROOMING_VALIDATE__.runVaccine()  // 疫苗过期校验\n  window.__PET_GROOMING_VALIDATE__.runCancel()   // 服务中取消校验\n  window.__PET_GROOMING_VALIDATE__.runDuration() // 大型犬时长校验'
    );
    // 自动标记到 document 属性，便于 E2E 框架识别
    document.documentElement.setAttribute('data-pet-grooming-ready', '1');
  }, []);

  const ctx = { push };

  return (
    <ToastCtx.Provider value={ctx}>
      <AppNavbar />
      <ToastContainer toasts={toasts} onClose={close} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-sm text-pet-slateLight/80 font-medium">
            容器启动自检 · 核心业务规则验证面板
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-pet-slate mt-1 flex items-center gap-3">
            <span className="text-4xl">🧪</span> 自动化验证面板
          </h2>
          <p className="text-sm text-pet-slateLight mt-2">
            内置三个关键用例：疫苗过期提示、服务中取消失败、大型犬排队时长 × 1.5 系数。支持页面按钮运行，同时暴露{' '}
            <code className="px-2 py-0.5 rounded bg-cream-200 text-pet-orangeDark font-mono text-xs">
              window.__PET_GROOMING_VALIDATE__
            </code>{' '}
            便于容器脚本调用。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card bg-gradient-to-br from-pet-slate via-pet-slate to-pet-slateLight text-white mb-6 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur">
                <TerminalSquare size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl">容器脚本调用说明</h3>
                <p className="text-xs text-white/70">
                  在 puppeteer / selenium / cypress 等容器内直接执行以下 JS 即可完成自检
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runAll}
                disabled={globalRunning}
                className="bg-gradient-to-r from-pet-orange to-pet-coral hover:shadow-lg text-white px-5 py-2.5 rounded-2xl font-semibold flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {globalRunning ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Play size={18} />
                )}
                运行全部
              </button>
              <button
                onClick={resetStorage}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl font-medium flex items-center gap-2 transition-all"
              >
                <RefreshCw size={16} /> 重置数据
              </button>
            </div>
          </div>

          <div className="bg-black/30 rounded-2xl p-4 font-mono text-xs sm:text-sm space-y-2 backdrop-blur overflow-x-auto">
            <div className="text-pet-amberLight">// ✅ 推荐：一键诊断，返回结构化 JSON</div>
            <div>
              <span className="text-pet-mint">const</span> summary =
              window.__PET_GROOMING_VALIDATE__.<span className="text-pet-orangeLight">diagnose</span>
              ();
            </div>
            <div>
              <span className="text-pet-mint">console</span>
              .log(summary.allPassed);{' '}
              <span className="text-white/50">// true 代表三项全通过</span>
            </div>
            <div className="mt-3 text-pet-amberLight">// 🧪 单条用例独立验证</div>
            <div>
              window.__PET_GROOMING_VALIDATE__.<span className="text-pet-orangeLight">runVaccine</span>
              ();{' '}
              <span className="text-white/50">// 用例1：疫苗过期/缺失阻断</span>
            </div>
            <div>
              window.__PET_GROOMING_VALIDATE__.<span className="text-pet-orangeLight">runCancel</span>
              ();{' '}
              <span className="text-white/50">// 用例2：服务中取消失败 + 状态机</span>
            </div>
            <div>
              window.__PET_GROOMING_VALIDATE__.<span className="text-pet-orangeLight">runDuration</span>
              ();{' '}
              <span className="text-white/50">// 用例3：大型犬×1.5 巨型×2</span>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          {results.map((r, idx) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + idx * 0.06 }}
              className="card !p-0 overflow-hidden"
            >
              <div
                className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-cream-50/60 transition-colors"
                onClick={() => toggleExpand(idx)}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-soft flex-shrink-0 ${
                      r.running
                        ? 'bg-pet-amber/20 animate-breathe'
                        : r.logs.length > 1
                        ? r.passed
                          ? 'bg-pet-mint/15'
                          : 'bg-pet-coral/15'
                        : 'bg-cream-200'
                    }`}
                  >
                    {r.running ? (
                      <RefreshCw size={22} className="animate-spin text-pet-amber" />
                    ) : r.logs.length > 1 ? (
                      r.passed ? (
                        <CheckCircle2 size={26} className="text-pet-mintDark" />
                      ) : (
                        <XCircle size={26} className="text-pet-coralDark" />
                      )
                    ) : (
                      <ShieldCheck size={24} className="text-pet-slateLight" />
                    )}
                    {r.running && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-pet-orange to-pet-mint"
                        style={{ width: `${r.progress}%`, transition: 'width 120ms linear' }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-xl text-pet-slate truncate">
                        用例 {idx + 1}：{r.name}
                      </h3>
                      {r.logs.length > 1 && (
                        <span
                          className={`badge ${
                            r.passed
                              ? 'bg-pet-mint/15 text-pet-mintDark border-pet-mint/30'
                              : 'bg-pet-coral/15 text-pet-coralDark border-pet-coral/30'
                          }`}
                        >
                          {r.passed ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-pet-slateLight/80">
                      {r.logs.length > 1 ? (
                        <>
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> 耗时 {r.durationMs}ms
                          </span>
                          <span>
                            共 {r.logs.length} 条日志 ·{' '}
                            {r.logs.filter((l) => l.level === 'SUCCESS').length} 条成功 ·{' '}
                            {r.logs.filter((l) => l.level === 'ERROR').length} 条错误
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1">
                          <AlertCircle size={12} /> 待执行
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runOne(idx);
                    }}
                    disabled={r.running || globalRunning}
                    className="btn-primary !py-2 !px-3.5 text-sm disabled:opacity-50"
                  >
                    <Play size={14} /> 运行
                  </button>
                  <button className="w-8 h-8 rounded-xl bg-cream-100 text-pet-slateLight flex items-center justify-center hover:bg-cream-200 transition-colors">
                    {r.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {r.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 sm:px-6 pb-5">
                      <div className="rounded-2xl bg-pet-slate/95 text-white p-4 max-h-[340px] overflow-y-auto space-y-1.5 font-mono text-xs sm:text-sm">
                        {r.logs.map((log, li) => (
                          <motion.div
                            key={li}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: li * 0.02 }}
                            className="flex gap-3 leading-relaxed"
                          >
                            <span className="text-white/40 flex-shrink-0 w-[72px]">
                              {log.time}
                            </span>
                            <span
                              className={`flex-shrink-0 w-16 ${
                                log.level === 'SUCCESS'
                                  ? 'text-pet-mint'
                                  : log.level === 'ERROR'
                                  ? 'text-pet-coral'
                                  : 'text-pet-amber'
                              }`}
                            >
                              [{log.level}]
                            </span>
                            <span className="break-all text-white/92">{log.msg}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center text-xs text-pet-slateLight/60"
        >
          💡 提示：运行容器 E2E 时，等待页面 ready 标记：
          <code className="px-1.5 py-0.5 rounded bg-cream-200 text-pet-orangeDark font-mono mx-1">
            document.documentElement.getAttribute('data-pet-grooming-ready') === '1'
          </code>
          ，再调用 <code className="px-1.5 py-0.5 rounded bg-cream-200 text-pet-orangeDark font-mono mx-1">diagnose()</code> 即可。
        </motion.div>
      </div>
    </ToastCtx.Provider>
  );
}
