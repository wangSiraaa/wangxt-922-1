import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/AppNavbar';
import { useToast, ToastCtx, ToastContainer, type ToastData } from '@/components/Toast';
import { useAppStore } from '@/store/useAppStore';
import {
  Groomer,
  PET_SIZE_COLOR,
  PET_SIZE_LABEL,
  Pet,
  PetSize,
  SERVICE_BASE_MINUTES,
  SERVICE_LABEL,
  ServiceType,
  UserRole,
} from '@/types';
import {
  calculateDuration,
  formatMinutes,
  isVaccineExpired,
  isVaccineExpiringSoon,
  uid,
  validateVaccine,
} from '@/utils/businessRules';

const SIZES: PetSize[] = ['SMALL', 'MEDIUM', 'LARGE', 'GIANT'];
const SERVICES: ServiceType[] = ['BASIC_WASH', 'PREMIUM_WASH', 'SPA', 'STYLING'];

export default function PetRegisterPage() {
  const navigate = useNavigate();
  const { pets, groomers, addPet, submitQueue, currentRole } = useAppStore();
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const pushToast = (t: Omit<ToastData, 'id'>) => {
    const id = uid('t_');
    setToasts((ts) => [...ts, { id, ...t }]);
    return id;
  };
  const closeToast = (id: string) => setToasts((ts) => ts.filter((t) => t.id !== id));

  useEffect(() => {
    if (currentRole !== 'RECEPTIONIST') {
      setTimeout(() => {
        pushToast({
          type: 'warning',
          title: '建议使用前台角色',
          message: '建档预约功能仅前台角色可完整使用，已自动切换。',
        });
      }, 300);
    }
  }, [currentRole]);

  const [form, setForm] = useState({
    name: '',
    species: '狗',
    breed: '',
    gender: 'M' as 'M' | 'F',
    age: 1,
    size: 'MEDIUM' as PetSize,
    vaccineExpiry: '',
    allergyNotes: '',
    specialNotes: '',
    memberId: '',
    ownerName: '',
    ownerPhone: '',
    serviceType: 'BASIC_WASH' as ServiceType,
    groomerId: groomers[0]?.id || '',
  });

  const searchKw = (form.ownerPhone + form.memberId + form.ownerName).trim();
  const matchedExisting = useMemo(() => {
    if (!searchKw) return null;
    return (
      pets.find(
        (p) =>
          (form.ownerPhone && p.ownerPhone === form.ownerPhone) ||
          (form.memberId && p.memberId === form.memberId) ||
          (form.ownerName && p.ownerName.includes(form.ownerName))
      ) || null
    );
  }, [pets, searchKw, form.ownerPhone, form.memberId, form.ownerName]);

  const vaccineCheck = useMemo(
    () => validateVaccine(form.vaccineExpiry || null),
    [form.vaccineExpiry]
  );
  const vaccineExpired = isVaccineExpired(form.vaccineExpiry || null);
  const vaccineSoon = !vaccineExpired && isVaccineExpiringSoon(form.vaccineExpiry || null);

  const estimated = useMemo(
    () => calculateDuration(form.serviceType, form.size),
    [form.serviceType, form.size]
  );
  const baseMin = SERVICE_BASE_MINUTES[form.serviceType];
  const multFactor = estimated / baseMin;

  const onDutyGroomers: Groomer[] = groomers.filter((g) => g.isOnDutyToday);

  const fillExisting = (p: Pet) => {
    setForm((f) => ({
      ...f,
      name: p.name,
      species: p.species,
      breed: p.breed,
      gender: p.gender,
      age: p.age,
      size: p.size,
      vaccineExpiry: p.vaccineExpiry || '',
      allergyNotes: p.allergyNotes,
      specialNotes: p.specialNotes,
      memberId: p.memberId || '',
      ownerName: p.ownerName,
      ownerPhone: p.ownerPhone,
    }));
    pushToast({
      type: 'info',
      title: '已加载历史档案',
      message: `已为宠物「${p.name}」填充信息，可修改后提交新预约。`,
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      pushToast({ type: 'error', title: '请填写宠物名称' });
      return;
    }
    if (!form.ownerName.trim() || !form.ownerPhone.trim()) {
      pushToast({ type: 'error', title: '主人姓名和联系电话必填' });
      return;
    }
    if (!onDutyGroomers.find((g) => g.id === form.groomerId)) {
      pushToast({ type: 'error', title: '请选择值班美容师' });
      return;
    }

    let petId = matchedExisting?.id;
    if (!petId) {
      const newPet = addPet({
        name: form.name.trim(),
        species: form.species.trim() || '未知',
        breed: form.breed.trim(),
        gender: form.gender,
        age: Number(form.age) || 0,
        size: form.size,
        vaccineExpiry: form.vaccineExpiry || null,
        allergyNotes: form.allergyNotes.trim(),
        specialNotes: form.specialNotes.trim(),
        memberId: form.memberId.trim() || null,
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
      });
      petId = newPet.id;
      pushToast({ type: 'success', title: '宠物档案已创建', message: `档案号：${newPet.id}` });
    }

    const result = submitQueue({
      petId,
      serviceType: form.serviceType,
      groomerId: form.groomerId,
    });

    if (!result.success) {
      if (result.reason === 'VACCINE_INVALID') {
        pushToast({ type: 'error', title: '疫苗校验未通过', message: result.message });
      } else if (result.reason === 'DUPLICATE_TODAY') {
        pushToast({
          type: 'warning',
          title: '今日重复预约检测',
          message: result.message,
          duration: 5000,
        });
        setTimeout(() => navigate('/board'), 1600);
      } else {
        pushToast({ type: 'error', title: '提交失败', message: result.message });
      }
      return;
    }

    pushToast({
      type: 'success',
      title: '预约已提交 ✨',
      message: `排队号已生成，预计耗时 ${formatMinutes(estimated)}，正在跳转看板…`,
    });
    setTimeout(() => navigate('/board'), 1200);
  };

  const ctxValue = { push: pushToast };

  return (
    <ToastCtx.Provider value={ctxValue}>
      <AppNavbar />
      <ToastContainer toasts={toasts} onClose={closeToast} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-sm text-pet-slateLight/80 font-medium">前台 · 宠物档案管理</p>
          <h2 className="font-display text-3xl sm:text-4xl text-pet-slate mt-1 flex items-center gap-3">
            <span className="text-4xl">🐶</span> 新建宠物档案 & 预约
          </h2>
          <p className="text-sm text-pet-slateLight mt-2">
            录入宠物信息、健康档案与会员联系方式，自动校验疫苗有效期、体型工时系数与当日重复预约
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="card"
            >
              <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-pet-orange" /> 宠物基本信息
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="宠物名称 *" required>
                  <input
                    className="input-base"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：豆豆、毛毛"
                  />
                </Field>
                <Field label="物种">
                  <select
                    className="input-base"
                    value={form.species}
                    onChange={(e) => setForm({ ...form, species: e.target.value })}
                  >
                    <option>狗</option>
                    <option>猫</option>
                    <option>兔子</option>
                    <option>其他</option>
                  </select>
                </Field>
                <Field label="品种">
                  <input
                    className="input-base"
                    value={form.breed}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })}
                    placeholder="如：柯基、英短、金毛"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="性别">
                    <select
                      className="input-base"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    >
                      <option value="M">公 ♂</option>
                      <option value="F">母 ♀</option>
                    </select>
                  </Field>
                  <Field label="年龄（岁）">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className="input-base"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <Field label="体型分类 *" required className="md:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, size: s })}
                        className={`px-3 py-2.5 rounded-2xl border-2 font-medium text-sm transition-all duration-200 ${
                          form.size === s
                            ? `${PET_SIZE_COLOR[s]} shadow-soft scale-[1.02]`
                            : 'bg-white border-cream-200 text-pet-slateLight hover:border-pet-orange/40 hover:text-pet-slate'
                        }`}
                      >
                        {PET_SIZE_LABEL[s]}
                        <span className="block text-[10px] mt-0.5 opacity-75">
                          系数 ×{s === 'SMALL' ? '1.0' : s === 'MEDIUM' ? '1.2' : s === 'LARGE' ? '1.5' : '2.0'}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="card"
            >
              <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
                <Stethoscope size={20} className="text-pet-mint" /> 健康信息
              </h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={14} /> 疫苗有效期 *
                    </span>
                  }
                  required
                >
                  <div className="relative">
                    <Calendar
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-pet-slateLight/60 pointer-events-none"
                    />
                    <input
                      type="date"
                      className={`input-base pl-9 ${
                        vaccineExpired ? 'input-invalid' : vaccineSoon ? 'input-warning' : form.vaccineExpiry ? 'input-valid' : ''
                      }`}
                      value={form.vaccineExpiry}
                      onChange={(e) => setForm({ ...form, vaccineExpiry: e.target.value })}
                    />
                  </div>
                  {form.vaccineExpiry && (
                    <div
                      className={`mt-2 flex items-start gap-2 text-xs p-3 rounded-xl ${
                        vaccineExpired
                          ? 'bg-pet-coral/10 text-pet-coralDark'
                          : vaccineSoon
                          ? 'bg-pet-amber/15 text-pet-slate'
                          : 'bg-pet-mint/10 text-pet-mintDark'
                      }`}
                    >
                      {vaccineExpired ? (
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      ) : vaccineSoon ? (
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                      )}
                      <span>{vaccineCheck.message}</span>
                    </div>
                  )}
                </Field>
                <Field label="过敏史 / 禁忌">
                  <textarea
                    className="input-base min-h-[96px] resize-none"
                    value={form.allergyNotes}
                    onChange={(e) => setForm({ ...form, allergyNotes: e.target.value })}
                    placeholder="食物过敏、药物过敏、皮肤敏感等…"
                  />
                </Field>
              </div>
              <Field label="特殊护理备注">
                <textarea
                  className="input-base min-h-[80px] resize-none"
                  value={form.specialNotes}
                  onChange={(e) => setForm({ ...form, specialNotes: e.target.value })}
                  placeholder="性格特点、怕水/怕吹风、打结严重需注意等…"
                />
              </Field>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="card"
            >
              <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-pet-slate" /> 会员 & 联系方式
              </h3>

              {matchedExisting && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-pet-mint/10 via-pet-amber/10 to-pet-orange/10 border border-pet-orange/30"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-pet-mint/20 text-pet-mintDark flex items-center justify-center flex-shrink-0">
                        <Search size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-pet-slate">检测到匹配的历史档案</p>
                        <p className="text-sm text-pet-slateLight truncate mt-0.5">
                          {matchedExisting.ownerName} · {matchedExisting.ownerPhone} · 宠物「{matchedExisting.name}」
                          {matchedExisting.memberId && ` · 会员 ${matchedExisting.memberId}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => fillExisting(matchedExisting)}
                      className="btn-primary !py-2 !px-4 text-sm whitespace-nowrap"
                    >
                      一键填充 <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={14} /> 会员号
                    </span>
                  }
                >
                  <input
                    className="input-base"
                    value={form.memberId}
                    onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                    placeholder="VIP-2024001（选填）"
                  />
                </Field>
                <Field label="主人姓名 *" required>
                  <input
                    className="input-base"
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    placeholder="如：陈先生"
                  />
                </Field>
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      <Phone size={14} /> 联系电话 *
                    </span>
                  }
                  required
                >
                  <input
                    className="input-base"
                    value={form.ownerPhone}
                    onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                    placeholder="11位手机号"
                    inputMode="tel"
                  />
                </Field>
              </div>
            </motion.section>
          </div>

          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="card"
            >
              <h3 className="font-display text-xl text-pet-slate mb-4 flex items-center gap-2">
                <ClipboardList size={20} className="text-pet-orange" /> 预约服务
              </h3>
              <div className="space-y-4">
                <Field label="服务项目 *" required>
                  <div className="space-y-2">
                    {SERVICES.map((svc) => (
                      <button
                        key={svc}
                        type="button"
                        onClick={() => setForm({ ...form, serviceType: svc })}
                        className={`w-full text-left p-3 rounded-2xl border-2 transition-all duration-200 ${
                          form.serviceType === svc
                            ? 'border-pet-orange bg-pet-orange/5 shadow-softer'
                            : 'border-cream-200 bg-white hover:border-pet-orange/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${form.serviceType === svc ? 'text-pet-orangeDark' : 'text-pet-slate'}`}>
                            {SERVICE_LABEL[svc]}
                          </span>
                          <span className="font-mono text-xs text-pet-slateLight">
                            基准 {SERVICE_BASE_MINUTES[svc]}min
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="指派美容师 *" required>
                  <div className="space-y-2">
                    {onDutyGroomers.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setForm({ ...form, groomerId: g.id })}
                        className={`w-full text-left p-3 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3 ${
                          form.groomerId === g.id
                            ? 'border-pet-mint bg-pet-mint/5 shadow-softer'
                            : 'border-cream-200 bg-white hover:border-pet-mint/40'
                        }`}
                      >
                        <span className="text-2xl">{g.avatarEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-pet-slate">{g.name}</p>
                          <p className="text-xs text-pet-slateLight font-mono">{g.employeeNo} · 今日在岗</p>
                        </div>
                        {form.groomerId === g.id && (
                          <CheckCircle2 size={18} className="text-pet-mint" />
                        )}
                      </button>
                    ))}
                    {onDutyGroomers.length === 0 && (
                      <p className="text-sm text-pet-coralDark p-3 bg-pet-coral/10 rounded-xl">
                        ⚠️ 暂无在岗美容师，请先在排班中设置。
                      </p>
                    )}
                  </div>
                </Field>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card bg-gradient-to-br from-pet-orange/5 via-white to-pet-mint/5"
            >
              <h3 className="font-display text-xl text-pet-slate mb-4">⏱️ 工时预估</h3>
              <div className="space-y-3">
                <Row label="基础服务时长" value={`${baseMin} 分钟`} />
                <Row
                  label={`体型系数（${PET_SIZE_LABEL[form.size]}）`}
                  value={`× ${multFactor.toFixed(1)}`}
                  highlight={multFactor >= 1.5}
                />
                <div className="border-t border-dashed border-cream-200 pt-3">
                  <Row
                    label={
                      <span className="text-lg font-display text-pet-orangeDark">
                        预计总耗时
                      </span>
                    }
                    value={
                      <span className="font-mono text-2xl font-bold text-pet-orangeDark">
                        {formatMinutes(estimated)}
                      </span>
                    }
                  />
                </div>
                {multFactor >= 1.5 && (
                  <p className="text-xs p-3 rounded-xl bg-pet-orange/10 text-pet-orangeDark flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>大型/巨型犬将自动占用更长工位时间，已在排班时间轴中体现为更宽色块。</span>
                  </p>
                )}
              </div>
            </motion.section>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="space-y-3"
            >
              <button
                onClick={handleSubmit}
                disabled={vaccineExpired}
                className="btn-primary w-full !py-3.5 !text-lg !rounded-3xl animate-breathe disabled:!animate-none"
              >
                <Sparkles size={20} /> 提交预约 & 生成排队单
              </button>
              {vaccineExpired && (
                <p className="text-sm text-center text-pet-coralDark flex items-center justify-center gap-1.5">
                  <AlertCircle size={14} /> 疫苗校验未通过，无法提交（过期或缺失）
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

function Field({
  label,
  children,
  required,
  className = '',
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label-text">
        {label} {required && <span className="text-pet-coral">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${highlight ? 'text-pet-orangeDark font-medium' : 'text-pet-slateLight'}`}>
        {label}
      </span>
      <span className="text-pet-slate">{value}</span>
    </div>
  );
}
