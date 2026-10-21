'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ProductionChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div className="h-[280px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85}/>
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip
            cursor={{ fill: '#f9fafb' }}
            formatter={(value) => [value, label]}
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
          />
          <Bar dataKey="value" name={label} radius={[6, 6, 0, 0]} fill="url(#barGradient)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
