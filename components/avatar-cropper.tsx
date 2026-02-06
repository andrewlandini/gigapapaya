'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface AvatarCropperProps {
  imageUrl: string;
  onSave: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropper({ imageUrl, onSave, onCancel }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const CIRCLE_SIZE = 240;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Initial scale to fill the circle
      const minScale = CIRCLE_SIZE / Math.min(img.width, img.height);
      setScale(minScale * 1.1);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.2, Math.min(5, prev - e.deltaY * 0.001)));
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 512;

    const drawScale = 512 / CIRCLE_SIZE;
    const imgW = img.width * scale;
    const imgH = img.height * scale;
    const x = (512 / 2 - imgW / 2 * drawScale) + offset.x * drawScale;
    const y = (512 / 2 - imgH / 2 * drawScale) + offset.y * drawScale;

    // Clip to circle
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, x, y, imgW * drawScale, imgH * drawScale);

    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  }, [scale, offset, onSave]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#111] border border-[#333] rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="text-center">
          <p className="text-sm text-[#ededed]">Position your avatar</p>
          <p className="text-xs text-[#555]">Drag to move, scroll to zoom</p>
        </div>

        {/* Crop area */}
        <div
          className="relative mx-auto overflow-hidden rounded-full border-2 border-[#555] cursor-grab active:cursor-grabbing"
          style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {imgLoaded && imgRef.current && (
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="absolute pointer-events-none select-none"
              style={{
                width: imgRef.current.width * scale,
                height: imgRef.current.height * scale,
                left: CIRCLE_SIZE / 2 - (imgRef.current.width * scale) / 2 + offset.x,
                top: CIRCLE_SIZE / 2 - (imgRef.current.height * scale) / 2 + offset.y,
              }}
            />
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setScale(prev => Math.max(0.2, prev - 0.1))}
            className="w-8 h-8 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="w-24 h-1 rounded-full bg-[#333] relative">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white"
              style={{ width: `${Math.min(100, (scale / 3) * 100)}%` }}
            />
          </div>
          <button
            onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
            className="w-8 h-8 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors"
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
