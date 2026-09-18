// SPDX-License-Identifier: Apache-2.0
export interface MetricProps {
  label: string;
  value: string;
  unit?: string;
  title?: string;
  size?: "lg" | "md" | "sm";
}

export function Metric(props: MetricProps) {
  const size = props.size ?? "md";
  const cls = size === "lg" ? "metric metric--lg" : size === "sm" ? "metric metric--sm" : "metric";
  return (
    <div className={cls}>
      <span className="eyebrow">{props.label}</span>
      <span className="metric__value" data-metric title={props.title ?? props.value}>
        {props.value}
        {props.unit ? <span className="metric__unit"> {props.unit}</span> : null}
      </span>
    </div>
  );
}
