"use client"

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  ComposedChart
} from "recharts"

export default function ReportChart({ chart }: { chart: any }) {
  // Config schema from AI: 
  // labels: string[]
  // series: { name: string, data: number[] }[]
  
  const { config, type, title } = chart
  const { labels, series } = config as { labels: string[], series: { name: string, data: number[] }[] }

  if (!labels || !series || series.length === 0) return null

  // Transform to Recharts format: [{ name: "Label 1", series1: 10, series2: 20 }]
  const data = labels.map((label, index) => {
    const dataPoint: any = { name: label }
    series.forEach(s => {
      dataPoint[s.name] = s.data[index]
    })
    return dataPoint
  })

  // Colors for series
  const colors = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa"]

  const renderChartType = () => {
    switch(type) {
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={colors[i % colors.length]} strokeWidth={2} activeDot={{ r: 8 }} />
            ))}
          </LineChart>
        )
      case "comparison":
      case "bar":
      default:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
              itemStyle={{ color: '#e5e7eb' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Legend />
            {series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )
    }
  }

  return (
    <div className="w-full bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 md:p-8">
      <h4 className="text-xl font-semibold mb-6 text-white text-center">{title}</h4>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChartType()}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
