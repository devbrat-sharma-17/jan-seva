import type { Complaint } from '../../types';

type Status = Complaint['status'];

/**
 * Human labels. `status.replace('-', ' ')` produced "in progress" in
 * lower case inside an uppercase pill, and gave escalated complaints no
 * more weight than pending ones.
 */
const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  'in-progress': 'In progress',
  'resolution-submitted': 'Resolution Submitted',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

/** Spelled out for screen readers, which get no benefit from the colour. */
const STATUS_DESCRIPTIONS: Record<Status, string> = {
  pending: 'Status: pending, awaiting department assignment',
  assigned: 'Status: assigned to a department',
  'in-progress': 'Status: work in progress',
  'resolution-submitted': 'Status: resolution submitted, awaiting verification',
  resolved: 'Status: resolved',
  escalated: 'Status: escalated after the SLA was exceeded',
};


interface StatusPillProps {
  status: Status;
  className?: string;
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  return (
    <span
      className={`status-pill status-pill--${status} ${className}`.trim()}
      title={STATUS_DESCRIPTIONS[status]}
    >
      <span className="sr-only">{STATUS_DESCRIPTIONS[status]}</span>
      <span aria-hidden="true">{STATUS_LABELS[status]}</span>
    </span>
  );
}

export function statusLabel(status: Status): string {
  return STATUS_LABELS[status] ?? status;
}
