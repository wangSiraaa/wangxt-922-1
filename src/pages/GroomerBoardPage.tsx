import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  LogOut,
  Plus,
  ShieldAlert,
  User,
  UserX,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/AppNavbar';
import {
  ToastContainer,
  ToastCtx,
  useToast,
  type ToastData,
} from '@/components/Toast';
import { useAppStore } from '@/store/useAppStore';
import {
  ADDON_SERVICES,
  PET_SIZE_COLOR,
  PET_SIZE_LABEL,
  QUEUE_STATUS_EMOJI,
  QUEUE_STATUS_LABEL,
  QueueItem,
  QueueStatus,
  SERVICE_BASE_MINUTES,
  SERVICE_LABEL,
  ServiceType,
  SIZE_MULTIPLIER,
  UserRole,
} from '@/types';
import {
  addMinutes,
  computeEstimatedStart,
  computeTotalEstimatedMinutes,
  formatMinutes,
  formatTime,
  getNextStatusLabel,
  nextStatus,
  uid,
} from '@/utils/businessRules';

const STATUS_COLUMNS: QueueStatus[] = ['WAITING_ARRIVAL', 'WASHING', 'DRYING', 'PICKUP'];

const COL_STYLE: Record<QueueStatus, string> = {
  WAITING_ARRIVAL: 'bg-gradient-to-b from-[#E6EEF3] to-[#F3F6F8]',
  WASHING: 'bg-gradient-to-b from-[#DBEEE9] to-[#EEF7F3]',
  DRYING: 'bg-gradient-to-b from-[#FAF1D3] to-[#FDF8E6]',
  PICKUP: 'bg-gradient-to-b from-[#EFE1EF] to-[#F6EBF6]',
  ENDED: 'bg-gray-100',
};

const COL_BAR: Record<QueueStatus, string> = {
  WAITING_ARRIVAL: 'bg-gradient-to-r from-pet-slate to-pet-slateLight',
  WASHING: 'bg-gradient-to-r from-pet-mint to-pet-mintLight',
  DRYING: 'bg-gradient-to-r from-pet-amber to-pet-coral',
  PICKUP: 'bg-gradient-to-r from-purple-500 to-fuchsia-400',
  ENDED: 'bg-gray-400',
};

export default function GroomerBoardPage() {
  const {
    queueItems,
    pets,
    groomers,
    advanceStatus,
    abnormalEndQueue,
    addAdditionalService,
    reassignQueue,
    currentRole,
    recalcQueuePositions,
  } = useAppStore();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const push = (t: Omit<ToastData, 'id'>) => {
    const id = uid('t_');
    setToasts((ts) => [...ts, { id, ...t }]);
    return id;
  };
  const close = (id: string) => setToasts((ts) => ts.filter((x) => x.id !== id));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [abnormalOpen, setAbnormalOpen] = useState(false);
  const [abnormalReason, setAbnormalReason] = useState('');

  const [addonOpen, setAddonOpen] = useState(false);
  const [addonTargetId, setAddonTargetId] = useState<string | null>(null);
  const [pendingAddonSvc, setPendingAddonSvc] = useState<ServiceType | null>(null);
  const [allergyConfirmOpen, setAllergyConfirmOpen] = useState(false);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState<string | null>(null);
  const [reassignToGroomerId, setReassignToGroomerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    recalcQueuePositions();
  }, [recalcQueuePositions]);

  useEffect(() => {
    if (currentRole === 'CUSTOMER') {
      setTimeout(() => {
        push({
          type: 'warning',
          title: '顾客视图无法操作看板',
          message: '请切换到美容师或前台角色以推进状态。',
        });
      }, 300);
    }
  }, [currentRole]);

  const activeQueues = queueItems.filter((q) => q.status !== 'ENDED');

  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const groomerMap = useMemo(
    () => new Map(groomers.map((g) => [g.id, g])),
    [groomers]
  );

  const grouped = useMemo(() => {
    const m: Record<QueueStatus, QueueItem[]> = {
      WAITING_ARRIVAL: [],
      WASHING: [],
      DRYING: [],
      PICKUP: [],
      ENDED: [],
    };
    for (const q of activeQueues) m[q.status].push(q);
    for (const k of Object.keys(m) as QueueStatus[]) {
      m[k].sort((a, b) => {
        if (a.groomerId !== b.groomerId) return a.groomerId.localeCompare(b.groomerId);
        return a.positionInQueue - b.positionInQueue;
      });
    }
    return m;
  }, [activeQueues]);

  const groomerBusyUntil: Record<string, string> = {};
  for (const g of groomers) {
    const inProgress = activeQueues
      .filter((q) => q.groomerId === g.id && q.status !== 'WAITING_ARRIVAL')
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
        Math.max(10, Math.round(computeTotalEstimatedMinutes(last) * 0.7))
      );
    }
  }

  const canEdit = currentRole !== 'CUSTOMER';
  const isManagerOrReception = currentRole === 'RECEPTIONIST';

  const doAdvance = (q: QueueItem) => {
    if (!canEdit) return;
    const btnLabel = getNextStatusLabel(q.status);
    const target = nextStatus(q.status);
    advanceStatus(q.id);
    push({
      type: 'success',
      title: `${btnLabel} ✓`,
      message: `「${petMap.get(q.petId)?.name}」${QUEUE_STATUS_LABEL[q.status]} → ${QUEUE_STATUS_LABEL[target]}（按钮文案一致）`,
    });
  };

  const confirmAbnormal = () => {
    if (!selectedId) return;
    if (!abnormalReason.trim()) {
      push({ type: 'warning', title: '请填写异常原因' });
      return;
    }
    abnormalEndQueue(selectedId, abnormalReason.trim());
    push({
      type: 'info',
      title: '前台已登记异常结束',
      message: `原因：${abnormalReason}`,
    });
    setAbnormalOpen(false);
    setAbnormalReason('');
    setSelectedId(null);
  };

  const openAddon = (queueId: string) => {
    setAddonTargetId(queueId);
    setAddonOpen(true);
    setPendingAddonSvc(null);
  };

  const confirmAddon = (svc: ServiceType) => {
    if (!addonTargetId) return;
    const r = addAdditionalService({
      queueId: addonTargetId,
      serviceType: svc,
      addedBy: currentRole,
    });
    if (r.needsAllergyConfirm) {
      setPendingAddonSvc(svc);
      setAllergyConfirmOpen(true);
      return;
    }
    push({
      type: r.success ? 'success' : 'error',
      title: r.success ? '追加服务成功' : '追加服务失败',
      message: r.message,
    });
    if (r.success) {
      setAddonOpen(false);
      setAddonTargetId(null);
    }
  };

  const confirmAllergyAndAddon = () => {
    if (!addonTargetId || !pendingAddonSvc) return;
    const r = addAdditionalService({
      queueId: addonTargetId,
      serviceType: pendingAddonSvc,
      allergyRiskConfirmed: true,
      addedBy: currentRole,
    });
    push({
      type: r.success ? 'success' : 'error',
      title: r.success ? '过敏风险已确认，服务追加成功' : '追加服务失败',
      message: r.message,
    });
    if (r.success) {
      setAddonOpen(false);
      setAddonTargetId(null);
      setPendingAddonSvc(null);
    }
    setAllergyConfirmOpen(false);
  };

  const openReassign = (queueId: string) => {
    const q = queueItems.find((x) => x.id === queueId);
    setReassignTargetId(queueId);
    setReassignToGroomerId(
      groomers.find((g) => g.id !== q?.groomerId && g.isOnDutyToday)?.id || ''
    );
    setReassignReason('');
    setReassignOpen(true);
  };

  const confirmReassign = () => {
    if (!reassignTargetId) return;
    if (!reassignToGroomerId) {
      push({ type: 'warning', title: '请选择目标美容师' });
      return;
    }
    if (!reassignReason.trim()) {
      push({ type: 'warning', title: '请填写改派原因' });
      return;
    }
    const r = reassignQueue({
      queueId: reassignTargetId,
      toGroomerId: reassignToGroomerId,
      reason: reassignReason.trim(),
      reassignedBy: currentRole,
    });
    push({
      type: r.success ? 'success' : 'error',
      title: r.success ? '工位改派成功' : '工位改派失败',
      message: r.message,
    });
    if (r.success) {
      setReassignOpen(false);
      setReassignTargetId(null);
      setReassignToGroomerId('');
      setReassignReason('');
    }
  };

  const ctx = { push };
  const selectedQueue = selectedId ? queueItems.find((q) => q.id === selectedId) : null;
  const selectedPet = selectedQueue ? petMap.get(selectedQueue.petId) : null;

  return (
    <ToastCtx.Provider value={ctx}>
      <AppNavbar />
      <ToastContainer toasts={toasts} onClose={close} />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-end justify-between gap-4 flex-wrap"
        >
          <div>
            <p className="text-sm text-pet-slateLight/80 font-medium">
              {currentRole === 'GROOMER' ? '美容师操作中心' : '全局看板'}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-pet-slate mt-1 flex items-center gap-3">
              🎯 宠物美容服务看板
            </h2>
            <p className="text-sm text-pet-slateLight mt-1">
              点击卡片选中 → 前台可追加服务 / 工位改派 / 异常结束；点击推进按钮或拖拽卡片流转状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/register')}
              className="btn-secondary"
              disabled={!canEdit}
            >
              <Crown size={16} /> 新增预约
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status, colIdx) => (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: colIdx * 0.08 }}
              className={`kanban-col ${COL_STYLE[status]}`}
            >
              <div
                className={`rounded-2xl -mx-2 -mt-2 mb-1 px-4 py-3 text-white flex items-center justify-between shadow-soft ${COL_BAR[status]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{QUEUE_STATUS_EMOJI[status]}</span>
                  <div>
                    <p className="font-display text-lg leading-tight">
                      {QUEUE_STATUS_LABEL[status]}
                    </p>
                    <p className="text-[11px] opacity-90 font-mono">
                      {grouped[status].length} 只宠物
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur flex items-center justify-center font-bold">
                  {grouped[status].length}
                </div>
              </div>

              <Reorder.Group
                axis="y"
                values={grouped[status]}
                onReorder={() => {}}
                className="flex-1 flex flex-col gap-3 min-h-[60px]"
              >
                <AnimatePresence mode="popLayout">
                  {grouped[status].length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 flex items-center justify-center text-xs text-pet-slateLight/60 italic py-12"
                    >
                      暂无排队
                    </motion.div>
                  ) : (
                    grouped[status].map((q) => {
                      const pet = petMap.get(q.petId);
                      const groomer = groomerMap.get(q.groomerId);
                      const estStart = computeEstimatedStart(
                        q,
                        activeQueues,
                        groomerBusyUntil
                      );
                      const startedAt =
                        q.status !== 'WAITING_ARRIVAL'
                          ? q.statusChangedAt[q.status]
                          : estStart;
                      const totalMin = computeTotalEstimatedMinutes(q);
                      const estEnd = addMinutes(
                        startedAt || new Date().toISOString(),
                        totalMin
                      );
                      const isSelected = selectedId === q.id;
                      const hasAddons = (q.additionalServices?.length || 0) > 0;
                      const hasReassign = (q.reassignmentLog?.length || 0) > 0;
                      const hasAllergyRisk =
                        (q.additionalServices || []).some((a) => a.allergyRiskConfirmed);
                      return (
                        <Reorder.Item
                          key={q.id}
                          value={q}
                          as="div"
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileDrag={{ scale: 1.03, rotate: 1 }}
                          className={`kanban-card relative ${
                            isSelected ? 'ring-2 ring-pet-orange' : ''
                          }`}
                          onClick={() => setSelectedId(q.id)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-pet-orange to-pet-coral text-white flex items-center justify-center text-xs font-bold shadow-soft">
                                #{q.positionInQueue}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-pet-slate truncate flex items-center gap-1.5">
                                  {pet?.name || '未知宠物'}
                                  {hasAddons && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-pet-mint/15 text-pet-mintDark text-[10px] font-bold"
                                      title={`已追加 ${q.additionalServices.length} 项服务`}
                                    >
                                      <Plus size={10} />
                                      {q.additionalServices.length}
                                    </span>
                                  )}
                                  {hasAllergyRisk && (
                                    <ShieldAlert
                                      size={12}
                                      className="text-pet-coral"
                                      aria-label="含过敏风险加项服务"
                                    />
                                  )}
                                </p>
                                <p className="text-[11px] text-pet-slateLight truncate">
                                  {pet?.breed || pet?.species || ''}
                                </p>
                              </div>
                            </div>
                            {pet && (
                              <span
                                className={`badge ${PET_SIZE_COLOR[pet.size]} !py-0.5 !px-2 flex-shrink-0`}
                              >
                                {PET_SIZE_LABEL[pet.size]}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 mb-3 text-xs">
                            <div className="flex items-center justify-between text-pet-slateLight">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {SERVICE_LABEL[q.serviceType]}
                              </span>
                              <span className="font-mono font-semibold text-pet-orangeDark">
                                {formatMinutes(totalMin)}
                                {hasAddons && (
                                  <span className="text-pet-mintDark ml-1 text-[10px]">
                                    (+{q.additionalServices.reduce((s, a) => s + a.minutes, 0)}m)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-pet-slateLight">
                              <span className="flex items-center gap-1">
                                <User size={12} />{' '}
                                {hasReassign ? (
                                  <span className="flex items-center gap-0.5">
                                    <ArrowRightLeft size={10} className="text-pet-orange" />
                                    {groomer?.name || '待分配'}
                                  </span>
                                ) : (
                                  groomer?.name || '待分配'
                                )}
                              </span>
                              <span className="font-mono">
                                {q.status === 'WAITING_ARRIVAL'
                                  ? `预计 ${formatTime(estStart)}`
                                  : `结束 ${formatTime(estEnd)}`}
                              </span>
                            </div>
                            {hasAddons && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {q.additionalServices.map((a) => (
                                  <span
                                    key={a.id}
                                    className={`px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-0.5 ${
                                      a.allergyRiskConfirmed
                                        ? 'bg-pet-coral/15 text-pet-coralDark border border-pet-coral/30'
                                        : 'bg-pet-mint/15 text-pet-mintDark'
                                    }`}
                                    title={`${a.allergyRiskConfirmed ? '⚠️ 已确认过敏风险' : ''} 追加于 ${formatTime(a.addedAt)}`}
                                  >
                                    {a.allergyRiskConfirmed && <ShieldAlert size={9} />}
                                    +{SERVICE_LABEL[a.serviceType]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {canEdit && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                doAdvance(q);
                              }}
                              className={`w-full py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 text-white transition-all shadow-softer hover:shadow-soft ${
                                q.status === 'PICKUP'
                                  ? 'bg-gradient-to-r from-pet-mint to-pet-mintDark'
                                  : COL_BAR[nextStatusCol(q.status)] || COL_BAR[q.status]
                              }`}
                            >
                              {q.status === 'PICKUP' ? (
                                <>
                                  <CheckCircle2 size={14} /> {getNextStatusLabel(q.status)}
                                </>
                              ) : (
                                <>
                                  {getNextStatusLabel(q.status)} <ArrowRight size={14} />
                                </>
                              )}
                            </motion.button>
                          )}

                          {isSelected && isManagerOrReception && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 flex flex-col gap-1.5"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddon(q.id);
                                }}
                                className="w-full py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 bg-pet-mint/10 text-pet-mintDark border border-pet-mint/30 hover:bg-pet-mint/20 transition-all"
                              >
                                <Plus size={12} /> 追加加项服务
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReassign(q.id);
                                }}
                                disabled={q.status === 'ENDED' || q.status === 'PICKUP'}
                                className="w-full py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 bg-purple-100/70 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ArrowRightLeft size={12} /> 工位改派
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAbnormalOpen(true);
                                }}
                                className="w-full py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 bg-pet-coral/10 text-pet-coralDark border border-pet-coral/30 hover:bg-pet-coral/20 transition-all"
                              >
                                <Ban size={12} /> 前台登记异常结束
                              </button>
                            </motion.div>
                          )}
                        </Reorder.Item>
                      );
                    })
                  )}
                </AnimatePresence>
              </Reorder.Group>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-xs text-pet-slateLight/70"
        >
          💡 操作提示：卡片可拖拽移动、点击选中后前台可追加服务/工位改派/异常结束；顾客视图仅可读。
        </motion.p>
      </div>

      <AnimatePresence>
        {abnormalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pet-slate/40 backdrop-blur-sm"
            onClick={() => setAbnormalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="card max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-pet-coral/15 text-pet-coralDark flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-pet-slate">登记异常结束</h3>
                  <p className="text-sm text-pet-slateLight mt-0.5">
                    此操作将立即结束服务，顾客将无法恢复。请如实填写原因。
                  </p>
                  {selectedPet && (
                    <p className="text-xs text-pet-orange mt-2">
                      目标宠物：{selectedPet.name}（当前状态：
                      {selectedQueue ? QUEUE_STATUS_LABEL[selectedQueue.status] : '—'}）
                    </p>
                  )}
                </div>
              </div>
              <label className="label-text">异常结束原因 *</label>
              <textarea
                className="input-base min-h-[100px] resize-none"
                value={abnormalReason}
                onChange={(e) => setAbnormalReason(e.target.value)}
                placeholder="如：主人临时有事取消、宠物应激中断、设备故障等…"
              />
              <div className="flex gap-2 mt-5">
                <button className="btn-secondary flex-1" onClick={() => setAbnormalOpen(false)}>
                  <LogOut size={16} /> 取消
                </button>
                <button className="btn-danger flex-1" onClick={confirmAbnormal}>
                  <XCircle size={16} /> 确认结束
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addonOpen && selectedQueue && selectedPet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pet-slate/40 backdrop-blur-sm"
            onClick={() => setAddonOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="card max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-pet-mint/15 text-pet-mintDark flex items-center justify-center flex-shrink-0">
                  <Plus size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-2xl text-pet-slate">追加加项服务</h3>
                  <p className="text-sm text-pet-slateLight mt-0.5">
                    选择需要追加的服务项，系统将自动重新计算预计完成时间与排队
                  </p>
                  <div className="mt-3 p-3 rounded-2xl bg-cream-50 text-xs space-y-1">
                    <p className="text-pet-slate">
                      <span className="font-semibold">宠物：</span>
                      {selectedPet.name} · {PET_SIZE_LABEL[selectedPet.size]} ·{' '}
                      {SERVICE_LABEL[selectedQueue.serviceType]}
                    </p>
                    <p className="text-pet-slate">
                      <span className="font-semibold">当前总时长：</span>
                      <span className="font-mono text-pet-orangeDark">
                        {formatMinutes(computeTotalEstimatedMinutes(selectedQueue))}
                      </span>
                    </p>
                    {selectedPet.allergyNotes?.trim() &&
                    selectedPet.allergyNotes.trim() !== '无' ? (
                      <p className="text-pet-coralDark flex items-start gap-1 pt-1">
                        <ShieldAlert size={12} className="mt-0.5 flex-shrink-0" />
                        <span>
                          过敏备注：{selectedPet.allergyNotes}
                          <br />
                          <span className="font-semibold">
                            选择药浴将弹出二次确认对话框，必须标记风险后方可追加。
                          </span>
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                {ADDON_SERVICES.map((svc) => {
                  const addonMinutes = Math.round(
                    SERVICE_BASE_MINUTES[svc] * SIZE_MULTIPLIER[selectedPet.size]
                  );
                  return (
                    <button
                      key={svc}
                      onClick={() => confirmAddon(svc)}
                      className="group p-4 rounded-2xl bg-gradient-to-br from-white to-cream-50 border-2 border-cream-200 hover:border-pet-mint/50 hover:shadow-soft text-left transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-semibold text-pet-slate flex items-center gap-1.5">
                          {svc === 'MEDICATED_BATH' && (
                            <ShieldAlert
                              size={14}
                              className={
                                selectedPet.allergyNotes?.trim() &&
                                selectedPet.allergyNotes.trim() !== '无'
                                  ? 'text-pet-coral'
                                  : 'text-pet-slateLight'
                              }
                            />
                          )}
                          {SERVICE_LABEL[svc]}
                        </div>
                        <Plus size={16} className="text-pet-mintDark opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-pet-slateLight">
                        基础时长 {addonMinutes} 分钟（含体型系数 ×{SIZE_MULTIPLIER[selectedPet.size]}）
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-cream-100">
                <button className="btn-secondary" onClick={() => setAddonOpen(false)}>
                  <LogOut size={16} /> 关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {allergyConfirmOpen && selectedPet && pendingAddonSvc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-pet-coral/20 backdrop-blur-sm"
            onClick={() => setAllergyConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="card max-w-md w-full border-2 border-pet-coral/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-pet-coral/20 text-pet-coralDark flex items-center justify-center flex-shrink-0 animate-breathe">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-pet-coralDark">
                    ⚠️ 过敏风险确认
                  </h3>
                  <p className="text-sm text-pet-slate mt-1">
                    该宠物存在过敏备注，药浴服务可能引发过敏反应。请确认已与主人沟通并获得知情同意。
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-pet-coral/10 border border-pet-coral/20 space-y-2 mb-5 text-sm">
                <p>
                  <span className="font-semibold text-pet-slate">宠物：</span>
                  <span className="text-pet-coralDark">{selectedPet.name}</span>
                </p>
                <p>
                  <span className="font-semibold text-pet-slate">过敏备注：</span>
                  <span className="text-pet-coralDark">{selectedPet.allergyNotes}</span>
                </p>
                <p>
                  <span className="font-semibold text-pet-slate">拟追加服务：</span>
                  <span className="text-pet-coralDark">{SERVICE_LABEL[pendingAddonSvc]}</span>
                </p>
                <p className="text-xs text-pet-slateLight pt-1">
                  ☑️ 确认后，该加项将被标记为「过敏风险已确认」，留痕备查。
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setAllergyConfirmOpen(false)}
                >
                  取消
                </button>
                <button
                  className="btn-danger flex-1"
                  onClick={confirmAllergyAndAddon}
                >
                  <ShieldAlert size={14} /> 我已确认，追加服务
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reassignOpen && selectedQueue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pet-slate/40 backdrop-blur-sm"
            onClick={() => setReassignOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="card max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft size={24} />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-pet-slate">工位改派</h3>
                  <p className="text-sm text-pet-slateLight mt-0.5">
                    将该订单改派给其他美容师。必须填写改派原因以便后续追溯。
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-cream-50 mb-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold text-pet-slateLight w-20 inline-block">
                    宠物：
                  </span>
                  {petMap.get(selectedQueue.petId)?.name}（
                  {petMap.get(selectedQueue.petId) &&
                    PET_SIZE_LABEL[petMap.get(selectedQueue.petId)!.size]}
                  ）
                </p>
                <p>
                  <span className="font-semibold text-pet-slateLight w-20 inline-block">
                    当前美容师：
                  </span>
                  {groomerMap.get(selectedQueue.groomerId)?.name}
                </p>
                <p>
                  <span className="font-semibold text-pet-slateLight w-20 inline-block">
                    当前状态：
                  </span>
                  {QUEUE_STATUS_LABEL[selectedQueue.status]}
                </p>
                <p>
                  <span className="font-semibold text-pet-slateLight w-20 inline-block">
                    已改派：
                  </span>
                  {selectedQueue.reassignmentLog.length} 次
                </p>
              </div>

              <label className="label-text flex items-center gap-1.5">
                <UserX size={14} /> 改派到美容师 *
              </label>
              <select
                className="input-base"
                value={reassignToGroomerId}
                onChange={(e) => setReassignToGroomerId(e.target.value)}
              >
                <option value="">请选择美容师…</option>
                {groomers
                  .filter(
                    (g) => g.id !== selectedQueue.groomerId && g.isOnDutyToday
                  )
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.avatarEmoji} {g.name}（{g.employeeNo}）
                    </option>
                  ))}
              </select>

              <label className="label-text mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} /> 改派原因 *
              </label>
              <textarea
                className="input-base min-h-[88px] resize-none"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="如：美容师临时离岗 / 工位冲突 / 按技能专长分配 / 顾客指定等…"
              />
              <p className="text-[11px] text-pet-slateLight mt-1.5">
                ☑️ 该原因将与美容师变更一同写入订单改派日志，永久留痕。
              </p>

              <div className="flex gap-2 mt-5">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setReassignOpen(false)}
                >
                  <LogOut size={16} /> 取消
                </button>
                <button className="btn-primary flex-1" onClick={confirmReassign}>
                  <CheckCircle2 size={16} /> 确认改派
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

function nextStatusCol(cur: QueueStatus): QueueStatus {
  switch (cur) {
    case 'WAITING_ARRIVAL':
      return 'WASHING';
    case 'WASHING':
      return 'DRYING';
    case 'DRYING':
      return 'PICKUP';
    default:
      return cur;
  }
}
