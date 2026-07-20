"use client";
import { useEffect, useRef } from "react";

export function useDragScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const ele = ref.current;
    if (!ele) return;

    let pos = { top: 0, left: 0, x: 0, y: 0 };
    let isDragging = false;

    const mouseDownHandler = function (e) {
      // Allow clicking on interactive elements (including nested SVGs/text)
      if (e.target.closest('button, a, input, textarea, select, .action-menu-container')) {
        return;
      }
      
      isDragging = true;
      pos = {
        left: ele.scrollLeft,
        top: ele.scrollTop,
        x: e.clientX,
        y: e.clientY,
      };

      ele.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
      if (!isDragging) return;
      e.preventDefault();
      
      const dx = e.clientX - pos.x;
      const dy = e.clientY - pos.y;

      ele.scrollTop = pos.top - dy;
      ele.scrollLeft = pos.left - dx;
    };

    const mouseUpHandler = function () {
      isDragging = false;
      document.body.style.cursor = '';
      ele.style.removeProperty('user-select');
      
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Keyboard arrow scrolling
    const keyDownHandler = function(e) {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      
      const scrollStep = 50;
      if (e.key === 'ArrowRight') {
        ele.scrollLeft += scrollStep;
      } else if (e.key === 'ArrowLeft') {
        ele.scrollLeft -= scrollStep;
      } else if (e.key === 'ArrowDown') {
        ele.scrollTop += scrollStep;
      } else if (e.key === 'ArrowUp') {
        ele.scrollTop -= scrollStep;
      }
    };

    // Mouse wheel scrolling
    const wheelHandler = function(e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        ele.scrollLeft += e.deltaY;
      }
    };

    // Add initial cursor style
    // We do not add grab to the whole window because that would look weird on buttons, etc.
    ele.style.cursor = 'grab';

    window.addEventListener('mousedown', mouseDownHandler);
    window.addEventListener('wheel', wheelHandler, { passive: false });
    // Attach keydown to document to allow scrolling without focusing the table,
    // but only if the mouse is over the element (optional) or just globally.
    // Actually, attaching to the window is better for global arrow keys.
    window.addEventListener('keydown', keyDownHandler);

    return () => {
      window.removeEventListener('mousedown', mouseDownHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('wheel', wheelHandler);
    };
  }, []);

  return ref;
}
