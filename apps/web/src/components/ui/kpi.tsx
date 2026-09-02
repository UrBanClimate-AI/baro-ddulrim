import type { ReactNode } from "react";

/** KPI 타일 그리드 (4열, 반응형 2열) */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <section className="kpi-grid">{children}</section>;
}

export function KpiTile({
  label,
  value,
  danger = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <article className={`kpi-tile${danger ? " kpi-danger" : ""}`}>
      <div className="kpi-label">
        {icon}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
    </article>
  );
}
