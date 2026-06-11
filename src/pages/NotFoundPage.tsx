import { motion } from 'framer-motion';
import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="card max-w-lg text-center"
      >
        <div className="text-8xl mb-4 animate-pulse-soft">🐾</div>
        <h1 className="font-display text-5xl text-pet-orangeDark mb-2">404</h1>
        <p className="font-display text-2xl text-pet-slate mb-2">迷路的小狗勾</p>
        <p className="text-sm text-pet-slateLight mb-6 flex items-center justify-center gap-1.5">
          <Compass size={14} /> 这个页面暂时不存在，或许它正在美容中？
        </p>
        <Link to="/" className="btn-primary inline-flex w-full sm:w-auto justify-center">
          <Home size={18} /> 返回排班主页
        </Link>
      </motion.div>
    </div>
  );
}
