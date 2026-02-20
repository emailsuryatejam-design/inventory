import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Dashboard KPI card with big number + trend
// Usage: <StatCard label="Total Value" value="$12,450" trend={5.2} icon={DollarSign} color="#10b981" />

export default function StatCard({ label, value, trend, icon: Icon, color, subtitle, onClick }) {
  const trendColor = trend > 0 ? '#059669' : trend < 0 ? '#dc2626' : '#94a3b8'
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus

  return (
    <div
      className={`bg-white rounded-xl p-4 lg:p-5 border border-gray-100 card-hover ${onClick ? 'cursor-pointer' : ''}`}
      style={{ boxShadow: 'var(--shadow-xs)' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>

      <div className="flex items-center gap-2 mt-2">
        {trend != null && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold tabular-nums"
            style={{ color: trendColor }}
          >
            <TrendIcon size={13} />
            {Math.abs(trend)}%
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-gray-400">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
