import React, { useState } from 'react';
import {
  summarizeShippingDestinations,
  shippingCoverageShortLabel,
} from '../../utils/shippingDestinations';
import { getDeliveryFeeTiers, getMinDeliveryFee } from '../../utils/fieldAreaDisplay';

const chipStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 500,
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * Buyer-focused delivery status: eligibility, fee hint, optional coverage expand.
 */
export default function FieldDeliveryCheckoutSummary({
  destinations,
  deliveryCharges,
  shippingScope,
  allowed,
  orderForSomeoneElse,
  buyerLocationLabel,
  isMobile,
}) {
  const [showCoverage, setShowCoverage] = useState(false);
  const { countries, cities, regions, total } = summarizeShippingDestinations(destinations);
  const tiers = getDeliveryFeeTiers(deliveryCharges);
  const minFee = getMinDeliveryFee(deliveryCharges);
  const coverageLabel = shippingCoverageShortLabel(destinations, shippingScope);
  const fs = isMobile ? 10 : 11;

  const headline = (() => {
    if (orderForSomeoneElse) {
      return 'Use recipient address to confirm delivery';
    }
    if (allowed) {
      return buyerLocationLabel
        ? `Delivers to ${buyerLocationLabel}`
        : 'Delivers to your area';
    }
    return buyerLocationLabel
      ? `No delivery to ${buyerLocationLabel}`
      : 'Not available at your address';
  })();

  const cardBg = orderForSomeoneElse ? '#f8fafc' : (allowed ? '#f0fdf4' : '#fef2f2');
  const cardBorder = orderForSomeoneElse ? '#e2e8f0' : (allowed ? '#bbf7d0' : '#fecaca');
  const headlineColor = orderForSomeoneElse ? '#334155' : (allowed ? '#166534' : '#991b1b');

  return (
    <div
      style={{
        marginTop: isMobile ? 8 : 10,
        padding: isMobile ? 8 : 10,
        borderRadius: 8,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {!orderForSomeoneElse && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: allowed ? '#22c55e' : '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {allowed ? '✓' : '×'}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: fs, color: headlineColor, lineHeight: 1.35 }}>
            {headline}
          </div>
          {minFee != null && (
            <div style={{ fontSize: fs - 1, color: '#64748b', marginTop: 4, lineHeight: 1.35 }}>
              {tiers.length > 1
                ? `Delivery from $${minFee.toFixed(2)} · by order weight`
                : `Delivery fee $${minFee.toFixed(2)}`}
            </div>
          )}
          {tiers.length > 1 && tiers.length <= 4 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                marginTop: 6,
              }}
            >
              {tiers.map((t, i) => (
                <span key={i} style={{ ...chipStyle, background: '#fff', fontSize: 9 }}>
                  {Number.isFinite(t.upto) ? `≤${t.upto} kg` : 'Any'} · ${t.amount.toFixed(0)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {total > 0 && (
        <button
          type="button"
          onClick={() => setShowCoverage((v) => !v)}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            color: '#2563eb',
            fontSize: fs - 1,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {showCoverage ? 'Hide coverage' : `View coverage (${coverageLabel})`}
        </button>
      )}

      {showCoverage && total > 0 && (
        <div style={{ marginTop: 8 }}>
          {countries.length > 0 && (
            <div style={{ marginBottom: regions.length || cities.length ? 6 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Countries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {countries.map((c) => (
                  <span key={c} style={chipStyle} title={c}>{c}</span>
                ))}
              </div>
            </div>
          )}
          {regions.length > 0 && (
            <div style={{ marginBottom: cities.length ? 6 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                States / provinces
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {regions.map((r) => (
                  <span key={r} style={chipStyle} title={r}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {cities.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Cities
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cities.map((c) => (
                  <span key={c} style={chipStyle} title={c}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
