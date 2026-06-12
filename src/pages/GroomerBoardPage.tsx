import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  LogOut,
  User,
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
  PET_SIZE_COLOR,
  PET_SIZE_LABEL,
  QUEUE_STATUS_EMOJI,
  QUEUE_STATUS_LABEL,
  QueueItem,
  QueueStatus,
  SERVICE_LABEL,
  UserRole,
} from '@/types';
import {
  addMinutes,
  computeEstimatedStart,
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
    currentRole,
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
        Math.max(10, Math.round(last.estimatedMinutes * 0.7))
      );
    }
  }

  const canEdit = currentRole !== 'CUSTOMER';

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

  const ctx = { push };

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
              点击卡片上的「推进」按钮或直接拖拽卡片，将宠物从一列移动到下一列
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
                      const estEnd = addMinutes(
                        startedAt || new Date().toISOString(),
                        q.estimatedMinutes
                      );
                      const isSelected = selectedId === q.id;
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
                                <p className="font-semibold text-pet-slate truncate">
                                  {pet?.name || '未知宠物'}
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
                                {formatMinutes(q.estimatedMinutes)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-pet-slateLight">
                              <span className="flex items-center gap-1">
                                <User size={12} /> {groomer?.name || '待分配'}
                              </span>
                              <span className="font-mono">
                                {q.status === 'WAITING_ARRIVAL'
                                  ? `预计 ${formatTime(estStart)}`
                                  : `结束 ${formatTime(estEnd)}`}
                              </span>
                            </div>
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

                          {isSelected && currentRole === 'RECEPTIONIST' && (
                            <motion.button
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 w-full py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 bg-pet-coral/10 text-pet-coralDark border border-pet-coral/30 hover:bg-pet-coral/20 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAbnormalOpen(true);
                              }}
                            >
                              <Ban size={12} /> 前台登记异常结束
                            </motion.button>
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
          💡 操作提示：卡片可拖拽移动、点击选中后前台可登记异常结束；顾客视图仅可读。
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
