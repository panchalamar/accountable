import type { ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyAxis, formatMoneyShort } from "../../lib/money";
import type { Dashboard } from "../api";
import { COLORS, OPEN_STAGES, STAGE_LABEL, STAGE_STYLE, type Stage } from "../lib/stages";
import { ChartTable } from "./ChartTable";
import { type ChartRow, type FutureRow, MONTH_NAMES, chartRows, labelledKeys, longLabel, moneyTicks } from "./chartData";

// The chart's frame, in pixels. The figures above and the strip below use the
// same numbers, so their split lines up with Today without measuring.
const AXIS = 58;
const RIGHT = 10; // the plot stops 10px short of the panel's content edge, as in the mockup
const HEIGHT = 330;
const TOP = 44;
const X_AXIS = 46;

/** Bottom to top, as the mockup stacks them. */
const STACK: Stage[] = ["negotiation", "proposal", "qualified", "new"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function splitColumns(pastCount: number, total: number) {
  return `calc(${AXIS}px + (100% - ${AXIS + RIGHT}px) * ${pastCount} / ${total}) minmax(0, 1fr)`;
}

/**
 * The same split for the strip under the chart, except that the stage table
 * keeps the room it needs. When the past is long and the page narrow, the
 * split moves a little left of Today rather than the table running past the
 * panel's edge.
 */
function stripColumns(pastCount: number, total: number) {
  return `minmax(0, calc(${AXIS}px + (100% - ${AXIS + RIGHT}px) * ${pastCount} / ${total})) minmax(min-content, 1fr)`;
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0" role="group" aria-label={label}>
      <p className="text-[13.5px] font-medium text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-[clamp(24px,calc(24px+(100vw-1280px)/40),28px)] font-medium leading-[1.2] tracking-[-0.03em]">
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-muted">{note}</p>
    </div>
  );
}

function XTick(props: { x?: number; y?: number; payload?: { value: string }; rows: ChartRow[] }) {
  const row = props.rows.find((r) => r.key === props.payload?.value);
  if (!row || row.kind === "none") return null;
  const late = row.kind === "late";
  return (
    <g transform={`translate(${props.x},${props.y})`}>
      <text
        y={14}
        textAnchor="middle"
        className="font-mono"
        fontSize={11}
        fill={late ? COLORS.raspberryStrong : COLORS.inkMuted}
        fontWeight={late ? 700 : 400}
      >
        {row.label}
      </text>
      {row.showYear && row.year ? (
        <text y={29} textAnchor="middle" className="font-mono" fontSize={11} fill={COLORS.inkMuted}>
          {row.year}
        </text>
      ) : null}
    </g>
  );
}

type SegmentProps = { x?: number; y?: number; width?: number; height?: number; payload?: FutureRow };

/** One stage's part of a bar: a 2px gap above the part below, a rounded top on the topmost, and its label. */
function segment(stage: Stage, labelled: Set<string>) {
  return function Segment({ x = 0, y = 0, width = 0, height = 0, payload }: SegmentProps) {
    if (!payload || height <= 0) return <g />;
    const at = STACK.indexOf(stage);
    const above = STACK.slice(at + 1).some((s) => payload[s] > 0);
    const below = STACK.slice(0, at).some((s) => payload[s] > 0);
    const h = below ? Math.max(height - 2, 0.5) : height;
    const fill = STAGE_STYLE[stage].fill;
    if (above) return <rect x={x} y={y} width={width} height={h} fill={fill} />;
    const r = Math.min(4, h, width / 2);
    const path = `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + h}Z`;
    return (
      <g>
        <path d={path} fill={fill} />
        {labelled.has(payload.key) ? (
          <text x={x + width / 2} y={y - 9} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={COLORS.midnight}>
            {formatMoneyShort(payload.total)}
          </text>
        ) : null}
      </g>
    );
  };
}

function LineLabel({ x = 0, y = 0, index = 0, rows, labelled }: { x?: number; y?: number; index?: number; rows: ChartRow[]; labelled: Set<string> }) {
  const row = rows[index];
  if (!row || row.kind !== "past" || !labelled.has(row.key)) return null;
  return (
    <text x={x} y={y - 12} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={COLORS.midnight}>
      {formatMoneyShort(row.won)}
    </text>
  );
}

function TodayLabel({ viewBox }: { viewBox?: { x?: number; y?: number } }) {
  const x = viewBox?.x ?? 0;
  const top = (viewBox?.y ?? TOP) - TOP;
  return (
    <g>
      <line x1={x} x2={x} y1={top + 20} y2={TOP} stroke={COLORS.midnight} strokeWidth={1.5} />
      <rect x={x - 30} y={top + 2} width={60} height={22} rx={11} fill={COLORS.midnight} />
      <text x={x} y={top + 17} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>
        Today
      </text>
    </g>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none max-w-[280px] rounded-[8px] bg-ink px-[11px] py-2 text-[12.5px] leading-[1.45] text-white shadow-[0_6px_18px_rgba(7,59,76,0.22)]">
      {children}
    </div>
  );
}

function TipLine({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[12px] text-sea-mist">{children}</div>;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: ChartRow }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.kind === "none") return null;
  if (row.kind === "past") {
    return (
      <Tip>
        <div className="font-semibold">{longLabel(row)}</div>
        <TipLine>{formatMoney(row.won)} won</TipLine>
        <TipLine>{plural(row.wonCount, "deal")}</TipLine>
      </Tip>
    );
  }
  return (
    <Tip>
      <div className="font-semibold">
        {longLabel(row)}: {plural(row.count, "open deal")}, {formatMoney(row.total)}
      </div>
      {row.deals.map((d) => (
        <TipLine key={d.id}>
          {d.name}, {formatMoney(d.value)}, {STAGE_LABEL[d.stage]}
        </TipLine>
      ))}
    </Tip>
  );
}

function wonSummary(data: Dashboard) {
  const none = data.months.filter((m) => m.won_count === 0);
  const twelve = data.figures.won_12_months;
  const lead = `${plural(twelve.count, "deal")} in the last 12 months.`;
  if (none.length === 0) return `${lead} A win in every month.`;
  if (none.length > 3) return `${lead} None in ${none.length} of the months.`;
  const names = none.map((m) => MONTH_NAMES[Number(m.month.slice(5)) - 1]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return `${lead} None in ${list}.`;
}

function stageSummary(data: Dashboard) {
  const total = data.figures.expected_revenue;
  if (total === 0) return "No expected revenue in the open stages.";
  const top = [...data.stages].sort((a, b) => b.expected - a.expected).slice(0, 2);
  if (top[0].expected / total > 0.5) return `Most of the expected revenue sits in ${STAGE_LABEL[top[0].stage]}.`;
  if ((top[0].expected + top[1].expected) / total > 0.5) {
    const [a, b] = [top[0].stage, top[1].stage].sort((x, y) => OPEN_STAGES.indexOf(x) - OPEN_STAGES.indexOf(y));
    return `Most of the expected revenue sits in ${STAGE_LABEL[a]} and ${STAGE_LABEL[b]}.`;
  }
  return "The expected revenue is spread across the stages.";
}

function changeOnLastMonth(data: Dashboard) {
  const now = data.figures.won_this_month.value;
  const before = data.figures.won_last_month.value;
  const last = MONTH_NAMES[Number(data.months[10].month.slice(5)) - 1];
  if (now === before) return `the same as ${last}`;
  return `${now > before ? "up" : "down"} ${formatMoney(Math.abs(now - before))} on ${last}`;
}

export function ForecastPanel({ data }: { data: Dashboard }) {
  const rows = chartRows(data);
  const pastCount = data.months.length;
  const total = rows.length;
  const future = rows.slice(pastCount) as FutureRow[];
  const firstFuture = future[0].key;
  const lastFuture = future[future.length - 1].key;
  const labelled = labelledKeys(rows);
  const max = Math.max(...rows.map((r) => (r.kind === "past" ? r.won : r.total)), 1);
  const ticks = moneyTicks(max);
  const split = splitColumns(pastCount, total);
  const f = data.figures;
  const late = f.open_pipeline.late_count;
  const winMonths = f.won_12_months.months_with_wins;
  const share = f.open_pipeline.value ? Math.round((f.expected_revenue / f.open_pipeline.value) * 100) : 0;
  const maxWon = Math.max(...data.months.map((m) => m.won_count), 1);
  const countTicks = Array.from({ length: maxWon + 1 }, (_, i) => i);

  const summary =
    `${formatMoneyShort(f.won_12_months.value)} won in the last 12 months. ` +
    (data.forecast.none_open
      ? "There are no open deals."
      : `${formatMoneyShort(f.open_pipeline.value)} is open` +
        (late ? `, ${formatMoneyShort(f.open_pipeline.late_value)} of it in ${plural(late, "late deal")}.` : ", and none of it is late."));

  return (
    <section className="panel rounded-[20px] px-7 pb-7 pt-[26px]" aria-labelledby="hero-h">
      <div className="mb-[22px]">
        <h2 id="hero-h" className="text-[17px] font-semibold tracking-[-0.005em]">
          Revenue won, and what's due to close
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">{summary}</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: split }}>
        <div className="flex gap-[clamp(24px,calc(24px+(100vw-1280px)/20),32px)]" style={{ paddingLeft: AXIS }}>
          <Figure
            label="Won in the last 12 months"
            value={formatMoney(f.won_12_months.value)}
            note={`${plural(f.won_12_months.count, "deal")}, a win in ${winMonths} of 12 months`}
          />
          <Figure
            label="Won this month"
            value={formatMoney(f.won_this_month.value)}
            note={`${plural(f.won_this_month.count, "deal")}, ${changeOnLastMonth(data)}`}
          />
        </div>
        <div className="flex gap-[clamp(24px,calc(24px+(100vw-1280px)/20),32px)] pl-[clamp(14px,calc(14px+(100vw-1280px)/40),18px)]">
          <Figure
            label="Open pipeline"
            value={formatMoney(f.open_pipeline.value)}
            note={`${plural(f.open_pipeline.count, "deal")}, ${late} late`}
          />
          <Figure label="Expected revenue" value={formatMoney(f.expected_revenue)} note={`${share}% of the open pipeline`} />
        </div>
      </div>

      <div className="mt-[18px]" aria-hidden="true" data-chart="forecast">
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <ComposedChart data={rows} margin={{ top: TOP, right: RIGHT, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <ReferenceArea
              x1={firstFuture}
              x2={lastFuture}
              ifOverflow="visible"
              shape={(p: { x?: number; y?: number; width?: number; height?: number }) => (
                <rect
                  x={p.x}
                  y={(p.y ?? 0) - 14}
                  width={(p.width ?? 0) + 4}
                  height={(p.height ?? 0) + 14}
                  rx={10}
                  fill={COLORS.forecastBg}
                />
              )}
            />
            <CartesianGrid vertical={false} stroke={COLORS.divider} />
            <XAxis
              dataKey="key"
              interval={0}
              height={X_AXIS}
              tickLine={false}
              axisLine={{ stroke: "#C9D5D8" }}
              tick={<XTick rows={rows} />}
            />
            <YAxis
              width={AXIS}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={formatMoneyAxis}
              tickLine={false}
              axisLine={false}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: COLORS.inkMuted }}
              tickMargin={8}
            />
            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(7,59,76,0.04)" }} isAnimationActive={false} />
            <Area dataKey="won" type="linear" stroke="none" fill={COLORS.seaGreen} fillOpacity={0.13} isAnimationActive={false} />
            <Line
              dataKey="won"
              type="linear"
              stroke={COLORS.seaGreenText}
              strokeWidth={2}
              strokeLinejoin="round"
              dot={{ r: 4, fill: COLORS.seaGreenText, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: COLORS.seaGreenText, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
              label={<LineLabel rows={rows} labelled={labelled} />}
            />
            {STACK.map((stage) => (
              <Bar
                key={stage}
                dataKey={stage}
                stackId="open"
                barSize={24}
                fill={STAGE_STYLE[stage].fill}
                isAnimationActive={false}
                shape={segment(stage, labelled)}
              />
            ))}
            <ReferenceLine x={firstFuture} position="start" stroke={COLORS.midnight} strokeWidth={1.5} label={<TodayLabel />} />
            {data.forecast.none_open ? (
              <ReferenceArea
                x1={firstFuture}
                x2={lastFuture}
                ifOverflow="visible"
                fill="transparent"
                label={{ value: "No open deals", fill: COLORS.inkMuted, fontSize: 14 }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Revenue won by month, then open deals by when they're due to close"
        columns={["Month or slot", "Revenue won", "Deals won", "Open deals", "Open value"]}
        rows={rows
          .filter((r) => r.kind !== "none")
          .map((r) =>
            r.kind === "past"
              ? [longLabel(r), formatMoney(r.won), String(r.wonCount), "", ""]
              : [longLabel(r), "", "", String(r.count), formatMoney(r.total)],
          )}
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13px]" style={{ paddingLeft: AXIS }} aria-hidden="true">
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10">
            <path d="M1 5h20" stroke={COLORS.seaGreenText} strokeWidth="2" />
            <circle cx="11" cy="5" r="3.5" fill={COLORS.seaGreenText} stroke="#fff" strokeWidth="1.5" />
          </svg>
          Revenue won
        </span>
        {OPEN_STAGES.map((stage) => (
          <span key={stage} className="inline-flex items-center gap-2">
            <i className="h-3 w-3 rounded-[4px]" style={{ background: STAGE_STYLE[stage].fill }} />
            {STAGE_LABEL[stage]}
          </span>
        ))}
        <span className="ml-auto font-medium text-alert-strong">Late: past its close date and still open</span>
      </div>

      <div className="mt-[26px] grid pt-[22px]" style={{ gridTemplateColumns: stripColumns(pastCount, total) }}>
        <div style={{ paddingLeft: AXIS }}>
          <h3 className="text-[14.5px] font-semibold">Deals won by month</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">{wonSummary(data)}</p>
          <div className="mt-2.5" style={{ marginLeft: -AXIS }} aria-hidden="true" data-chart="won">
            <ResponsiveContainer width="100%" height={128}>
              <BarChart data={data.months} margin={{ top: 14, right: 2, bottom: 8, left: 0 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke={COLORS.divider} />
                <XAxis dataKey="month" hide />
                <ReferenceLine y={0} stroke="#C9D5D8" />
                <YAxis
                  width={AXIS}
                  ticks={countTicks}
                  interval={0}
                  domain={[0, maxWon]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: COLORS.inkMuted }}
                  tickMargin={8}
                />
                <Tooltip
                  cursor={{ fill: "rgba(7,59,76,0.04)" }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const m = payload?.[0]?.payload as Dashboard["months"][number] | undefined;
                    if (!active || !m) return null;
                    return (
                      <Tip>
                        <div className="font-semibold">{`${MONTH_NAMES[Number(m.month.slice(5)) - 1]} ${m.year}`}</div>
                        <TipLine>{plural(m.won_count, "deal")} won</TipLine>
                      </Tip>
                    );
                  }}
                />
                <Bar dataKey="won_count" barSize={24} fill={COLORS.marigold} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartTable
            caption="Deals won by month"
            columns={["Month", "Deals won"]}
            rows={data.months.map((m) => [`${MONTH_NAMES[Number(m.month.slice(5)) - 1]} ${m.year}`, String(m.won_count)])}
          />
        </div>
        <div className="pl-[22px]">
          <h3 className="text-[14.5px] font-semibold">Open pipeline by stage</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">{stageSummary(data)}</p>
          <table className="mt-3 w-full border-collapse text-[13.5px] max-[1399px]:text-[13px]">
            <thead>
              <tr className="text-[12.5px] text-ink-muted">
                <th scope="col" className="pb-1.5 text-left font-normal">Stage</th>
                <th scope="col" className="pb-1.5 pl-2.5 text-right font-normal">Deals</th>
                <th scope="col" className="pb-1.5 pl-2.5 text-right font-normal">Value</th>
                <th scope="col" className="pb-1.5 pl-2.5 text-right font-normal">Expected</th>
              </tr>
            </thead>
            <tbody>
              {data.stages.map((s) => (
                <tr key={s.stage} className="border-t border-divider first:border-t-0">
                  <th scope="row" className="py-1.5 text-left font-medium">
                    <span className="flex items-center gap-[9px]">
                      <i className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: STAGE_STYLE[s.stage].fill }} />
                      {STAGE_LABEL[s.stage]}
                    </span>
                  </th>
                  <td className="num py-1.5 pl-2.5 text-right">{s.count}</td>
                  <td className="num py-1.5 pl-2.5 text-right">{formatMoney(s.value)}</td>
                  <td className="num py-1.5 pl-2.5 text-right">{formatMoney(s.expected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
