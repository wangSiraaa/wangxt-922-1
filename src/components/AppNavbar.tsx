import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarPlus, ClipboardList, Home, Search, UserRound, Wrench } from 'lucide-react';
import { ROLE_LABEL, UserRole } from '@/types';
import { useAppStore } from '@/store/useAppStore';

const ROLES: UserRole[] = ['RECEPTIONIST', 'GROOMER', 'CUSTOMER'];

export default function AppNavbar() {
  const loc = useLocation();
  const { currentRole, setRole } = useAppStore();

  const navItems = [
    { to: '/', icon: Home, label: '排班主页', roles: ['RECEPTIONIST', 'GROOMER', 'CUSTOMER'] },
    { to: '/register', icon: CalendarPlus, label: '建档预约', roles: ['RECEPTIONIST'] },
    { to: '/board', icon: ClipboardList, label: '美容师看板', roles: ['RECEPTIONIST', 'GROOMER'] },
    { to: '/customer', icon: Search, label: '顾客查询', roles: ['RECEPTIONIST', 'CUSTOMER', 'GROOMER'] },
    { to: '/validate', icon: Wrench, label: '验证面板', roles: ['RECEPTIONIST', 'GROOMER', 'CUSTOMER'] },
  ];

  const visibleItems = navItems.filter((n) => n.roles.includes(currentRole));

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-40 backdrop-blur-md bg-cream-100/80 border-b border-white/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pet-orange to-pet-coral flex items-center justify-center text-white text-2xl shadow-glow-orange"
          >
            🐾
          </motion.div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl text-pet-slate leading-tight">
              萌宠美容排队
            </h1>
            <p className="text-xs text-pet-slateLight/80">Pet Grooming Queue System</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full sm:max-w-none">
          {visibleItems.map((item) => {
            const isActive = loc.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`relative px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'text-pet-orangeDark bg-white shadow-softer'
                    : 'text-pet-slateLight hover:text-pet-slate hover:bg-white/50'
                }`}
              >
                <item.icon size={16} />
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-2 right-2 -bottom-0.5 h-0.5 bg-gradient-to-r from-pet-orange to-pet-coral rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 bg-white/80 rounded-2xl p-1 shadow-softer">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`relative px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1 transition-all duration-200 ${
                currentRole === r
                  ? 'bg-gradient-to-r from-pet-orange to-pet-orangeDark text-white shadow-soft'
                  : 'text-pet-slateLight hover:text-pet-slate hover:bg-white'
              }`}
            >
              <UserRound size={14} />
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
    </motion.header>
  );
}
