"use client"

import { useMemo, useState } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import type { ChartV2Config, ChartV2Point, ClassificationCodeT } from "@/lib/report/types"
import { isForecastCode } from "@/lib/report/types"
import { NOT_FOUND_IN_SOURCE } from "@/lib/finance/normalize"

/**
 * Chart rendering for extracted financial series.
 *
 * The rule this component exists to enforce: a period the report never gave us
 * is drawn as a GAP, never as zero. A zero is a claim about the company's
 * performance; an absence is a claim about our extraction. Conflating them is
 * how a chart lies.
 *
 * Reads configV2 when present and falls back to the legacy {labels, series}
 * shape, so reports analysed before this change still render.
 */

type LegacyConfig = {
  labels?: string[]
  series?: { name: string; data: (number | null)[] }[]
}

interface ChartRow {
  period: string
  /** Split series so actual renders solid and forecast renders dashed. */
  actual: number | null
  forecast: number | null
  value: number | null
  classificationCode: ClassificationCodeT
  isForecast: boolean
  missing: boolean
  confidence: string
  sourcePage: number | null
}

const CLASSIFICATION_LABEL: Record<string, string> = {
  A: "Actual",
  R: "Restated",
  P: "Preliminary",
  G: "Management guidance",
  E: "Analyst estimate",
  C: "Consensus estimate",
  S: "Scenario",
  AI: "Platform derived",
  U: "Unclassified",
}

/** Legacy configs carry no classification, so nothing may be claimed as forecast. */
function adaptLegacy(config: LegacyConfig, seriesName: string): ChartV2Config | null {
  const labels = config.labels ?? []
  const series = config.series ?? []
  if (labels.length === 0 || series.length === 0) return null
  const first = series[0]
  return {
    unit: null,
    currency: null,
    scale: null,
    points: labels.map((label, i) => {
      const raw = first.data?.[i]
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null
      return {
        periodLabel: label,
        periodType: "ANNUAL",
        periodSortKey: i,
        fiscalYearEnd: 0,
        quarter: null,
        value,
        currency: null,
        scale: null,
        classificationCode: "U",
        dataStatus: value == null ? "SYSTEM_GENERATED_MISSING" : "REPORTED",
        evidenceLinks: [],
        confidenceLevel: value == null ? "MISSING" : "UNVERIFIED",
      } satisfies ChartV2Point
    }),
  }
}

function toRows(points: ChartV2Point[]): ChartRow[] {
  const firstForecastIdx = points.findIndex((p) => isForecastCode(p.classificationCode))
  return points.map((p, i) => {
    const isForecast = isForecastCode(p.classificationCode)
    // Repeat the last actual value at the boundary so the dashed forecast line
    // joins the solid actual line instead of floating detached.
    const isBoundary = firstForecastIdx > 0 && i === firstForecastIdx - 1
    return {
      period: p.periodLabel,
      value: p.value,
      actual: isForecast ? null : p.value,
      forecast: isForecast || isBoundary ? p.value : null,
      classificationCode: p.classificationCode,
      isForecast,
      missing: p.value == null,
      confidence: p.confidenceLevel,
      sourcePage: null,
    }
  })
}

function formatValue(v: number | null, config: ChartV2Config): string {
  if (v == null) return NOT_FOUND_IN_SOURCE
  const scale = config.scale ? ` ${config.scale === "crore" ? "cr" : config.scale}` : ""
  return `${v.toLocaleString()}${scale}`
}

function ChartTooltip({
  active,
  payload,
  config,
}: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  config: ChartV2Config
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-white/15 bg-[#0b1220] px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{row.period}</p>
      <p className={row.missing ? "text-amber-300" : "text-gray-200"}>{formatValue(row.value, config)}</p>
      <p className="mt-1 text-gray-400">
        {CLASSIFICATION_LABEL[row.classificationCode] ?? "Unclassified"}
        {row.isForecast ? " · forecast" : ""}
      </p>
      <p className="text-gray-500">Confidence: {row.confidence.toLowerCase()}</p>
    </div>
  )
}

export default function ReportChart({ chart }: { chart: { type?: string; title: string; config?: unknown; configV2?: unknown } }) {
  const [showTable, setShowTable] = useState(false)

  const config = useMemo<ChartV2Config | null>(() => {
    const v2 = chart.configV2 as ChartV2Config | null | undefined
    if (v2?.points?.length) return v2
    return adaptLegacy((chart.config ?? {}) as LegacyConfig, chart.title)
  }, [chart.config, chart.configV2, chart.title])

  const rows = useMemo(() => (config ? toRows(config.points) : []), [config])

  const hasAnyValue = rows.some((r) => r.value != null)
  const firstForecast = rows.findIndex((r) => r.isForecast)
  const missingCount = rows.filter((r) => r.missing).length

  if (!config || rows.length === 0) {
    return (
      <figure className="w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 md:p-8">
        <figcaption className="mb-2 text-center text-xl font-semibold text-white">{chart.title}</figcaption>
        <p className="py-10 text-center text-sm text-gray-400">No source data available for this chart.</p>
      </figure>
    )
  }

  // An empty series must not render an axis implying a real zero baseline.
  if (!hasAnyValue) {
    return (
      <figure className="w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 md:p-8">
        <figcaption className="mb-2 text-center text-xl font-semibold text-white">{chart.title}</figcaption>
        <p className="py-10 text-center text-sm text-amber-300">
          No values for this metric were found in the source report.
        </p>
        <p className="text-center text-xs text-gray-500">
          Periods identified: {rows.map((r) => r.period).join(", ")}
        </p>
      </figure>
    )
  }

  const isBar = chart.type === "bar" || chart.type === "comparison"

  return (
    <figure className="w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 md:p-8">
      <figcaption className="mb-1 text-center text-xl font-semibold text-white">{chart.title}</figcaption>
      <p className="mb-4 text-center text-xs text-gray-500">
        Solid = reported · dashed = forecast
        {missingCount > 0 ? ` · ${missingCount} period${missingCount > 1 ? "s" : ""} not disclosed (shown as gaps)` : ""}
      </p>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {isBar ? (
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="period" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip content={<ChartTooltip config={config} />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <Legend />
              <Bar dataKey="actual" name="Reported" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" name="Forecast" fill="#60a5fa" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <ComposedChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="period" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip content={<ChartTooltip config={config} />} />
              <Legend />
              {firstForecast > 0 && (
                <>
                  <ReferenceArea
                    x1={rows[firstForecast].period}
                    x2={rows[rows.length - 1].period}
                    fill="#f59e0b"
                    fillOpacity={0.06}
                  />
                  <ReferenceLine
                    x={rows[firstForecast].period}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: "Forecast begins", position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                  />
                </>
              )}
              {/* connectNulls={false} is the whole point: gaps stay gaps. */}
              <Line
                type="monotone"
                dataKey="actual"
                name="Reported"
                stroke="#60a5fa"
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 4"
                connectNulls={false}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="rounded-md px-3 py-1.5 text-xs text-gray-300 underline underline-offset-4 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {showTable ? "Hide data table" : "View data table"}
        </button>
      </div>

      {showTable && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{chart.title} — underlying data</caption>
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th scope="col" className="py-2 pr-4 font-medium">Period</th>
                <th scope="col" className="py-2 pr-4 font-medium">Value</th>
                <th scope="col" className="py-2 pr-4 font-medium">Basis</th>
                <th scope="col" className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period} className="border-b border-white/5">
                  <th scope="row" className="py-2 pr-4 font-normal text-gray-300">{r.period}</th>
                  <td className={`py-2 pr-4 ${r.missing ? "text-amber-300" : "text-gray-200"}`}>
                    {formatValue(r.value, config)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {CLASSIFICATION_LABEL[r.classificationCode] ?? "Unclassified"}
                  </td>
                  <td className="py-2 text-gray-500">{r.confidence.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
