import React from 'react';
import Box from '@mui/material/Box';
import { getProductIcon, productCategories } from '../../utils/productIcons';

const ProductSummaryBar = ({ purchasedProducts, onProductClick, summaryRef, onIconPositionsUpdate, activeKeys, onResetFilters }) => {

  const getProgressColor = (purchased, total) => {
    const percentage = (purchased / total) * 100;
    if (percentage > 70) return '#10b981';
    if (percentage > 30) return '#f59e0b';
    return '#ef4444';
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
    const map = new Map();
    (purchasedProducts || []).forEach(p => {
      const k = toKey(p.subcategory || p.category || p.category_key || p.id);
      const prev = map.get(k);
      const base = {
        id: k,
        category: (productCategories.find(c => c.key === k)?.name) || (p.category || k),
        purchased_area: 0,
        total_area: 0,
        total_kg: 0
      };
      const merged = prev || base;
      merged.purchased_area = (merged.purchased_area || 0) + (p.purchased_area || 0);
      merged.total_area = (merged.total_area || 0) + (p.total_area || 0);
      merged.total_kg = (merged.total_kg || 0) + (p.total_kg ?? 0);
      map.set(k, merged);
    });
    const byIcon = new Map();
    Array.from(map.values()).forEach(prod => {
      const icon = getProductIcon(prod.category);
      const prev = byIcon.get(icon);
      if (!prev) {
        byIcon.set(icon, {
          ...prod,
          id: icon,
          key: icon,
          icon,
          total_kg: prod.total_kg ?? 0
        });
      } else {
        byIcon.set(icon, {
          ...prev,
          purchased_area: (prev.purchased_area || 0) + (prod.purchased_area || 0),
          total_area: (prev.total_area || 0) + (prod.total_area || 0),
          total_kg: (prev.total_kg || 0) + (prod.total_kg ?? 0)
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

  return (
    <Box
      ref={summaryRef}
      sx={{
        position: 'absolute',
        // Extra bottom offset on mobile; small clean gap on tablet/desktop
        bottom: {
          xs: 'max(64px, calc(env(safe-area-inset-bottom, 0px) + 64px))',
          sm: 24,
        },
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
          const icon = product.icon || getProductIcon(product.subcategory || product.category);
          const totalKg = typeof product.total_kg === 'number' && Number.isFinite(product.total_kg) ? product.total_kg : 0;
          const purchasedArea = product.purchased_area ?? 0;
          const totalArea = product.total_area || 0;
          const progressPercentage = totalArea > 0 ? Math.min(100, (purchasedArea / totalArea) * 100) : 0;
          const progressColor = getProgressColor(purchasedArea, totalArea || 1);
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
                {totalKg >= 1 ? Math.round(totalKg) : totalKg.toFixed(1)} kg
              </div>
              <div style={{
                fontSize: '7px',
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                marginBottom: '2px'
              }}>
                {Math.round(purchasedArea)}m²
              </div>
              {totalArea > 0 && (
                <div style={{
                  width: '50px',
                  height: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '1px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progressPercentage}%`,
                    height: '100%',
                    backgroundColor: progressColor,
                    transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)'
                  }} />
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
