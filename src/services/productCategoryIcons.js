import api from './api';

export async function fetchProductIconOverrides() {
  const { data } = await api.get('/api/product-category-icons');
  return data?.overrides && typeof data.overrides === 'object' ? data.overrides : {};
}

export async function adminListProductCategoryIcons() {
  const { data } = await api.get('/api/admin/product-category-icons');
  return data;
}

export async function adminUpsertProductCategoryIcon(categoryKey, imageUrl) {
  const { data } = await api.put('/api/admin/product-category-icons', {
    category_key: categoryKey,
    image_url: imageUrl,
  });
  return data;
}

export async function adminRemoveProductCategoryIcon(categoryKey) {
  const { data } = await api.delete('/api/admin/product-category-icons', {
    params: { key: categoryKey },
  });
  return data;
}
