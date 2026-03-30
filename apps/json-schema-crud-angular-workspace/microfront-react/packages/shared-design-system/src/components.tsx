import React from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

interface KickerProps {
  children: ReactNode;
}

export function Kicker({ children }: KickerProps): JSX.Element {
  return <p className="porto-kicker">{children}</p>;
}

interface SurfaceCardProps extends PropsWithChildren {
  kicker?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function SurfaceCard({
  kicker,
  title,
  description,
  aside,
  className,
  children
}: SurfaceCardProps): JSX.Element {
  return (
    <section className={['porto-surface-card', className].filter(Boolean).join(' ')}>
      {(kicker ?? title ?? description ?? aside) ? (
        <header className="porto-surface-card__head">
          <div>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
            {title ? <h2 className="porto-surface-card__title">{title}</h2> : null}
            {description ? <p className="porto-surface-card__description">{description}</p> : null}
          </div>
          {aside ? <div className="porto-surface-card__aside">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone?: 'default' | 'info' | 'success';
}

export function Badge({ children, tone = 'default' }: BadgeProps): JSX.Element {
  return <span className={`porto-badge porto-badge--${tone}`}>{children}</span>;
}

interface StatChipProps {
  value: ReactNode;
  label: ReactNode;
}

export function StatChip({ value, label }: StatChipProps): JSX.Element {
  return (
    <span className="porto-stat-chip">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  wide?: boolean;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  wide = false
}: SegmentedTabsProps<T>): JSX.Element {
  return (
    <div className={`porto-segmented-tabs${wide ? ' porto-segmented-tabs--wide' : ''}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface StackProps extends PropsWithChildren {
  className?: string;
}

export function LayoutStack({ className, children }: StackProps): JSX.Element {
  return <div className={['porto-layout-stack', className].filter(Boolean).join(' ')}>{children}</div>;
}
