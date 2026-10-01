'use client';

import React, { useEffect, useRef, TextareaHTMLAttributes } from 'react';

interface AutoResizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, minRows = 2, className = '', style, onInput, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const handleRef = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const adjustHeight = () => {
      const el = internalRef.current;
      if (!el) return;
      // Use requestAnimationFrame to avoid layout thrashing
      requestAnimationFrame(() => {
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, minRows * 20)}px`;
      });
    };

    useEffect(() => {
      adjustHeight();
    }, [value, minRows]);

    useEffect(() => {
      window.addEventListener('resize', adjustHeight);
      return () => window.removeEventListener('resize', adjustHeight);
    }, []);

    return (
      <textarea
        ref={handleRef}
        value={value}
        rows={minRows}
        onInput={(e) => {
          adjustHeight();
          onInput?.(e);
        }}
        style={{
          // Native field-sizing (CSS field-sizing: content)
          fieldSizing: 'content' as any,
          ...style,
        }}
        className={`resize-none overflow-hidden ${className}`}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
