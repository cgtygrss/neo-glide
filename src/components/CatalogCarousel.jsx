import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogSwipeDirection, advanceCatalogWheel } from './CatalogSwipe';
import './CatalogCarousel.css';

export default function CatalogCarousel({ items, selectedId, onSelect, label, itemLabel = 'item', accent = '#8fe1d4', children }) {
  const index = Math.max(0, items.findIndex(item => item.id === selectedId));
  const gesture = useRef(null);
  const viewport = useRef(null);
  const suppressClick = useRef(false);
  const wheelGesture = useRef({});
  const [direction, setDirection] = useState(1);
  const select = useCallback(next => {
    if (next < 0 || next >= items.length || next === index) return;
    setDirection(next > index ? 1 : -1);
    onSelect(items[next].id);
  }, [index, items, onSelect]);
  useEffect(() => {
    const element = viewport.current;
    const wheel = event => {
      const step = advanceCatalogWheel(wheelGesture.current, event, performance.now(), element.clientWidth);
      if (step === null) return;
      if (event.cancelable) event.preventDefault();
      if (step) select(index + step);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [index, select]);
  const resetDrag = () => {
    gesture.current = null;
    viewport.current?.style.setProperty('--catalog-drag', '0px');
    viewport.current?.classList.remove('is-dragging');
  };
  const startDrag = event => {
    suppressClick.current = false;
    if (!event.isPrimary || event.button !== 0) return;
    // Buying, equipping and preview controls keep their ordinary click behavior.
    if (event.target.closest('button, a, input, select, textarea')) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = event => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { resetDrag(); return; }
    if (Math.abs(dx) < 10) return;
    const hasNeighbor = dx < 0 ? index < items.length - 1 : index > 0;
    viewport.current.classList.add('is-dragging');
    viewport.current.style.setProperty('--catalog-drag', `${Math.max(-70, Math.min(70, dx * (hasNeighbor ? .45 : .12)))}px`);
  };
  const endDrag = event => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const step = catalogSwipeDirection(start, { x: event.clientX, y: event.clientY }, event.currentTarget.clientWidth);
    if (step) {
      suppressClick.current = true;
      select(index + step);
    }
    resetDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleKeyDown = event => {
    suppressClick.current = false;
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button, input, select, textarea, a')) return;
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    select(next);
  };
  const navigation = step => {
    const Icon = step < 0 ? ChevronLeft : ChevronRight;
    return <button type="button" className={`catalog-step ${step < 0 ? 'previous' : 'next'}`} disabled={!items[index + step]}
      aria-label={`${step < 0 ? 'Previous' : 'Next'} ${itemLabel}`} onClick={() => select(index + step)}>
      <Icon size={22}/>
    </button>;
  };
  return <section className="catalog-carousel" style={{ '--catalog-accent': accent }} role="region" aria-roledescription="carousel" aria-label={label}>
    <div className="catalog-carousel-shell">
      {navigation(-1)}
      <div ref={viewport} className="catalog-carousel-viewport" tabIndex={0} aria-label={`Browse ${label.toLowerCase()}`}
        onKeyDown={handleKeyDown} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
        onPointerCancel={resetDrag} onLostPointerCapture={resetDrag}
        onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        <div key={selectedId} className="catalog-current" style={{ '--catalog-direction': direction }} role="group"
          aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}: ${items[index]?.name || ''}`}>
          {children}
        </div>
      </div>
      {navigation(1)}
    </div>
    <span className="catalog-sr-only" role="status" aria-live="polite" aria-atomic="true">{index + 1} of {items.length}: {items[index]?.name}</span>
  </section>;
}
