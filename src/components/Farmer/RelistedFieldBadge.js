import React from 'react';
import { isFieldRelisted } from '../../utils/fieldRelisted';

/**
 * Pill badge for fields listed again after a previous harvest season.
 */
export default function RelistedFieldBadge({ field, className = '' }) {
  if (!isFieldRelisted(field)) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 ring-1 ring-violet-200 ${className}`}
      title="Listed again for a new season after a previous harvest"
    >
      Relisted
    </span>
  );
}
