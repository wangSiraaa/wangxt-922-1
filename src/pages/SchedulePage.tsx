import { motion } from 'framer-motion';
import { Clock, Dog, Scissors, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  PET_SIZE_COLOR,
  PET_SIZE_LABEL,
  QUEUE_STATUS_EMOJI,
  QUEUE_STATUS_LABEL,
  SERVICE_LABEL,
} from '@/types';
import {
  addMinutes,
  computeEstimatedStart,
  computeTotalEstimatedMinutes,
  formatMinutes,
  formatTime,
} from '@/utils/businessRules';

export default function SchedulePage() {
  const { groomers, queueItems, pets } = useAppStore();
  const todayQueues = queueItems.filter((q) => q.status !== 'ENDED');

  const groomerBusyUntil: Record<string, string> = {};
  for (const g of groomers) {
    const active = todayQueues
      .filter((q) => q.groomerId === g.id && q.status !== 'WAITING_ARRIVAL')
      .sort((a, b) => (a.statusChangedAt[a.status] || '').localeCompare(b.statusChangedAt[b.status] || ''));
    if (active.length > 0) {
      const last = active[active.length - 1];
      const startedAt = last.statusChangedAt[last.status] || last.createdAt;
      groomerBusyUntil[g.id] = addMinutes(
        startedAt,
        Math.max(10, Math.round(computeTotalEstimatedMinutes(last) * 0.7))
      );
    }
  }

  const stats = [
    { icon: Users, label: '在岗美容师', value: groomers.filter(g => g.isOnDutyToday).length, color: 'from-pet-mint to-pet-mintDark' },
    { icon: Dog, label: '待服务宠物', value: todayQueues.filter(q => q.status === 'WAITING_ARRIVAL').length, color: 'from-pet-orange to-pet-orangeDark' },
    { icon: Scissors, label: '进行中', value: todayQueues.filter(q => ['WASHING', 'DRYING'].includes(q.status)).length, color: 'from-pet-slate to-pet-slateLight' },
    { icon: Sparkles, label: '待接走', value: todayQueues.filter(q => q.status === 'PICKUP').length, color: 'from-pet-amber to-pet-coral' },
  ];

  const petMap = new Map(pets.map(p => [p.id, p]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="text-sm text-pet-slateLight/80 font-medium">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-pet-slate mt-1">
            今日门店排班 · 工位一览
          </h2>
        </div>
        <div className="flex gap-2">
          <Link to="/register" className="btn-primary">
            <Sparkles size={18} /> 新建预约
          </Link>
          <Link to="/board" className="btn-secondary">
            <Scissors size={18} /> 进入看板
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card !p-5 group hover:-translate-y-1 transition-transform"
          >
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-soft mb-3 group-hover:scale-110 transition-transform`}>
              <s.icon size={20} />
            </div>
            <p className="font-mono text-3xl font-semibold text-pet-slate">{s.value}</p>
            <p className="text-sm text-pet-slateLight mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl text-pet-slate flex items-center gap-2">
            <Clock size={20} className="text-pet-orange" /> 美容师工位时间轴
          </h3>
          <div className="flex items-center gap-3 text-xs text-pet-slateLight">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pet-mint" />小型</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pet-amber" />中型</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pet-orange" />大型</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pet-coral" />巨型</span>
          </div>
        </div>

        <div className="space-y-4 overflow-x-auto pb-2">
          {groomers.filter(g => g.isOnDutyToday).map((g, gi) => {
            const gQueues = todayQueues
              .filter(q => q.groomerId === g.id)
              .sort((a, b) => a.positionInQueue - b.positionInQueue);

            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + gi * 0.08 }}
                className="flex items-center gap-4 min-w-[720px]"
              >
                <div className="w-40 flex-shrink-0 flex items-center gap-3 p-3 bg-cream-100 rounded-2xl">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cream-200 to-cream-100 flex items-center justify-center text-2xl border-2 border-white shadow-soft">
                      {g.avatarEmoji}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-pet-mint border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-pet-slate truncate">{g.name}</p>
                    <p className="text-xs text-pet-slateLight font-mono">{g.employeeNo}</p>
                    <p className="text-xs text-pet-orange mt-0.5">{gQueues.length} 单排队</p>
                  </div>
                </div>

                <div className="flex-1 relative h-16 rounded-2xl bg-cream-100/60 overflow-hidden flex">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-dashed border-cream-200 last:border-r-0" />
                  ))}
                  <div className="absolute inset-0 flex items-stretch p-1.5 gap-1.5">
                    {gQueues.length === 0 ? (
                      <div className="w-full flex items-center justify-center text-xs text-pet-slateLight/60 italic">
                        暂无预约 · 空闲中
                      </div>
                    ) : (
                      gQueues.map((q, qi) => {
                        const pet = petMap.get(q.petId);
                        const totalMin = computeTotalEstimatedMinutes(q);
                        const hasAddons = (q.additionalServices?.length || 0) > 0;
                        const widthPct = Math.min(100, Math.max(8, (totalMin / 240) * 100));
                        const estStart = computeEstimatedStart(q, todayQueues, groomerBusyUntil);
                        const colorClass: Record<string, string> = {
                          SMALL: 'bg-gradient-to-r from-pet-mint to-pet-mintLight',
                          MEDIUM: 'bg-gradient-to-r from-pet-amber to-pet-amberLight',
                          LARGE: 'bg-gradient-to-r from-pet-orange to-pet-orangeLight',
                          GIANT: 'bg-gradient-to-r from-pet-coral to-pet-coralLight',
                        };
                        const qStatusBg: Record<string, string> = {
                          WAITING_ARRIVAL: 'ring-2 ring-dashed ring-pet-slateLight/30 opacity-80',
                          WASHING: 'ring-2 ring-pet-coral animate-pulse-soft',
                          DRYING: 'ring-2 ring-pet-slate',
                          PICKUP: 'ring-2 ring-pet-mint',
                          ENDED: 'opacity-50 grayscale',
                        };
                        return (
                          <motion.div
                            key={q.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.4 + gi * 0.08 + qi * 0.06 }}
                            style={{ width: `${widthPct}%` }}
                            className={`relative rounded-xl text-white text-xs p-2 shadow-soft overflow-hidden flex flex-col justify-between ${colorClass[pet?.size || 'SMALL']} ${qStatusBg[q.status]}`}
                            title={`${pet?.name || '宠物'} · ${SERVICE_LABEL[q.serviceType]}${hasAddons ? ` (+${q.additionalServices.length}加项)` : ''} · ${formatMinutes(totalMin)} · ${QUEUE_STATUS_LABEL[q.status]}`}
                          >
                            <div className="flex items-center justify-between gap-1 z-10">
                              <span className="font-bold truncate">{pet?.name || '?'}</span>
                              <span className="text-base">{QUEUE_STATUS_EMOJI[q.status]}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[10px] opacity-90 z-10">
                              <span className="truncate">
                                {SERVICE_LABEL[q.serviceType]}
                                {hasAddons && <span className="opacity-80"> +{q.additionalServices.length}</span>}
                              </span>
                              <span className="font-mono whitespace-nowrap">
                                {formatMinutes(totalMin)}
                              </span>
                            </div>
                            {q.status === 'WAITING_ARRIVAL' && (
                              <div className="absolute bottom-1 left-2 text-[10px] font-mono opacity-95 z-10">
                                预计 {formatTime(estStart)} 开始
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-pet-slateLight">
          <span>时间轴刻度：</span>
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="font-mono">{9 + i * 2}:00{i < 6 ? '　' : ''}</span>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid md:grid-cols-2 gap-6"
      >
        <div className="card">
          <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
            <Users size={20} className="text-pet-mint" /> 今日排队总览
          </h3>
          {todayQueues.length === 0 ? (
            <p className="text-pet-slateLight/70 text-sm italic">暂无排队单</p>
          ) : (
            <ul className="space-y-2.5">
              {todayQueues.map((q, i) => {
                const pet = petMap.get(q.petId);
                const groomer = groomers.find(g => g.id === q.groomerId);
                const totalMin = computeTotalEstimatedMinutes(q);
                const addonCnt = q.additionalServices?.length || 0;
                return (
                  <motion.li
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.04 }}
                    className="flex items-center gap-3 p-3 bg-cream-50 rounded-2xl hover:bg-white hover:shadow-softer transition-all"
                  >
                    <span className="w-8 h-8 rounded-full bg-pet-orange/10 text-pet-orangeDark flex items-center justify-center font-bold text-sm">
                      #{q.positionInQueue}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-pet-slate truncate flex items-center gap-2">
                        {pet?.name || '未知宠物'}
                        {pet && <span className={`badge ${PET_SIZE_COLOR[pet.size]} !py-0.5 !px-2`}>{PET_SIZE_LABEL[pet.size]}</span>}
                        {addonCnt > 0 && (
                          <span className="badge bg-pet-mint/15 text-pet-mintDark !py-0.5 !px-2">
                            +{addonCnt}项
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-pet-slateLight truncate">
                        {SERVICE_LABEL[q.serviceType]} · {groomer?.name} · {formatMinutes(totalMin)}
                        {addonCnt > 0 && q.reassignmentLog?.length > 0 && ` · 改派${q.reassignmentLog.length}次`}
                      </p>
                    </div>
                    <span className="text-xl">{QUEUE_STATUS_EMOJI[q.status]}</span>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card bg-gradient-to-br from-pet-orange/5 via-white to-pet-mint/5">
          <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-pet-orange" /> 快速操作入口
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/register" className="group p-5 bg-white rounded-2xl shadow-softer hover:shadow-soft hover:-translate-y-0.5 transition-all border border-pet-orange/10">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📝</div>
              <p className="font-semibold text-pet-slate">宠物建档预约</p>
              <p className="text-xs text-pet-slateLight mt-1">录入信息、疫苗校验、生成排队单</p>
            </Link>
            <Link to="/board" className="group p-5 bg-white rounded-2xl shadow-softer hover:shadow-soft hover:-translate-y-0.5 transition-all border border-pet-mint/10">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🎯</div>
              <p className="font-semibold text-pet-slate">美容师看板</p>
              <p className="text-xs text-pet-slateLight mt-1">状态推进、可视化流程管理</p>
            </Link>
            <Link to="/customer" className="group p-5 bg-white rounded-2xl shadow-softer hover:shadow-soft hover:-translate-y-0.5 transition-all border border-pet-amber/20">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">👀</div>
              <p className="font-semibold text-pet-slate">顾客自助查询</p>
              <p className="text-xs text-pet-slateLight mt-1">查询进度、预计时间、取消预约</p>
            </Link>
            <Link to="/validate" className="group p-5 bg-white rounded-2xl shadow-softer hover:shadow-soft hover:-translate-y-0.5 transition-all border border-pet-slate/10">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">✅</div>
              <p className="font-semibold text-pet-slate">验证面板</p>
              <p className="text-xs text-pet-slateLight mt-1">一键运行核心规则验证用例</p>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
