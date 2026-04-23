import React from 'react';
import Box from '@mui/material/Box';
import { getProductIcon, productCategories } from '../../utils/productIcons';
import { getHarvestProgressInfo, getHarvestDaysLeftLabel, hasUpcomingHarvestOnRecord } from '../../utils/harvestProgress';

const ProductSummaryBar = ({
  purchasedProducts,
  visibleFarms = [],
  onProductClick,
  summaryRef,
  onIconPositionsUpdate,
  activeKeys,
  onResetFilters,
}) => {

  const currentProducts = React.useMemo(() => {
    const toKey = (raw) => {
      const s = raw ? raw.toString().trim() : '';
      const slug = s.toLowerCase().replace(/[\s_]+/g, '-');
      const compact = slug.replace(/-/g, '');
      const synonyms = {
        greenapple: 'green-apple',
        redapple: 'red-apple',
        lemons: 'lemon',
        tangarine: 'tangerine',
        tangerines: 'tangerine',
        corns: 'corn',
        strawberries: 'strawberry',
        tomatoes: 'tomato',
        eggplants: 'eggplant',
        peaches: 'peach',
        watermelons: 'watermelon'
      };
      const syn = synonyms[compact] || slug;
      const match = productCategories.find(c => c.key === syn || c.name.toLowerCase() === s.toLowerCase());
      return match ? match.key : syn;
    };

    const map = new Map();
    (purchasedProducts || []).forEach(p => {
      const fieldId = p.field_id ?? p.fieldId ?? p.id;
      const fieldRow = (visibleFarms || []).find((f) => String(f.id) === String(fieldId));
      const harvestSource = fieldRow ? { ...fieldRow, ...p } : p;
      if (!hasUpcomingHarvestOnRecord(harvestSource)) return;

      const k = toKey(p.subcategory || p.category || p.category_key || p.id);
      const prev = map.get(k);
      const harvestInfo = getHarvestProgressInfo(harvestSource);
      const purchasedArea = typeof p.purchased_area === 'string' ? parseFloat(p.purchased_area) : (p.purchased_area || 0);
      const productionRate = typeof p.production_rate === 'string' ? parseFloat(p.production_rate) : (p.production_rate || 0);
      const totalKg = purchasedArea * productionRate;
      
      const base = {
        id: k,
        category: (productCategories.find(c => c.key === k)?.name) || (p.category || k),
        categoryKey: k,
        purchased_area: 0,
        total_kg: 0,
        days_left: null,
        progress_percent: 0
      };
      const merged = prev || base;
      merged.purchased_area = (merged.purchased_area || 0) + purchasedArea;
      merged.total_kg = (merged.total_kg || 0) + totalKg;
      if (typeof harvestInfo.daysLeft === 'number') {
        if (merged.days_left === null || harvestInfo.daysLeft < merged.days_left) {
          merged.days_left = harvestInfo.daysLeft;
          merged.progress_percent = harvestInfo.progressPercent;
        }
      }
      map.set(k, merged);
    });
    const byIcon = new Map();
    Array.from(map.values()).forEach(prod => {
      const icon = getProductIcon(prod.categoryKey || prod.category);
      const prev = byIcon.get(icon);
      if (!prev) {
        byIcon.set(icon, {
          ...prod,
          id: icon,
          key: icon,
          icon
        });
      } else {
        byIcon.set(icon, {
          ...prev,
          purchased_area: (prev.purchased_area || 0) + (prod.purchased_area || 0),
          total_kg: (prev.total_kg || 0) + (prod.total_kg || 0),
          days_left: (prev.days_left !== null && prod.days_left !== null) 
            ? Math.min(prev.days_left, prod.days_left) 
            : (prev.days_left !== null ? prev.days_left : prod.days_left),
          progress_percent: (prev.days_left !== null && prod.days_left !== null)
            ? (prev.days_left <= prod.days_left ? prev.progress_percent : prod.progress_percent)
            : (prev.days_left !== null ? prev.progress_percent : prod.progress_percent)
        });
      }
    });
    return Array.from(byIcon.values()).filter(product => {
      const purchasedArea = typeof product.purchased_area === 'string' ? parseFloat(product.purchased_area) : (product.purchased_area || 0);
      return Number.isFinite(purchasedArea) && purchasedArea > 0;
    });
  }, [purchasedProducts, visibleFarms]);

  React.useEffect(() => {
    if (!summaryRef?.current) return;
    const container = summaryRef.current;
    const imgs = container.querySelectorAll('img[data-icon]');
    const positions = {};
    imgs.forEach(img => {
      const rect = img.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const key = img.getAttribute('data-icon');
      if (key) positions[key] = { x, y };
    });
    if (onIconPositionsUpdate) onIconPositionsUpdate(positions);
  }, [summaryRef, currentProducts, onIconPositionsUpdate]);

  if (!purchasedProducts || purchasedProducts.length === 0 || !currentProducts || currentProducts.length === 0) {
    return null;
  }

  const formatKg = (kg) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    if (kg >= 1) return `${Math.round(kg)}kg`;
    return `${kg.toFixed(1)}kg`;
  };

  return (
    <Box
      ref={summaryRef}
      sx={{
        position: 'absolute',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '6px',
        background: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        width: 'fit-content',
        maxWidth: 'calc(100vw - 24px)',
        overflowX: 'auto',
      }}
    >
      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'nowrap'
      }}>
        {currentProducts.map((product) => {
          const icon = product.icon || getProductIcon(product.categoryKey || product.category);
          const totalKg = product.total_kg || 0;
          const purchasedArea = product.purchased_area ?? 0;
          const daysLeft = product.days_left;
          const progressPercent = typeof product.progress_percent === 'number' ? product.progress_percent : 0;
          const hue = Math.min(110, Math.max(0, (progressPercent / 100) * 110));
          const progressColor = daysLeft !== null ? `hsl(${Math.max(0, hue - 20)}, 90%, 38%)` : '#9E9E9E';
          const isActive = activeKeys && activeKeys.size > 0 && activeKeys.has(icon);
          
          return (
            <div
              key={product.id || product.key}
              onClick={(e) => {
                e.preventDefault();
                onProductClick && onProductClick(e, product);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
                background: isActive ? 'rgba(255, 152, 0, 0.20)' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '1px solid #FF9800' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                minWidth: '70px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                marginBottom: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={icon} 
                  alt={product.category}
                  data-icon={icon}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
              <div style={{
                fontSize: '9px',
                fontWeight: '700',
                color: '#fff',
                textAlign: 'center',
                marginBottom: '2px',
                lineHeight: '1'
              }}>
                {formatKg(totalKg)}
              </div>
              <div style={{
                fontSize: '7px',
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                marginBottom: '2px'
              }}>
                {Math.round(purchasedArea)}m²
              </div>
              {daysLeft !== null && (
                <div style={{
                  width: '50px',
                  height: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '2px'
                }}>
                  <div style={{
                    width: `${Math.max(6, Math.min(100, progressPercent))}%`,
                    height: '100%',
                    backgroundColor: progressColor,
                    transition: 'width 0.3s ease, background-color 0.3s ease'
                  }} />
                </div>
              )}
              {daysLeft !== null && (
                <div style={{
                  fontSize: '7px',
                  color: progressColor,
                  textAlign: 'center',
                  fontWeight: '600'
                }}>
                  {getHarvestDaysLeftLabel(daysLeft, true)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        onClick={(e) => { e.preventDefault(); onResetFilters && onResetFilters(); }}
        style={{
          marginLeft: '8px',
          padding: '4px 8px',
          fontSize: '10px',
          color: '#fff',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(0,0,0,0.2)',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        Reset
      </div>

    </Box>
  );
};

export default ProductSummaryBar;
