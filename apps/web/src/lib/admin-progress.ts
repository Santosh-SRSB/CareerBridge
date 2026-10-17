export type AdminProgressStage = {
  key: string;
  label: string;
  count: number;
  percentOfRegistered: number | null;
  definition: string;
  detail?: string;
};

export type AdminProgressReport = {
  generatedAt: string;
  registered: number;
  stages: AdminProgressStage[];
};

export function progressShareLabel(stage: Pick<AdminProgressStage, 'percentOfRegistered'>, noun: string): string {
  return stage.percentOfRegistered == null ? `No ${noun} registered yet` : `${stage.percentOfRegistered}% of registered ${noun}`;
}

export function progressCaption(report: Pick<AdminProgressReport, 'registered'>, noun: string): string {
  return `${report.registered} registered ${noun} · each counted once per stage`;
}

/** Dashboard accent colours, one per stage in backend order. */
export const PROGRESS_PIE_COLORS = ['#0aa3c2', '#1f9d68', '#2255a4', '#d97706', '#852b99', '#da542e', '#9a6700'] as const;

export const PROGRESS_PIE_SIZE = 200;
const CENTER = PROGRESS_PIE_SIZE / 2;
const RADIUS = CENTER - 4;
/** Slices smaller than this share are too thin to carry an in-slice percentage label. */
const MIN_LABEL_SHARE = 6;

export type ProgressPieSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
  /** Share of the drawn pie (this stage's count over the sum of all stage counts), one decimal. */
  share: number;
  /** SVG path in a PROGRESS_PIE_SIZE square; null for an empty stage, which stays in the legend only. */
  path: string | null;
  labelPoint: { x: number; y: number } | null;
};

export type ProgressPie = { total: number; slices: ProgressPieSlice[] };

export type ProgressViewState = 'loading' | 'error' | 'empty' | 'ready';

export function hasProgressData(report: AdminProgressReport | null | undefined): report is AdminProgressReport {
  return !!report && report.stages.some((stage) => stage.count > 0);
}

export function progressViewState(input: {
  loading: boolean;
  error: string;
  report: AdminProgressReport | null;
}): ProgressViewState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  return hasProgressData(input.report) ? 'ready' : 'empty';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function point(angle: number, radius = RADIUS) {
  return { x: round2(CENTER + radius * Math.cos(angle)), y: round2(CENTER + radius * Math.sin(angle)) };
}

function slicePath(start: number, end: number): string {
  if (end - start >= 2 * Math.PI - 1e-9) {
    return `M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER + RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - RADIUS} ${CENTER} Z`;
  }
  const from = point(start);
  const to = point(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

/**
 * Pie geometry for the backend stages, in backend order, starting at 12 o'clock and running clockwise.
 * Slice sizes come straight from the stage counts; nothing is recalculated.
 */
export function buildProgressPie(stages: AdminProgressStage[]): ProgressPie {
  const total = stages.reduce((sum, stage) => sum + Math.max(0, stage.count), 0);
  let angle = -Math.PI / 2;
  const slices = stages.map((stage, index): ProgressPieSlice => {
    const count = Math.max(0, stage.count);
    const color = PROGRESS_PIE_COLORS[index % PROGRESS_PIE_COLORS.length]!;
    const share = total ? Math.round((count / total) * 1000) / 10 : 0;
    if (!total || count === 0) {
      return { key: stage.key, label: stage.label, count: stage.count, color, share, path: null, labelPoint: null };
    }
    const start = angle;
    const end = angle + (count / total) * 2 * Math.PI;
    angle = end;
    const labelPoint = share >= MIN_LABEL_SHARE ? (share >= 100 ? { x: CENTER, y: CENTER } : point((start + end) / 2, RADIUS * 0.62)) : null;
    return { key: stage.key, label: stage.label, count: stage.count, color, share, path: slicePath(start, end), labelPoint };
  });
  return { total, slices };
}

export function progressPieSummary(title: string, stages: Pick<AdminProgressStage, 'label' | 'count'>[]): string {
  return `${title} pie chart: ${stages.map((stage) => `${stage.label} ${stage.count}`).join(', ')}`;
}
