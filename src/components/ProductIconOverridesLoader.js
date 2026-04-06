import { useEffect } from 'react';
import { fetchProductIconOverrides } from '../services/productCategoryIcons';
import { setProductIconOverrides } from '../utils/productIcons';

/**
 * Loads Supabase image URLs from the API once so getProductIcon() can use them app-wide.
 */
const ProductIconOverridesLoader = () => {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overrides = await fetchProductIconOverrides();
        if (!cancelled) setProductIconOverrides(overrides);
      } catch {
        if (!cancelled) setProductIconOverrides({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
};

export default ProductIconOverridesLoader;
