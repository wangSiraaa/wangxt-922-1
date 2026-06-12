export type PetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
export type QueueStatus = 'WAITING_ARRIVAL' | 'WASHING' | 'DRYING' | 'PICKUP' | 'ENDED';
export type ServiceType = 'BASIC_WASH' | 'PREMIUM_WASH' | 'SPA' | 'STYLING' | 'MEDICATED_BATH' | 'NAIL_TRIM';
export type UserRole = 'RECEPTIONIST' | 'GROOMER' | 'CUSTOMER';
export type Gender = 'M' | 'F';

export const PET_SIZE_LABEL: Record<PetSize, string> = {
  SMALL: '小型',
  MEDIUM: '中型',
  LARGE: '大型',
  GIANT: '巨型',
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  WAITING_ARRIVAL: '待到店',
  WASHING: '洗护中',
  DRYING: '吹干',
  PICKUP: '待接走',
  ENDED: '已结束',
};

export const QUEUE_STATUS_EMOJI: Record<QueueStatus, string> = {
  WAITING_ARRIVAL: '🐾',
  WASHING: '🛁',
  DRYING: '💨',
  PICKUP: '🏠',
  ENDED: '✅',
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  BASIC_WASH: '基础洗护',
  PREMIUM_WASH: '精洗护理',
  SPA: 'SPA水疗',
  STYLING: '造型修剪',
  MEDICATED_BATH: '药浴',
  NAIL_TRIM: '修甲',
};

export const SERVICE_BASE_MINUTES: Record<ServiceType, number> = {
  BASIC_WASH: 60,
  PREMIUM_WASH: 90,
  SPA: 120,
  STYLING: 150,
  MEDICATED_BATH: 45,
  NAIL_TRIM: 20,
};

export const ADDON_SERVICES: ServiceType[] = ['MEDICATED_BATH', 'NAIL_TRIM', 'STYLING'];

export const SIZE_MULTIPLIER: Record<PetSize, number> = {
  SMALL: 1.0,
  MEDIUM: 1.2,
  LARGE: 1.5,
  GIANT: 2.0,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  RECEPTIONIST: '前台',
  GROOMER: '美容师',
  CUSTOMER: '顾客',
};

export const PET_SIZE_COLOR: Record<PetSize, string> = {
  SMALL: 'bg-pet-mint/20 text-pet-mintDark border-pet-mint/30',
  MEDIUM: 'bg-pet-amber/20 text-pet-slate border-pet-amber/40',
  LARGE: 'bg-pet-orange/20 text-pet-orangeDark border-pet-orange/40',
  GIANT: 'bg-pet-coral/20 text-pet-coralDark border-pet-coral/40',
};

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  gender: Gender;
  age: number;
  size: PetSize;
  vaccineExpiry: string | null;
  allergyNotes: string;
  specialNotes: string;
  memberId: string | null;
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
}

export type StatusChangedAt = Record<QueueStatus, string | null>;

export interface QueueItem {
  id: string;
  petId: string;
  serviceType: ServiceType;
  groomerId: string;
  status: QueueStatus;
  estimatedMinutes: number;
  positionInQueue: number;
  statusChangedAt: StatusChangedAt;
  abnormalEndReason: string | null;
  createdAt: string;
  date: string;
  additionalServices: AdditionalServiceItem[];
  reassignmentLog: ReassignmentLog[];
}

export interface AdditionalServiceItem {
  id: string;
  serviceType: ServiceType;
  addedAt: string;
  addedBy: UserRole;
  allergyRiskConfirmed: boolean;
  minutes: number;
}

export interface ReassignmentLog {
  id: string;
  fromGroomerId: string;
  toGroomerId: string;
  reason: string;
  reassignedAt: string;
  reassignedBy: UserRole;
}

export interface StoreConfig {
  closingHour: number;
  closingMinute: number;
}

export interface Groomer {
  id: string;
  name: string;
  employeeNo: string;
  avatarEmoji: string;
  isOnDutyToday: boolean;
}

export interface ValidationLogEntry {
  time: string;
  level: 'INFO' | 'ERROR' | 'SUCCESS';
  msg: string;
}

export interface ValidationResult {
  name: string;
  passed: boolean;
  logs: ValidationLogEntry[];
  durationMs: number;
}
