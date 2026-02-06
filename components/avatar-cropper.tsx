'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface AvatarCropperProps {
  imageUrl: string;
  onSave: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const CIRCLE_SIZE = 240;
const VIEW_SIZE = 340; // Larger than circle so you see image context outside it

export function AvatarCropper({ imageUrl, onSave, onCancel }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [minScale, setMinScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Min scale: the shorter side of the image must fill the circle diameter
      const ms = CIRCLE_SIZE / Math.min(img.width, img.height);
      setMinScale(ms);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const effectiveScale = minScale * zoom;

  // Clamp offset so the image always fully covers the circle.
  // The image center is at the circle center + offset.
  // For the image to cover the circle, no edge of the image can be inside the circle.
  // Since the circle is inscribed in a CIRCLE_SIZE square, covering the square covers the circle.
  const clampOffset = useCallback((ox: number, oy: number, s: number) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const imgW = img.width * s;
    const imgH = img.height * s;
    const maxX = Math.max(0, (imgW - CIRCLE_SIZE) / 2);
    const maxY = Math.max(0, (imgH - CIRCLE_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setOffsetStart(offset);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setOffset(clampOffset(offsetStart.x + dx, offsetStart.y + dy, effectiveScale));
  }, [dragging, dragStart, offsetStart, effectiveScale, clampOffset]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => {
      const next = Math.max(1, Math.min(4, prev - e.deltaY * 0.002));
      const newScale = minScale * next;
      setOffset(prev2 => clampOffset(prev2.x, prev2.y, newScale));
      return next;
    });
  }, [minScale, clampOffset]);

  const adjustZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = Math.max(1, Math.min(4, prev + delta));
      const newScale = minScale * next;
      setOffset(prev2 => clampOffset(prev2.x, prev2.y, newScale));
      return next;
    });
  }, [minScale, clampOffset]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;

    const drawScale = outputSize / CIRCLE_SIZE;
    const imgW = img.width * effectiveScale;
    const imgH = img.height * effectiveScale;
    const x = (outputSize / 2 - (imgW * drawScale) / 2) + offset.x * drawScale;
    const y = (outputSize / 2 - (imgH * drawScale) / 2) + offset.y * drawScale;

    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, x, y, imgW * drawScale, imgH * drawScale);

    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  }, [effectiveScale, offset, onSave]);

  const img = imgRef.current;
  const imgW = img ? img.width * effectiveScale : 0;
  const imgH = img ? img.height * effectiveScale : 0;

  // Circle is centered in the view area
  const circleOffset = (VIEW_SIZE - CIRCLE_SIZE) / 2;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#111] border border-[#333] rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="text-center">
          <p className="text-sm text-[#ededed]">Position your avatar</p>
          <p className="text-xs text-[#555]">Drag to move, scroll to zoom</p>
        </div>

        {/* Crop area — image is visible beyond the circle for context */}
        <div
          className="relative mx-auto cursor-grab active:cursor-grabbing"
          style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Image layer — can extend beyond the view area */}
          {imgLoaded && img && (
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="absolute pointer-events-none select-none"
              style={{
                width: imgW,
                height: imgH,
                left: VIEW_SIZE / 2 - imgW / 2 + offset.x,
                top: VIEW_SIZE / 2 - imgH / 2 + offset.y,
              }}
            />
          )}

          {/* Dark overlay with circle cutout — shows what gets cropped */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={VIEW_SIZE}
            height={VIEW_SIZE}
          >
            <defs>
              <mask id="circle-mask">
                <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="white" />
                <circle
                  cx={VIEW_SIZE / 2}
                  cy={VIEW_SIZE / 2}
                  r={CIRCLE_SIZE / 2}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width={VIEW_SIZE}
              height={VIEW_SIZE}
              fill="rgba(0,0,0,0.7)"
              mask="url(#circle-mask)"
            />
            <circle
              cx={VIEW_SIZE / 2}
              cy={VIEW_SIZE / 2}
              r={CIRCLE_SIZE / 2}
              fill="none"
              stroke="#555"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => adjustZoom(-0.2)}
            disabled={zoom <= 1}
            className="w-8 h-8 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors disabled:opacity-30"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="w-24 h-1 rounded-full bg-[#333] relative">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white transition-all"
              style={{ width: `${((zoom - 1) / 3) * 100}%` }}
            />
          </div>
          <button
            onClick={() => adjustZoom(0.2)}
            disabled={zoom >= 4}
            className="w-8 h-8 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors disabled:opacity-30"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-[#333] text-sm text-[#888] hover:text-white hover:bg-[#222] transition-colors flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-10 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Save
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
