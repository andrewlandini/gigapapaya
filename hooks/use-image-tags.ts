'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook managing image tag state with auto-tagging via /api/tag-image
 */
export function useImageTags() {
  const [tags, setTags] = useState<Map<number, string>>(new Map());
  const [tagLoading, setTagLoading] = useState<Map<number, boolean>>(new Map());
  // Track in-flight requests to avoid dupes
  const pendingRef = useRef<Set<number>>(new Set());

  /** Auto-tag an image at a given slot index via API */
  const tagImage = useCallback(async (slotIndex: number, dataUrl: string) => {
    if (pendingRef.current.has(slotIndex)) return;
    pendingRef.current.add(slotIndex);

    setTagLoading(prev => new Map(prev).set(slotIndex, true));

    try {
      const res = await fetch('/api/tag-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      const tag = data.tag || `image-${slotIndex + 1}`;

      setTags(prev => {
        const next = new Map(prev);
        // Dedup: if another slot already has this tag, append index
        const existing = [...next.values()];
        if (existing.includes(tag)) {
          next.set(slotIndex, `${tag}-${slotIndex + 1}`);
        } else {
          next.set(slotIndex, tag);
        }
        return next;
      });
    } catch {
      setTags(prev => new Map(prev).set(slotIndex, `image-${slotIndex + 1}`));
    } finally {
      pendingRef.current.delete(slotIndex);
      setTagLoading(prev => {
        const next = new Map(prev);
        next.delete(slotIndex);
        return next;
      });
    }
  }, []);

  /** Manually set a tag with dedup */
  const setTag = useCallback((slotIndex: number, tag: string) => {
    setTags(prev => {
      const next = new Map(prev);
      const existing = [...next.entries()].filter(([k]) => k !== slotIndex).map(([, v]) => v);
      if (existing.includes(tag)) {
        next.set(slotIndex, `${tag}-${slotIndex + 1}`);
      } else {
        next.set(slotIndex, tag);
      }
      return next;
    });
  }, []);

  /** Remove a tag at index */
  const removeTag = useCallback((slotIndex: number) => {
    setTags(prev => {
      const next = new Map(prev);
      next.delete(slotIndex);
      return next;
    });
  }, []);

  /** Handle slot removal: shift all tags above the removed index down by 1 */
  const handleSlotRemoved = useCallback((removedIndex: number) => {
    setTags(prev => {
      const next = new Map<number, string>();
      for (const [key, value] of prev) {
        if (key < removedIndex) {
          next.set(key, value);
        } else if (key > removedIndex) {
          next.set(key - 1, value);
        }
        // key === removedIndex is dropped
      }
      return next;
    });
    setTagLoading(prev => {
      const next = new Map<number, boolean>();
      for (const [key, value] of prev) {
        if (key < removedIndex) {
          next.set(key, value);
        } else if (key > removedIndex) {
          next.set(key - 1, value);
        }
      }
      return next;
    });
  }, []);

  /** Reset all tags */
  const resetTags = useCallback(() => {
    setTags(new Map());
    setTagLoading(new Map());
    pendingRef.current.clear();
  }, []);

  return { tags, tagLoading, tagImage, setTag, removeTag, handleSlotRemoved, resetTags };
}
