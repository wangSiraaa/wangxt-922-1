import { Groomer, Pet, QueueItem, QueueStatus } from '@/types';
import { formatTodayKey, uid } from '@/utils/businessRules';

const today = formatTodayKey();
const now = new Date().toISOString();
const d = new Date();

const pastIso = (minsAgo: number): string => {
  const t = new Date();
  t.setMinutes(t.getMinutes() - minsAgo);
  return t.toISOString();
};

const futureIso = (days: number): string => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  return t.toISOString().slice(0, 10);
};

export const SEED_GROOMERS: Groomer[] = [
  { id: 'groomer_001', name: '李师傅', employeeNo: 'G-001', avatarEmoji: '🐱', isOnDutyToday: true },
  { id: 'groomer_002', name: '王师傅', employeeNo: 'G-002', avatarEmoji: '🐶', isOnDutyToday: true },
  { id: 'groomer_003', name: '张师傅', employeeNo: 'G-003', avatarEmoji: '🐰', isOnDutyToday: true },
];

export const SEED_PETS: Pet[] = [
  {
    id: 'pet_expired',
    name: '豆豆（示例-疫苗过期）',
    species: '狗',
    breed: '金毛寻回犬',
    gender: 'M',
    age: 4,
    size: 'LARGE',
    vaccineExpiry: futureIso(-30),
    allergyNotes: '对鸡肝过敏',
    specialNotes: '耳朵敏感，吹水时注意',
    memberId: 'VIP-2024001',
    ownerName: '陈先生',
    ownerPhone: '13800000001',
    createdAt: pastIso(60 * 24 * 60),
  },
  {
    id: 'pet_normal_medium',
    name: '毛毛（示例-中型犬）',
    species: '狗',
    breed: '柯基',
    gender: 'F',
    age: 2,
    size: 'MEDIUM',
    vaccineExpiry: futureIso(180),
    allergyNotes: '无',
    specialNotes: '喜欢吃零食',
    memberId: 'VIP-2024002',
    ownerName: '刘女士',
    ownerPhone: '13800000002',
    createdAt: pastIso(30 * 24 * 60),
  },
  {
    id: 'pet_washing_small',
    name: '咪咪（示例-洗护中）',
    species: '猫',
    breed: '英短蓝白',
    gender: 'F',
    age: 1,
    size: 'SMALL',
    vaccineExpiry: futureIso(90),
    allergyNotes: '无',
    specialNotes: '怕水，需安抚',
    memberId: null,
    ownerName: '周小姐',
    ownerPhone: '13800000003',
    createdAt: pastIso(15 * 24 * 60),
  },
  {
    id: 'pet_giant_validate',
    name: '大壮（示例-巨型犬）',
    species: '狗',
    breed: '阿拉斯加',
    gender: 'M',
    age: 5,
    size: 'GIANT',
    vaccineExpiry: futureIso(60),
    allergyNotes: '无',
    specialNotes: '体型巨大，提前准备大工位',
    memberId: 'VIP-2024099',
    ownerName: '赵大哥',
    ownerPhone: '13800000099',
    createdAt: pastIso(10 * 24 * 60),
  },
];

const emptyStatusChanged: Record<QueueStatus, string | null> = {
  WAITING_ARRIVAL: null,
  WASHING: null,
  DRYING: null,
  PICKUP: null,
  ENDED: null,
};

export const SEED_QUEUES: QueueItem[] = [
  {
    id: uid('q_'),
    petId: 'pet_normal_medium',
    serviceType: 'BASIC_WASH',
    groomerId: 'groomer_002',
    status: 'WAITING_ARRIVAL',
    estimatedMinutes: 72,
    positionInQueue: 1,
    statusChangedAt: { ...emptyStatusChanged, WAITING_ARRIVAL: pastIso(10) },
    abnormalEndReason: null,
    createdAt: pastIso(10),
    date: today,
  },
  {
    id: uid('q_'),
    petId: 'pet_washing_small',
    serviceType: 'PREMIUM_WASH',
    groomerId: 'groomer_001',
    status: 'WASHING',
    estimatedMinutes: 90,
    positionInQueue: 1,
    statusChangedAt: {
      ...emptyStatusChanged,
      WAITING_ARRIVAL: pastIso(50),
      WASHING: pastIso(25),
    },
    abnormalEndReason: null,
    createdAt: pastIso(50),
    date: today,
  },
  {
    id: uid('q_'),
    petId: 'pet_normal_medium',
    serviceType: 'STYLING',
    groomerId: 'groomer_003',
    status: 'WAITING_ARRIVAL',
    estimatedMinutes: 180,
    positionInQueue: 2,
    statusChangedAt: { ...emptyStatusChanged, WAITING_ARRIVAL: pastIso(3) },
    abnormalEndReason: null,
    createdAt: pastIso(3),
    date: today,
  },
];

export const SCHEMA_VERSION = '1.0.0';

export const getInitialStorage = () => {
  void d;
  void now;
  return {
    __schema_version: SCHEMA_VERSION,
    __last_migrated: new Date().toISOString(),
    currentRole: 'RECEPTIONIST' as const,
    groomers: SEED_GROOMERS,
    pets: SEED_PETS,
    queueItems: SEED_QUEUES,
  };
};
