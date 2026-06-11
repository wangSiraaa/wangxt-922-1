import {
  PetSize,
  QueueStatus,
  ServiceType,
  QueueItem,
  SERVICE_BASE_MINUTES,
  SIZE_MULTIPLIER,
} from '@/types';

export function validateVaccine(vaccineExpiry: string | null): { valid: boolean; message: string } {
  if (!vaccineExpiry) {
    return { valid: false, message: '疫苗有效期未填写，无法预约。请先补录疫苗信息。' };
  }
  const expiry = new Date(vaccineExpiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  if (expiry.getTime() < today.getTime()) {
    return {
      valid: false,
      message: `疫苗已过期（有效期至 ${vaccineExpiry}），为宠物安全考虑暂无法预约，请先补种疫苗。`,
    };
  }
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 14) {
    return {
      valid: true,
      message: `疫苗将于 ${diffDays} 天后到期，建议尽快安排补种。`,
    };
  }
  return { valid: true, message: '疫苗有效期校验通过。' };
}

export function isVaccineExpiringSoon(vaccineExpiry: string | null): boolean {
  if (!vaccineExpiry) return true;
  const expiry = new Date(vaccineExpiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 14;
}

export function isVaccineExpired(vaccineExpiry: string | null): boolean {
  if (!vaccineExpiry) return true;
  const expiry = new Date(vaccineExpiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}

export function calculateDuration(serviceType: ServiceType, size: PetSize): number {
  const base = SERVICE_BASE_MINUTES[serviceType];
  const mult = SIZE_MULTIPLIER[size];
  return Math.round(base * mult);
}

export function formatTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function findDuplicateTodayQueue(
  petId: string,
  today: string,
  allQueues: QueueItem[]
): QueueItem | null {
  return (
    allQueues.find(
      (q) => q.petId === petId && q.date === today && q.status !== 'ENDED'
    ) || null
  );
}

export function canCustomerCancel(status: QueueStatus): boolean {
  return status === 'WAITING_ARRIVAL';
}

export function nextStatus(current: QueueStatus): QueueStatus {
  switch (current) {
    case 'WAITING_ARRIVAL':
      return 'WASHING';
    case 'WASHING':
      return 'DRYING';
    case 'DRYING':
      return 'PICKUP';
    case 'PICKUP':
      return 'ENDED';
    default:
      return current;
  }
}

export function getNextStatusLabel(current: QueueStatus): string {
  const next = nextStatus(current);
  if (next === current) return '已完成';
  const map: Record<QueueStatus, string> = {
    WAITING_ARRIVAL: '开始洗护',
    WASHING: '吹干定型',
    DRYING: '等待接走',
    PICKUP: '确认接走',
    ENDED: '—',
  };
  return map[next];
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}

export function addMinutes(isoTime: string, minutes: number): string {
  const t = new Date(isoTime);
  t.setMinutes(t.getMinutes() + minutes);
  return t.toISOString();
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function uid(prefix = ''): string {
  return (
    prefix +
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 7)
  );
}

export function computeEstimatedStart(
  queue: QueueItem,
  allQueues: QueueItem[],
  groomerBusyUntil: Record<string, string>
): string {
  const sameGroomerEarlier = allQueues
    .filter(
      (q) =>
        q.groomerId === queue.groomerId &&
        q.status !== 'ENDED' &&
        q.createdAt < queue.createdAt &&
        q.id !== queue.id
    )
    .sort((a, b) => a.positionInQueue - b.positionInQueue);

  let baseTime = groomerBusyUntil[queue.groomerId] || new Date().toISOString();
  for (const q of sameGroomerEarlier) {
    baseTime = addMinutes(baseTime, q.estimatedMinutes);
  }
  return baseTime;
}
