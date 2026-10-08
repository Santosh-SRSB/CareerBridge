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

/** Bar length relative to the registered population (min 2% so a non-zero stage stays visible). */
export function progressBarWidth(count: number, registered: number): number {
  if (!registered || count <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((count / registered) * 100)));
}

export function progressShareLabel(stage: Pick<AdminProgressStage, 'percentOfRegistered'>, noun: string): string {
  return stage.percentOfRegistered == null ? `No ${noun} registered yet` : `${stage.percentOfRegistered}% of registered ${noun}`;
}

export function progressCaption(report: Pick<AdminProgressReport, 'registered'>, noun: string): string {
  return `${report.registered} registered ${noun} · each counted once per stage`;
}
