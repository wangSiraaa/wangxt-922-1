import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Groomer,
  Pet,
  QueueItem,
  QueueStatus,
  ServiceType,
  UserRole,
} from '@/types';
import {
  calculateDuration,
  findDuplicateTodayQueue,
  formatTodayKey,
  nextStatus,
  uid,
  validateVaccine,
} from '@/utils/businessRules';
import { getInitialStorage, SCHEMA_VERSION } from '@/utils/seedData';

interface AppState {
  __schema_version: string;
  __last_migrated: string;
  currentRole: UserRole;
  groomers: Groomer[];
  pets: Pet[];
  queueItems: QueueItem[];

  setRole: (r: UserRole) => void;

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

      setRole: (r) => set({ currentRole: r }),

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
        };
        set((s) => ({ queueItems: [...s.queueItems, queue] }));
        return { success: true, queue };
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
      },

      resetAll: () => {
        set({ ...getInitialStorage() });
      },
    }),
    {
      name: 'pet-grooming-queue-storage',
      version: 0,
      migrate: (persistedState: any, version) => {
        if (
          !persistedState ||
          typeof persistedState !== 'object' ||
          (persistedState as any).__schema_version !== SCHEMA_VERSION
        ) {
          return getInitialStorage();
        }
        if (version === 0) return persistedState;
        return persistedState;
      },
    }
  )
);
