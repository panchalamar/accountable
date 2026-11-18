import { Funnel, FunnelChart, Tooltip } from "recharts";

import { formatMoney } from "../../lib/money";
import type { Dashboard } from "../api";
import { STAGE_LABEL, STAGE_STYLE, type Stage } from "../lib/stages";

const ROW = 53; // each band and its table row, so they line up
const WIDTH = 264;
const GAP = 3;

export type Band = { stage: Stage; value: number; count: number; fill: string; ofNew: number | null; ofBefore: number | null };

// What Recharts passes a custom funnel shape. It doesn't pass the band's index.
type ShapeProps = {
  x?: number;
  y?: number;
  upperWidth?: number;
  lowerWidth?: number;
  height?: number;
  payload?: Band;
};

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/**
 * A band as wide at the top as the value that reached its stage, and at the
 * bottom as the next. The last band is known by its stage, since Recharts
 * doesn't say which band it's drawing.
 */
export function bandShape(lastStage: Stage) {
  return function BandShape({ x = 0, y = 0, upperWidth = 0, lowerWidth = 0, height = 0, payload }: ShapeProps) {
    const top = upperWidth;
    // The last band narrows a little, as in the mockup, rather than ending in a point or a box.
    const bottom = payload?.stage === lastStage ? upperWidth * 0.78 : lowerWidth;
    const h = height - GAP;
    const center = x + upperWidth / 2;
    const d = `M${center - top / 2},${y}H${center + top / 2}L${center + bottom / 2},${y + h}H${center - bottom / 2}Z`;
    return <path d={d} fill={payload?.fill} />;
  };
}

function FunnelTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Band }[] }) {
  const band = payload?.[0]?.payload;
  if (!active || !band) return null;
  return (
    <div className="pointer-events-none rounded-[8px] bg-ink px-[11px] py-2 text-[12.5px] text-white shadow-[0_6px_18px_rgba(7,59,76,0.22)]">
      <div className="font-semibold">{STAGE_LABEL[band.stage]}</div>
      <div className="font-mono text-[12px] text-sea-mist">
        {formatMoney(band.value)} reached {STAGE_LABEL[band.stage]}
      </div>
      <div className="font-mono text-[12px] text-sea-mist">
        {band.count} {band.count === 1 ? "deal" : "deals"}
        {band.ofBefore !== null && band.stage !== "new" ? `, ${band.ofBefore}% of the stage before` : ""}
      </div>
    </div>
  );
}

export function FunnelPanel({ data }: { data: Dashboard }) {
  const reachedNew = data.funnel[0]?.value ?? 0;
  const bands: Band[] = data.funnel.map((f, i) => ({
    stage: f.stage,
    value: f.value,
    count: f.count,
    fill: STAGE_STYLE[f.stage].fill,
    ofNew: percent(f.value, reachedNew),
    ofBefore: i === 0 ? null : percent(f.value, data.funnel[i - 1].value),
  }));
  const won = bands[bands.length - 1];
  const summary =
    reachedNew > 0
      ? `Deals in the last 12 months. ${won.ofNew}% of the value that reached New was won.`
      : "No deals in the last 12 months yet.";

  return (
    <section className="panel mt-5 px-7 pb-7 pt-6" aria-labelledby="funnel-h">
      <h2 id="funnel-h" className="text-[17px] font-semibold tracking-[-0.005em]">
        Sales funnel
      </h2>
      <p className="mt-0.5 text-[13.5px] text-ink-muted">{summary}</p>
      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-10">
        <div className="mt-[30px]" aria-hidden="true" data-chart="funnel">
          {reachedNew > 0 ? (
            <FunnelChart width={WIDTH} height={ROW * bands.length} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
              <Tooltip content={FunnelTip} isAnimationActive={false} />
              <Funnel
                data={bands}
                dataKey="value"
                nameKey="stage"
                isAnimationActive={false}
                lastShapeType="rectangle"
                shape={bandShape(won.stage)}
              />
            </FunnelChart>
          ) : (
            <div style={{ width: WIDTH, height: ROW * bands.length }} />
          )}
        </div>
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">Sales funnel: the value that reached each stage</caption>
          <thead>
            <tr className="h-[30px] align-top text-[12.5px] text-ink-muted">
              <th scope="col" className="text-left font-normal">Stage</th>
              <th scope="col" className="pl-3.5 text-right font-normal">Deals</th>
              <th scope="col" className="pl-3.5 text-right font-normal">Reached</th>
              <th scope="col" className="pl-3.5 text-right font-normal">Of New</th>
              <th scope="col" className="pl-3.5 text-right font-normal">Of the stage before</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={b.stage} style={{ height: ROW }} className={i ? "shadow-[inset_0_1px_0_var(--divider)]" : ""}>
                <th scope="row" className="text-left font-semibold">
                  <i className="mr-[9px] inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: b.fill }} />
                  {STAGE_LABEL[b.stage]}
                </th>
                <td className="num pl-3.5 text-right">{b.count}</td>
                <td className="num pl-3.5 text-right">{formatMoney(b.value)}</td>
                <td className="num pl-3.5 text-right">{b.ofNew === null ? "" : `${b.ofNew}%`}</td>
                <td className="num pl-3.5 text-right">
                  {b.ofBefore === null ? <span className="sr-only">Not applicable</span> : `${b.ofBefore}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
