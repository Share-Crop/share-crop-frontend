import React from 'react';
import { getHarvestDaysLeftLabel, getHarvestProgressColors, getHarvestProgressInfo, formatHarvestDate } from '../../utils/harvestProgress';

const HarvestProgressBar = ({
  item,
  label = 'Harvest timeline',
  compact = false,
  showDate = true,
  daysShort = false,
  style = {},
}) => {
  const info = getHarvestProgressInfo(item);
  const colors = getHarvestProgressColors(item);
  const textSize = compact ? '11px' : '12px';
  const metaSize = compact ? '10px' : '11px';
  const barHeight = compact ? '6px' : '8px';

  return (
    <div style={{ width: '100%', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{ color: '#64748b', fontWeight: 600, fontSize: textSize }}>
          {label}
        </div>
        <div style={{ color: '#0f172a', fontWeight: 700, fontSize: textSize, textAlign: 'right' }}>
          {info.hasHarvestDate ? `${info.progressPercent}%` : 'N/A'}
          <span style={{ color: '#64748b', fontWeight: 500, fontSize: metaSize }}>
            {` • ${getHarvestDaysLeftLabel(info.daysLeft, daysShort, { isExpiredSeason: info.isExpiredSeason })}`}
          </span>
        </div>
      </div>

      <div style={{ height: barHeight, borderRadius: '999px', background: colors.track, overflow: 'hidden' }}>
        <div
          style={{
            width: `${info.progressPercent}%`,
            height: '100%',
            background: colors.fill,
            borderRadius: '999px',
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {showDate && info.harvestDate && (
        <div style={{ marginTop: '6px', fontSize: metaSize, color: '#64748b' }}>
          {info.isExpiredSeason ? 'Last harvest: ' : 'Harvest date: '}
          <span style={{ fontWeight: 600, color: '#334155' }}>{formatHarvestDate(info.harvestDate)}</span>
        </div>
      )}
    </div>
  );
};

export default HarvestProgressBar;
