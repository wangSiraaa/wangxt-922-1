import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  Phone,
  Search,
  ShieldX,
  Sparkles,
  UserSearch,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import {
  ToastContainer,
  ToastCtx,
  type ToastData,
} from '@/components/Toast';
import { useAppStore } from '@/store/useAppStore';
import {
  PET_SIZE_COLOR,
  PET_SIZE_LABEL,
  QUEUE_STATUS_EMOJI,
  QUEUE_STATUS_LABEL,
  QueueItem,
  QueueStatus,
  SERVICE_LABEL,
} from '@/types';
import {
  addMinutes,
  canCustomerCancel,
  computeEstimatedStart,
  formatMinutes,
  formatTime,
  uid,
} from '@/utils/businessRules';

const STEPS: QueueStatus[] = ['WAITING_ARRIVAL', 'WASHING', 'DRYING', 'PICKUP', 'ENDED'];

export default function CustomerViewPage() {
  const { queueItems, pets, groomers, cancelQueueByCustomer } = useAppStore();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const push = (t: Omit<ToastData, 'id'>) => {
    const id = uid('t_');
    setToasts((ts) => [...ts, { id, ...t }]);
    return id;
  };
  const close = (id: string) => setToasts((ts) => ts.filter((x) => x.id !== id));

  const [phone, setPhone] = useState('');
  const [memberId, setMemberId] = useState('');
  const [queried, setQueried] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const groomerMap = useMemo(
    () => new Map(groomers.map((g) => [g.id, g])),
    [groomers]
  );

  const matchedQueues = useMemo(() => {
    if (!queried) return [];
    const kwPhone = phone.trim();
    const kwMember = memberId.trim();
    if (!kwPhone && !kwMember) return [];
    const matchedPetIds = pets
      .filter(
        (p) =>
          (kwPhone && p.ownerPhone.includes(kwPhone)) ||
          (kwMember && (p.memberId || '').toUpperCase().includes(kwMember.toUpperCase()))
      )
      .map((p) => p.id);
    return queueItems
      .filter((q) => matchedPetIds.includes(q.petId) && q.status !== 'ENDED')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [queried, phone, memberId, pets, queueItems]);

  const groomerBusyUntil: Record<string, string> = {};
  for (const g of groomers) {
    const inProgress = queueItems
      .filter((q) => q.groomerId === g.id && q.status !== 'WAITING_ARRIVAL' && q.status !== 'ENDED')
      .sort(
        (a, b) =>
          (a.statusChangedAt[a.status] || '').localeCompare(
            b.statusChangedAt[b.status] || ''
          )
      );
    if (inProgress.length > 0) {
      const last = inProgress[inProgress.length - 1];
      const startedAt = last.statusChangedAt[last.status] || last.createdAt;
      groomerBusyUntil[g.id] = addMinutes(
        startedAt,
        Math.max(10, Math.round(last.estimatedMinutes * 0.7))
      );
    }
  }

  const doQuery = () => {
    if (!phone.trim() && !memberId.trim()) {
      push({ type: 'warning', title: '请输入手机号或会员号查询' });
      return;
    }
    setQueried(true);
  };

  const confirmCancel = () => {
    if (!pendingCancelId) return;
    const r = cancelQueueByCustomer(pendingCancelId);
    push({
      type: r.success ? 'success' : 'error',
      title: r.success ? '取消成功' : '取消失败',
      message: r.message,
    });
    setCancelOpen(false);
    setPendingCancelId(null);
  };

  const ctx = { push };

  useEffect(() => {
    if (matchedQueues.length === 0 && queried) {
      setTimeout(() => {
        if (matchedQueues.length === 0) {
          push({
            type: 'info',
            title: '未找到排队记录',
            message: '请核对手机号或会员号，或联系前台确认。',
          });
        }
      }, 400);
    }
  }, [matchedQueues.length, queried]);

  return (
    <ToastCtx.Provider value={ctx}>
      <AppNavbar />
      <ToastContainer toasts={toasts} onClose={close} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-sm text-pet-slateLight/80 font-medium">
            顾客自助查询通道 · 仅可见本人信息
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-pet-slate mt-1 flex items-center gap-3">
            <span className="text-4xl">👀</span> 查询我的美容进度
          </h2>
          <p className="text-sm text-pet-slateLight mt-2">
            输入主人手机号或会员号，即可查看排队顺序、预计时间与服务状态
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card mb-6"
        >
          <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
            <UserSearch size={20} className="text-pet-slateLight" /> 身份验证
          </h3>
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="label-text flex items-center gap-1.5">
                <Phone size={14} /> 主人手机号
              </label>
              <input
                className="input-base"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doQuery()}
                placeholder="如：13800000002"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="label-text flex items-center gap-1.5">
                <Sparkles size={14} /> 会员号
              </label>
              <input
                className="input-base"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doQuery()}
                placeholder="如：VIP-2024002（选填）"
              />
            </div>
            <button onClick={doQuery} className="btn-primary !py-3 !px-6">
              <Search size={18} /> 查询
            </button>
          </div>
          <div className="mt-4 p-3 rounded-2xl bg-cream-100 text-xs text-pet-slateLight/90 space-y-1">
            <p>🔍 演示数据示例，可直接尝试输入：</p>
            <p>
              <code className="px-2 py-0.5 rounded bg-white text-pet-orangeDark font-mono mx-1">13800000002</code>
              柯基「毛毛」· 中型
              <code className="px-2 py-0.5 rounded bg-white text-pet-orangeDark font-mono mx-1 ml-3">13800000003</code>
              英短「咪咪」· 洗护中
            </p>
          </div>
        </motion.section>

        {!queried ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card text-center py-16 text-pet-slateLight/70"
          >
            <div className="text-6xl mb-4">🐾</div>
            <p className="font-display text-xl">输入手机号或会员号开始查询</p>
            <p className="text-sm mt-2">您的宠物护理进度将以可视化方式呈现</p>
          </motion.div>
        ) : matchedQueues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card text-center py-12"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-pet-amber/15 text-pet-amber flex items-center justify-center mb-4">
              <AlertCircle size={28} />
            </div>
            <p className="font-display text-2xl text-pet-slate">暂无匹配的排队单</p>
            <p className="text-sm text-pet-slateLight mt-2">
              可能是号码未登记或服务已完成。请尝试不同的关键词或联系前台。
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {matchedQueues.map((q, i) => {
              const pet = petMap.get(q.petId);
              const groomer = groomerMap.get(q.groomerId);
              const stepIdx = STEPS.indexOf(q.status);
              const estStart = computeEstimatedStart(q, queueItems, groomerBusyUntil);
              const startedAt =
                q.status !== 'WAITING_ARRIVAL'
                  ? q.statusChangedAt[q.status] || estStart
                  : estStart;
              const estEnd = addMinutes(startedAt, q.estimatedMinutes);
              const canCancel = canCustomerCancel(q.status);

              const globalWaitingQueues = queueItems.filter(
                (x) =>
                  x.groomerId === q.groomerId &&
                  x.status === 'WAITING_ARRIVAL' &&
                  x.createdAt < q.createdAt &&
                  x.id !== q.id
              ).length;

              return (
                <motion.article
                  key={q.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="card !p-0 overflow-hidden"
                >
                  <div className="px-6 py-5 bg-gradient-to-r from-pet-orange/10 via-transparent to-pet-mint/10 border-b border-cream-200">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pet-orange to-pet-coral text-white flex items-center justify-center text-5xl shadow-soft animate-pulse-soft">
                            {QUEUE_STATUS_EMOJI[q.status]}
                          </div>
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white border-4 border-cream-100 flex items-center justify-center shadow-soft">
                            <span className="font-mono font-black text-lg text-pet-orangeDark">
                              #{globalWaitingQueues + 1 || '-'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display text-2xl text-pet-slate">
                              {pet?.name}
                            </h3>
                            {pet && (
                              <span className={`badge ${PET_SIZE_COLOR[pet.size]}`}>
                                {PET_SIZE_LABEL[pet.size]}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-pet-slateLight mt-1">
                            {pet?.breed || pet?.species} · {SERVICE_LABEL[q.serviceType]} ·{' '}
                            {groomer ? `${groomer.avatarEmoji} ${groomer.name}` : '待分配美容师'}
                          </p>
                          <p className="mt-2">
                            <span
                              className={`status-pill ${
                                q.status === 'WAITING_ARRIVAL'
                                  ? 'bg-pet-slate/10 text-pet-slate'
                                  : q.status === 'WASHING'
                                  ? 'bg-pet-mint/15 text-pet-mintDark'
                                  : q.status === 'DRYING'
                                  ? 'bg-pet-amber/25 text-pet-slate'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              <span className="text-lg">{QUEUE_STATUS_EMOJI[q.status]}</span>{' '}
                              {QUEUE_STATUS_LABEL[q.status]}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          <div className="text-pet-slateLight/80">预计开始</div>
                          <div className="font-mono font-bold text-pet-slate text-base">
                            {formatTime(estStart)}
                          </div>
                          <div className="text-pet-slateLight/80">预计完成</div>
                          <div className="font-mono font-bold text-pet-orangeDark text-lg">
                            {formatTime(estEnd)}
                          </div>
                          <div className="text-pet-slateLight/80">服务时长</div>
                          <div className="font-mono text-pet-slate">
                            {formatMinutes(q.estimatedMinutes)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between mb-3 text-xs font-medium">
                      {STEPS.slice(0, 4).map((s, idx) => (
                        <div
                          key={s}
                          className={`flex-1 flex items-center gap-1.5 ${
                            idx <= stepIdx ? 'text-pet-mintDark' : 'text-pet-slateLight/60'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              idx < stepIdx
                                ? 'bg-pet-mint text-white'
                                : idx === stepIdx
                                ? 'bg-pet-orange text-white animate-breathe'
                                : 'bg-cream-200 text-pet-slateLight'
                            }`}
                          >
                            {idx < stepIdx ? <CheckCircle2 size={12} /> : idx + 1}
                          </span>
                          <span className="hidden sm:inline">{QUEUE_STATUS_LABEL[s]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${stepIdx >= 4 ? 100 : Math.min(100, (stepIdx / 3) * 100)}%`,
                        }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.8 }}
                        className="h-full progress-flow rounded-full"
                      />
                    </div>
                    <p className="text-xs text-pet-slateLight/80 mt-3">
                      {q.status === 'WAITING_ARRIVAL'
                        ? `🕒 前方还有 ${globalWaitingQueues} 只宠物待服务，请在休息区稍作等候。`
                        : q.status === 'WASHING'
                        ? '🛁 正在进行精细洗护，美容师会小心呵护您的宝贝～'
                        : q.status === 'DRYING'
                        ? '💨 吹干定型中，马上就可以美美的回家啦！'
                        : q.status === 'PICKUP'
                        ? '🏠 服务完成，请到前台接走您的小可爱。'
                        : '✅ 本次服务已顺利结束，期待下次见面！'}
                    </p>
                  </div>

                  <div className="px-6 pb-5 flex flex-wrap gap-3 items-center justify-between border-t border-cream-200/50 pt-4">
                    {pet?.allergyNotes && (
                      <div className="text-xs px-3 py-1.5 rounded-xl bg-pet-coral/10 text-pet-coralDark flex items-center gap-1.5 max-w-full">
                        <ShieldX size={12} /> 过敏提醒：{pet.allergyNotes}
                      </div>
                    )}
                    {canCancel ? (
                      <button
                        onClick={() => {
                          setPendingCancelId(q.id);
                          setCancelOpen(true);
                        }}
                        className="ml-auto btn-danger !py-2 !px-4 text-sm"
                      >
                        <LogOut size={14} /> 取消本次预约
                      </button>
                    ) : (
                      <TooltipWrapper
                        tip="服务已开始，无法自助取消。如需中止请联系前台登记异常结束。"
                        className="ml-auto"
                      >
                        <button disabled className="btn-danger !py-2 !px-4 text-sm opacity-60 cursor-not-allowed !hover:translate-y-0">
                          <ShieldX size={14} /> 取消预约（服务已开始）
                        </button>
                      </TooltipWrapper>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {cancelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pet-slate/40 backdrop-blur-sm"
            onClick={() => setCancelOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="card max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-pet-coral/15 text-pet-coralDark flex items-center justify-center flex-shrink-0">
                  <LogOut size={22} />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-pet-slate">确认取消预约？</h3>
                  <p className="text-sm text-pet-slateLight mt-0.5">
                    取消后工位将被释放，如需再次服务请联系前台重新预约。
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button className="btn-secondary flex-1" onClick={() => setCancelOpen(false)}>
                  再想想
                </button>
                <button className="btn-danger flex-1" onClick={confirmCancel}>
                  确认取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

function TooltipWrapper({
  tip,
  children,
  className = '',
}: {
  tip: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative group ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
        <div className="max-w-xs px-3 py-2 rounded-xl bg-pet-slate text-white text-xs shadow-soft whitespace-normal">
          {tip}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-pet-slate rotate-45" />
        </div>
      </div>
    </div>
  );
}
