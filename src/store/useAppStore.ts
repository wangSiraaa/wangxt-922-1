import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AdditionalServiceItem,
  Groomer,
  Pet,
  QueueItem,
  QueueStatus,
  ReassignmentLog,
  ServiceType,
  StoreConfig,
  UserRole,
} from '@/types';
import {
  calculateDuration,
  canAddServiceToQueue,
  canReassignQueue,
  computeTotalEstimatedMinutes,
  findDuplicateTodayQueue,
  formatTodayKey,
  nextStatus,
  uid,
  validateVaccine,
} from '@/utils/businessRules';
import { DEFAULT_STORE_CONFIG, getInitialStorage, SCHEMA_VERSION } from '@/utils/seedData';

interface AppState {
  __schema_version: string;
  __last_migrated: string;
  currentRole: UserRole;
  groomers: Groomer[];
  pets: Pet[];
  queueItems: QueueItem[];
  storeConfig: StoreConfig;

  setRole: (r: UserRole) => void;
  setStoreConfig: (c: StoreConfig) => void;

  addPet: (petData: Omit<Pet, 'id' | 'createdAt'>) => Pet;

  submitQueue: (input: {
    petId: string;
    serviceType: ServiceType;
    groomerId: string;
  }) => {
    success: boolean;
    reason?: 'VACCINE_INVALID' | 'DUPLICATE_TODAY';
    message?: string;
    duplicateQueueId?: string;
    queue?: QueueItem;
  };

  addAdditionalService: (input: {
    queueId: string;
    serviceType: ServiceType;
    allergyRiskConfirmed?: boolean;
    addedBy: UserRole;
  }) => {
    success: boolean;
    message: string;
    needsAllergyConfirm?: boolean;
    newTotalMinutes?: number;
  };

  reassignQueue: (input: {
    queueId: string;
    toGroomerId: string;
    reason: string;
    reassignedBy: UserRole;
  }) => {
    success: boolean;
    message: string;
  };

  recalcQueuePositions: () => void;

  advanceStatus: (queueId: string) => void;

  cancelQueueByCustomer: (queueId: string) => { success: boolean; message: string };

  abnormalEndQueue: (queueId: string, reason: string) => void;

  resetAll: () => void;
}

const emptySC: Record<QueueStatus, string | null> = {
  WAITING_ARRIVAL: null,
  WASHING: null,
  DRYING: null,
  PICKUP: null,
  ENDED: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...getInitialStorage(),
      storeConfig: DEFAULT_STORE_CONFIG,

      setRole: (r) => set({ currentRole: r }),
      setStoreConfig: (c) => set({ storeConfig: c }),

      addPet: (petData) => {
        const pet: Pet = {
          ...petData,
          id: uid('pet_'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ pets: [...s.pets, pet] }));
        return pet;
      },

      submitQueue: ({ petId, serviceType, groomerId }) => {
        const { pets, queueItems } = get();
        const pet = pets.find((p) => p.id === petId);
        if (!pet) return { success: false, message: '宠物档案不存在' };

        const v = validateVaccine(pet.vaccineExpiry);
        if (!v.valid) {
          return {
            success: false,
            reason: 'VACCINE_INVALID',
            message: v.message,
          };
        }

        const today = formatTodayKey();
        const dup = findDuplicateTodayQueue(petId, today, queueItems);
        if (dup) {
          return {
            success: false,
            reason: 'DUPLICATE_TODAY',
            message: `宠物「${pet.name}」今日已有排队单，已跳转到原单。`,
            duplicateQueueId: dup.id,
          };
        }

        const groomerQueues = queueItems
          .filter((q) => q.groomerId === groomerId && q.status !== 'ENDED')
          .sort((a, b) => a.positionInQueue - b.positionInQueue);
        const nextPos = groomerQueues.length
          ? groomerQueues[groomerQueues.length - 1].positionInQueue + 1
          : 1;

        const now = new Date().toISOString();
        const queue: QueueItem = {
          id: uid('q_'),
          petId,
          serviceType,
          groomerId,
          status: 'WAITING_ARRIVAL',
          estimatedMinutes: calculateDuration(serviceType, pet.size),
          positionInQueue: nextPos,
          statusChangedAt: { ...emptySC, WAITING_ARRIVAL: now },
          abnormalEndReason: null,
          createdAt: now,
          date: today,
          additionalServices: [],
          reassignmentLog: [],
        };
        set((s) => ({ queueItems: [...s.queueItems, queue] }));
        return { success: true, queue };
      },

      addAdditionalService: ({ queueId, serviceType, allergyRiskConfirmed = false, addedBy }) => {
        const { queueItems, pets, storeConfig, groomers } = get();
        const queue = queueItems.find((q) => q.id === queueId);
        if (!queue) return { success: false, message: '排队单不存在' };

        const pet = pets.find((p) => p.id === queue.petId);
        if (!pet) return { success: false, message: '宠物档案不存在' };

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
            groomerBusyUntil[g.id] = addMinutesLocal(
              startedAt,
              Math.max(10, Math.round(computeTotalEstimatedMinutes(last) * 0.7))
            );
          }
        }

        const check = canAddServiceToQueue(
          queue,
          serviceType,
          pet.size,
          pet.allergyNotes,
          storeConfig,
          queueItems,
          groomerBusyUntil
        );

        if (check.needsAllergyConfirm && !allergyRiskConfirmed) {
          return {
            success: false,
            message: `宠物「${pet.name}」存在过敏备注「${pet.allergyNotes}」，追加药浴需二次确认风险。`,
            needsAllergyConfirm: true,
          };
        }

        if (!check.allowed) {
          return { success: false, message: check.reason || '无法追加该服务' };
        }

        const addonMinutes = calculateDuration(serviceType, pet.size);
        const addon: AdditionalServiceItem = {
          id: uid('addon_'),
          serviceType,
          addedAt: new Date().toISOString(),
          addedBy,
          allergyRiskConfirmed: check.needsAllergyConfirm ? allergyRiskConfirmed : false,
          minutes: addonMinutes,
        };

        set((s) => ({
          queueItems: s.queueItems.map((q) =>
            q.id === queueId
              ? {
                  ...q,
                  additionalServices: [...q.additionalServices, addon],
                }
              : q
          ),
        }));

        const newTotal = computeTotalEstimatedMinutes({
          ...queue,
          additionalServices: [...queue.additionalServices, addon],
        });
        get().recalcQueuePositions();
        return {
          success: true,
          message: `已追加服务，预计总时长从 ${computeTotalEstimatedMinutes(queue)} 分钟增加至 ${newTotal} 分钟`,
          newTotalMinutes: newTotal,
        };
      },

      reassignQueue: ({ queueId, toGroomerId, reason, reassignedBy }) => {
        const { queueItems, groomers } = get();
        const queue = queueItems.find((q) => q.id === queueId);
        if (!queue) return { success: false, message: '排队单不存在' };

        const check = canReassignQueue(queue, toGroomerId);
        if (!check.allowed) {
          return { success: false, message: check.reason || '改派校验失败' };
        }
        if (!reason.trim()) {
          return { success: false, message: '必须填写改派原因' };
        }
        const targetGroomer = groomers.find((g) => g.id === toGroomerId);
        if (!targetGroomer) return { success: false, message: '目标美容师不存在' };

        const fromGroomerId = queue.groomerId;

        set((s) => {
          const oldGroomerQueues = s.queueItems
            .filter((q) => q.groomerId === fromGroomerId && q.status !== 'ENDED')
            .sort((a, b) => a.positionInQueue - b.positionInQueue);
          const newGroomerQueues = s.queueItems
            .filter((q) => q.groomerId === toGroomerId && q.status !== 'ENDED')
            .sort((a, b) => a.positionInQueue - b.positionInQueue);
          const newPos = newGroomerQueues.length
            ? newGroomerQueues[newGroomerQueues.length - 1].positionInQueue + 1
            : 1;

          const log: ReassignmentLog = {
            id: uid('reassign_'),
            fromGroomerId,
            toGroomerId,
            reason: reason.trim(),
            reassignedAt: new Date().toISOString(),
            reassignedBy,
          };

          let updated = s.queueItems.map((q) => {
            if (q.id === queueId) {
              return {
                ...q,
                groomerId: toGroomerId,
                positionInQueue: newPos,
                reassignmentLog: [...q.reassignmentLog, log],
              };
            }
            return q;
          });

          updated = updated.map((q) => {
            if (
              q.groomerId === fromGroomerId &&
              q.id !== queueId &&
              q.status !== 'ENDED' &&
              q.positionInQueue > queue.positionInQueue
            ) {
              return { ...q, positionInQueue: q.positionInQueue - 1 };
            }
            return q;
          });

          return { queueItems: updated };
        });

        get().recalcQueuePositions();
        const fromG = groomers.find((g) => g.id === fromGroomerId);
        return {
          success: true,
          message: `已将订单从「${fromG?.name}」改派给「${targetGroomer.name}」，原因：${reason.trim()}`,
        };
      },

      recalcQueuePositions: () => {
        set((s) => {
          const byGroomer: Record<string, QueueItem[]> = {};
          for (const g of s.groomers) byGroomer[g.id] = [];
          for (const q of s.queueItems) {
            if (q.status === 'ENDED') continue;
            if (!byGroomer[q.groomerId]) byGroomer[q.groomerId] = [];
            byGroomer[q.groomerId].push(q);
          }
          for (const gid of Object.keys(byGroomer)) {
            byGroomer[gid].sort((a, b) => {
              if (a.status !== b.status) {
                const order: Record<QueueStatus, number> = {
                  WASHING: 0,
                  DRYING: 1,
                  WAITING_ARRIVAL: 2,
                  PICKUP: 3,
                  ENDED: 4,
                };
                return order[a.status] - order[b.status];
              }
              return a.createdAt.localeCompare(b.createdAt);
            });
          }
          const queueMap = new Map<string, number>();
          for (const gid of Object.keys(byGroomer)) {
            byGroomer[gid].forEach((q, idx) => {
              queueMap.set(q.id, idx + 1);
            });
          }
          return {
            queueItems: s.queueItems.map((q) =>
              queueMap.has(q.id)
                ? { ...q, positionInQueue: queueMap.get(q.id)! }
                : q
            ),
          };
        });
      },

      advanceStatus: (queueId) => {
        set((s) => ({
          queueItems: s.queueItems.map((q) => {
            if (q.id !== queueId) return q;
            if (q.status === 'ENDED') return q;
            const ns = nextStatus(q.status);
            const now = new Date().toISOString();
            return {
              ...q,
              status: ns,
              statusChangedAt: { ...q.statusChangedAt, [ns]: now },
            };
          }),
        }));
      },

      cancelQueueByCustomer: (queueId) => {
        const q = get().queueItems.find((x) => x.id === queueId);
        if (!q) return { success: false, message: '排队单不存在' };
        if (q.status !== 'WAITING_ARRIVAL') {
          return {
            success: false,
            message:
              '服务已开始，顾客无法自助取消。请联系前台登记异常结束。',
          };
        }
        set((s) => ({
          queueItems: s.queueItems.map((x) =>
            x.id === queueId
              ? {
                  ...x,
                  status: 'ENDED',
                  statusChangedAt: {
                    ...x.statusChangedAt,
                    ENDED: new Date().toISOString(),
                  },
                  abnormalEndReason: '顾客自助取消（待到店阶段）',
                }
              : x
          ),
        }));
        get().recalcQueuePositions();
        return { success: true, message: '预约已成功取消。' };
      },

      abnormalEndQueue: (queueId, reason) => {
        set((s) => ({
          queueItems: s.queueItems.map((x) =>
            x.id === queueId
              ? {
                  ...x,
                  status: 'ENDED',
                  statusChangedAt: {
                    ...x.statusChangedAt,
                    ENDED: new Date().toISOString(),
                  },
                  abnormalEndReason: reason || '前台登记异常结束',
                }
              : x
          ),
        }));
        get().recalcQueuePositions();
      },

      resetAll: () => {
        set({ ...getInitialStorage(), storeConfig: DEFAULT_STORE_CONFIG });
      },
    }),
    {
      name: 'pet-grooming-queue-storage',
      version: 1,
      migrate: (persistedState: any, version) => {
        if (
          !persistedState ||
          typeof persistedState !== 'object' ||
          (persistedState as any).__schema_version !== SCHEMA_VERSION
        ) {
          return { ...getInitialStorage(), storeConfig: DEFAULT_STORE_CONFIG };
        }
        const state = persistedState as any;
        if (state.queueItems && Array.isArray(state.queueItems)) {
          state.queueItems = state.queueItems.map((q: any) => ({
            additionalServices: [],
            reassignmentLog: [],
            ...q,
          }));
        }
        if (!state.storeConfig) {
          state.storeConfig = DEFAULT_STORE_CONFIG;
        }
        return state;
      },
    }
  )
);

function addMinutesLocal(isoTime: string, minutes: number): string {
  const t = new Date(isoTime);
  t.setMinutes(t.getMinutes() + minutes);
  return t.toISOString();
}
