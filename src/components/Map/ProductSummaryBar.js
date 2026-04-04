import React from 'react';
import Box from '@mui/material/Box';
import { getProductIcon, productCategories } from '../../utils/productIcons';

const ProductSummaryBar = ({ purchasedProducts, onProductClick, summaryRef, onIconPositionsUpdate, activeKeys, onResetFilters }) => {

  const getProgressColor = (daysLeft) => {
    if (daysLeft === null || daysLeft === undefined) return '#9E9E9E';
    if (daysLeft < 0) return '#9E9E9E';
    if (daysLeft <= 3) return '#F44336';
    if (daysLeft <= 7) return '#FF9800';
    if (daysLeft <= 14) return '#FFC107';
    return '#4CAF50';
  };

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

    const getDaysLeft = (product) => {
      const harvestDates = product.harvest_dates || product.harvestDates || product.selected_harvests || [];
      if (!harvestDates.length) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureDates = harvestDates.filter(hd => {
        const d = new Date(hd.date || hd);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      }).sort((a, b) => new Date(a.date || a) - new Date(b.date || b));
      
      if (futureDates.length === 0) return null;
      
      const nextDate = new Date(futureDates[0].date || futureDates[0]);
      nextDate.setHours(0, 0, 0, 0);
      const diffMs = nextDate.getTime() - today.getTime();
      return Math.round(diffMs / (24 * 60 * 60 * 1000));
    };

    const map = new Map();
    (purchasedProducts || []).forEach(p => {
      const k = toKey(p.subcategory || p.category || p.category_key || p.id);
      const prev = map.get(k);
      const daysLeft = getDaysLeft(p);
      const purchasedArea = typeof p.purchased_area === 'string' ? parseFloat(p.purchased_area) : (p.purchased_area || 0);
      const productionRate = typeof p.production_rate === 'string' ? parseFloat(p.production_rate) : (p.production_rate || 0);
      const totalKg = purchasedArea * productionRate;
      
      const base = {
        id: k,
        category: (productCategories.find(c => c.key === k)?.name) || (p.category || k),
        categoryKey: k,
        purchased_area: 0,
        total_kg: 0,
        days_left: null
      };
      const merged = prev || base;
      merged.purchased_area = (merged.purchased_area || 0) + purchasedArea;
      merged.total_kg = (merged.total_kg || 0) + totalKg;
      if (daysLeft !== null) {
        if (merged.days_left === null || daysLeft < merged.days_left) {
          merged.days_left = daysLeft;
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
            : (prev.days_left !== null ? prev.days_left : prod.days_left)
        });
      }
    });
    return Array.from(byIcon.values()).filter(product => {
      const purchasedArea = typeof product.purchased_area === 'string' ? parseFloat(product.purchased_area) : (product.purchased_area || 0);
      return Number.isFinite(purchasedArea) && purchasedArea > 0;
    });
  }, [purchasedProducts]);

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

  if (!purchasedProducts || purchasedProducts.length === 0) {
    return null;
  }

  const formatKg = (kg) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    if (kg >= 1) return `${Math.round(kg)}kg`;
    return `${kg.toFixed(1)}kg`;
  };

  const getDaysLabel = (daysLeft) => {
    if (daysLeft === null || daysLeft === undefined) return '';
    if (daysLeft < 0) return 'Done';
    if (daysLeft === 0) return 'Today';
    return `${daysLeft}d`;
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
          const progressColor = getProgressColor(daysLeft);
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
                    width: `${Math.max(10, Math.min(95, daysLeft < 0 ? 100 : Math.max(5, 100 - (daysLeft * 6))))}%`,
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
                  {getDaysLabel(daysLeft)}
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
