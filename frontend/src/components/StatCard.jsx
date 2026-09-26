export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  badge,
}) => {
  const variantStyles = {
    blue: {
      bg: 'from-blue-900/20 to-sky-950/40 border-sky-800/40',
      iconBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(14,165,233,0.3)]',
    },
    emerald: {
      bg: 'from-emerald-950/20 to-teal-950/40 border-emerald-800/40',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)]',
    },
    amber: {
      bg: 'from-amber-950/20 to-orange-950/40 border-amber-800/40',
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.3)]',
    },
    purple: {
      bg: 'from-purple-950/20 to-indigo-950/40 border-purple-800/40',
      iconBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.3)]',
    },
    slate: {
      bg: 'from-slate-900/60 to-slate-950/80 border-slate-800',
      iconBg: 'bg-slate-800 text-slate-300 border border-slate-700',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(148,163,184,0.15)]',
    },
  }[variant];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${variantStyles.bg} p-5 border backdrop-blur-sm transition-all duration-300 ${variantStyles.glow}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 tracking-wider uppercase">{title}</span>
        <div className={`p-2.5 rounded-xl ${variantStyles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">{value}</h3>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        {badge && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
              badge.positive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
};
