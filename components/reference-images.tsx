'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, Plus, ImagePlus, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { processImageFile } from '@/lib/image-utils';
import { useImageTags } from '@/hooks/use-image-tags';
import { useToast } from '@/components/toast';
import type { ReferenceImage } from '@/lib/types';

const INITIAL_SLOTS = 2;
const MAX_SLOTS = 14;

interface ReferenceImagesProps {
  images: (ReferenceImage | null)[];
  onSetSlot: (index: number, dataUrl: string, tag: string) => void;
  onClearSlot: (index: number) => void;
  onRemoveSlot: (index: number) => void;
  onAddEmptySlot: () => void;
  onReset: () => void;
}

export function ReferenceImages({
  images,
  onSetSlot,
  onClearSlot,
  onRemoveSlot,
  onAddEmptySlot,
  onReset,
}: ReferenceImagesProps) {
  const { tags, tagLoading, tagImage, setTag, removeTag, handleSlotRemoved, resetTags } = useImageTags();
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const { showToast } = useToast();

  const filledCount = images.filter(Boolean).length;

  // Find first empty slot, or -1 if none
  const findFirstEmptySlot = useCallback((): number => {
    const idx = images.findIndex(img => img === null);
    return idx;
  }, [images]);

  // Process and place an image into a slot
  const placeImage = useCallback(async (file: File, slotIndex: number) => {
    try {
      const dataUrl = await processImageFile(file);
      onSetSlot(slotIndex, dataUrl, '');
      tagImage(slotIndex, dataUrl);
    } catch (err) {
      showToast('Failed to process image', 'error');
    }
  }, [onSetSlot, tagImage, showToast]);

  // Place image in first available slot (for paste/global drop)
  const placeInFirstAvailable = useCallback(async (file: File) => {
    let targetSlot = findFirstEmptySlot();
    if (targetSlot === -1) {
      if (images.length < MAX_SLOTS) {
        onAddEmptySlot();
        targetSlot = images.length; // the new slot
      } else {
        showToast('All 14 slots are full', 'error');
        return;
      }
    }
    placeImage(file, targetSlot);
  }, [findFirstEmptySlot, images.length, onAddEmptySlot, placeImage, showToast]);

  // Handle file input change for a specific slot
  const handleFileChange = useCallback((slotIndex: number, files: FileList | null) => {
    if (!files?.length) return;
    // Place first file in the clicked slot, extras in subsequent empty slots
    const fileArray = Array.from(files);
    placeImage(fileArray[0], slotIndex);
    for (let i = 1; i < fileArray.length; i++) {
      placeInFirstAvailable(fileArray[i]);
    }
  }, [placeImage, placeInFirstAvailable]);

  // Handle clearing a slot (keep slot, remove image)
  const handleClearSlot = useCallback((index: number) => {
    onClearSlot(index);
    removeTag(index);
  }, [onClearSlot, removeTag]);

  // Handle removing a slot entirely (shifts others)
  const handleRemoveSlot = useCallback((index: number) => {
    onRemoveSlot(index);
    handleSlotRemoved(index);
  }, [onRemoveSlot, handleSlotRemoved]);

  // Reset all
  const handleReset = useCallback(() => {
    onReset();
    resetTags();
  }, [onReset, resetTags]);

  // Sync tags back to parent when they change
  useEffect(() => {
    tags.forEach((tag, index) => {
      const img = images[index];
      if (img && img.tag !== tag) {
        onSetSlot(index, img.dataUrl, tag);
      }
    });
  }, [tags]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) placeInFirstAvailable(file);
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [placeInFirstAvailable]);

  // Global drag & drop handler
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      // Only handle if not dropped on a specific slot (those handle themselves)
      if ((e.target as HTMLElement).closest('[data-slot-drop]')) return;

      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;

      for (const file of files) {
        if (file.type.startsWith('image/') || file.name.match(/\.hei[cf]$/i)) {
          placeInFirstAvailable(file);
        }
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [placeInFirstAvailable]);

  // Fullscreen navigation
  const filledIndices = images.map((img, i) => img ? i : -1).filter(i => i >= 0);
  const fullscreenPrev = () => {
    if (fullscreenIndex === null) return;
    const currentPos = filledIndices.indexOf(fullscreenIndex);
    if (currentPos > 0) setFullscreenIndex(filledIndices[currentPos - 1]);
  };
  const fullscreenNext = () => {
    if (fullscreenIndex === null) return;
    const currentPos = filledIndices.indexOf(fullscreenIndex);
    if (currentPos < filledIndices.length - 1) setFullscreenIndex(filledIndices[currentPos + 1]);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#444]">reference images</span>
        {filledCount > 0 && (
          <button
            onClick={handleReset}
            className="text-[10px] font-mono text-[#555] hover:text-[#888] transition-colors"
          >
            clear
          </button>
        )}
      </div>

      {/* Slot Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {images.map((img, i) => (
          <div
            key={i}
            data-slot-drop
            className={`
              relative h-[60px] xl:h-[14vh] rounded-lg overflow-hidden transition-all
              ${img
                ? 'ring-1 ring-inset ring-[#333] group/slot cursor-pointer'
                : `border border-dashed cursor-pointer hover:border-[#555] transition-colors ${dragOverSlot === i ? 'border-[#888] bg-[#ffffff08]' : 'border-[#333]'}`
              }
            `}
            onClick={() => {
              if (img) {
                setFullscreenIndex(i);
              } else {
                fileInputRefs.current.get(i)?.click();
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                setDragOverSlot(i);
              }
            }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverSlot(null);
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/') || file.name.match(/\.hei[cf]$/i)) {
                  placeImage(file, i);
                }
              }
            }}
          >
            {img ? (
              <>
                <img
                  src={img.dataUrl}
                  alt={tags.get(i) || `Reference ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Tag badge */}
                <div className="absolute bottom-1 left-1 right-1">
                  {editingTag === i ? (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={tags.get(i) || ''}
                      className="w-full px-1.5 py-0.5 text-[9px] font-mono bg-black/80 border border-[#555] rounded text-[#ededed] outline-none"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) setTag(i, val);
                        setEditingTag(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingTag(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      className="px-1.5 py-0.5 text-[9px] font-mono bg-black/60 backdrop-blur-sm rounded text-[#ccc] hover:bg-black/80 transition-colors truncate max-w-full block"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTag(i);
                      }}
                    >
                      {tagLoading.get(i) ? '...' : tags.get(i) || `image-${i + 1}`}
                    </button>
                  )}
                </div>
                {/* Clear button (all slots) */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearSlot(i); }}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-[#ccc]" />
                </button>
                {/* Remove slot button (slot 3+) */}
                {i >= INITIAL_SLOTS && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveSlot(i); }}
                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-[#ccc]" />
                  </button>
                )}
                {/* Expand icon */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/slot:opacity-100 transition-opacity">
                  <Maximize2 className="h-3 w-3 text-[#ccc]" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImagePlus className="h-4 w-4 text-[#444]" />
              </div>
            )}
            {/* Hidden file input per slot */}
            <input
              ref={(el) => { if (el) fileInputRefs.current.set(i, el); }}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                handleFileChange(i, e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        ))}

        {/* Add slot button */}
        {images.length < MAX_SLOTS && (
          <button
            onClick={onAddEmptySlot}
            className="h-[60px] xl:h-[14vh] rounded-lg border border-dashed border-[#333] flex items-center justify-center cursor-pointer hover:border-[#555] transition-colors"
          >
            <Plus className="h-4 w-4 text-[#444]" />
          </button>
        )}
      </div>

      {/* Fullscreen Viewer */}
      {fullscreenIndex !== null && images[fullscreenIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setFullscreenIndex(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#222] border border-[#444] flex items-center justify-center hover:bg-[#333] transition-colors z-10"
            onClick={() => setFullscreenIndex(null)}
          >
            <X className="h-4 w-4 text-[#ccc]" />
          </button>

          {/* Prev */}
          {filledIndices.indexOf(fullscreenIndex) > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#222] border border-[#444] flex items-center justify-center hover:bg-[#333] transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); fullscreenPrev(); }}
            >
              <ChevronLeft className="h-5 w-5 text-[#ccc]" />
            </button>
          )}

          {/* Next */}
          {filledIndices.indexOf(fullscreenIndex) < filledIndices.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#222] border border-[#444] flex items-center justify-center hover:bg-[#333] transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); fullscreenNext(); }}
            >
              <ChevronRight className="h-5 w-5 text-[#ccc]" />
            </button>
          )}

          {/* Image */}
          <img
            src={images[fullscreenIndex]!.dataUrl}
            alt={tags.get(fullscreenIndex) || `Reference ${fullscreenIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Tag */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-sm font-mono text-[#ccc]">
            {tags.get(fullscreenIndex) || `image-${fullscreenIndex + 1}`}
          </div>
        </div>
      )}
    </div>
  );
}
