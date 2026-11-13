import React from 'react';

// Keep the product action in view while long descriptions use their own space.
export default function CatalogDetails({ className = '', children, actions }) {
  return <div className={`catalog-product-details ${className}`}>
    <div className="catalog-product-copy custom-scrollbar" tabIndex={0} role="region" aria-label="Product details">{children}</div>
    <div className="catalog-product-actions">{actions}</div>
  </div>;
}
