import React, { useState, useRef, useEffect } from "react";

import { CANVASHEIGHT, CANVASWIDTH } from "./constants";

// ─── Morphological dilation (circular kernel, scanline-optimised) ────────────
//
// For each pixel that is SET in `mask`, we mark all pixels within `radius`
// pixels of it (Euclidean) in the output.  Using a per-row x-range avoids the
// inner dx/dy double-loop and lets us use TypedArray.fill for bulk writes,
// making this fast enough for finalize on large canvases.
const dilate = (mask: Uint8Array, radius: number): Uint8Array => {
  const result = new Uint8Array(CANVASWIDTH * CANVASHEIGHT);
  const r2 = radius * radius;

  for (let y = 0; y < CANVASHEIGHT; y++) {
    for (let x = 0; x < CANVASWIDTH; x++) {
      if (!mask[y * CANVASWIDTH + x]) continue;

      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(CANVASHEIGHT - 1, y + radius);

      for (let ny = yStart; ny <= yEnd; ny++) {
        const dy = ny - y;
        const maxDx = Math.floor(Math.sqrt(r2 - dy * dy));
        const xS = Math.max(0, x - maxDx);
        const xE = Math.min(CANVASWIDTH - 1, x + maxDx);
        result.fill(1, ny * CANVASWIDTH + xS, ny * CANVASWIDTH + xE + 1);
      }
    }
  }
  return result;
};

// ─── App ─────────────────────────────────────────────────────────────────────

const App = () => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Annotation matrices ──────────────────────────────────────────────────
  //
  // MUST be refs — plain `let` variables inside a component body are
  // re-initialised on every render, so all accumulated data is silently lost.
  //
  // image2DData  : current live annotation state (0 = unannotated, 1–4 = category)
  // prev2DData   : snapshot taken at the START of each mouse stroke; the eraser
  //               reads from here so it restores whatever was under the brush
  //               before the current stroke began, not just a hard-coded 0.
  const image2DData = useRef<number[][]>(Array.from({ length: CANVASHEIGHT }, () => new Array<number>(CANVASWIDTH).fill(0)));

  const isMouseDownRef = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState(1);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [hasImage, setHasImage] = useState(false);
  const [isEraser, setIsEraser] = useState(false);

  const categories = [
    { name: "Person", value: 1 },
    { name: "Road", value: 2 },
    { name: "Car", value: 3 },
    { name: "Footpath", value: 4 },
  ];

  const brushSizes = [3, 13, 19];

  // ── Initialise image canvas ──────────────────────────────────────────────
  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    if (!imageCanvas) return;
    const ctx = imageCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
  }, []);

  // ── Overlay helpers ──────────────────────────────────────────────────────

  /** Fill the overlay canvas with a semi-transparent dark mask. */
  const applyOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
  };

  // ── Coordinate helper ────────────────────────────────────────────────────

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor(e.clientX - rect.left),
      y: Math.floor(e.clientY - rect.top),
    };
  };

  // ── Core draw / erase function ───────────────────────────────────────────
  //
  // DRAW  : punch a hole through the dark overlay (destination-out) and record
  //         the selected category in image2DData.
  //
  // ERASE : per pixel, restore the value that was in prev2DData (snapshotted
  //         at mousedown).  If prev was 0 the pixel was unannotated, so repaint
  //         it with the dark overlay colour.  If prev was non-zero the pixel
  //         was already revealed under a different (or the same) category, so
  //         we leave the hole open and just update image2DData.
  const revealBrush = (cx: number, cy: number) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    const half = Math.floor(brushSize / 2);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = cx + dx;   
        const py = cy + dy;

        if (px < 0 || px >= CANVASWIDTH) continue;
        if (py < 0 || py >= CANVASHEIGHT) continue;

        if (isEraser) {
          // ── ERASE ─────────────────────────────────────────────────────
          image2DData.current[py][px] = 0;
          ctx.clearRect(px,py, 1, 1); 
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fillRect(px, py, 1, 1);
        } else {
          // ── DRAW ──────────────────────────────────────────────────────
          image2DData.current[py][px] = selectedCategory;
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Always reset composite op after drawing
    ctx.globalCompositeOperation = "source-over";
  };

  // ── Mouse event handlers ─────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawMode || !hasImage) return;
    if (e.button !== 0) return;

    isMouseDownRef.current = true;

    const { x, y } = getCoords(e);
    revealBrush(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawMode || !hasImage) return;
    if (!isMouseDownRef.current) return;
    const { x, y } = getCoords(e);
    revealBrush(x, y);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };
  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
  };

  // ── Image upload ─────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const imageCanvas = imageCanvasRef.current;
        if (!imageCanvas) return;
        const ctx = imageCanvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
        ctx.drawImage(img, 0, 0, CANVASWIDTH, CANVASHEIGHT);

        // Reset both matrices when a new image is loaded
        image2DData.current = Array.from({ length: CANVASHEIGHT }, () => new Array<number>(CANVASWIDTH).fill(0));

        setHasImage(true);
        applyOverlay();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ── Clear ────────────────────────────────────────────────────────────────

  const clearCanvas = () => {
    const imageCanvas = imageCanvasRef.current;
    if (imageCanvas) {
      const ctx = imageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
      }
    }

    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
    }

    image2DData.current = Array.from({ length: CANVASHEIGHT }, () => new Array<number>(CANVASWIDTH).fill(0));

    setHasImage(false);
    setIsDrawMode(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Finalize ─────────────────────────────────────────────────────────────
  //
  // Redraws the entire overlay from scratch using image2DData, then adds a
  // Photoshop-style outline:
  //
  //   GAP          = 3 px empty ring between the annotated shape and the stroke
  //   STROKE_WIDTH = 2 px white outline just outside the gap
  //
  // Algorithm:
  //   1. Build a binary mask from image2DData.
  //   2. Dilate the mask by GAP pixels            → gapDilated
  //   3. Dilate the mask by GAP + STROKE_WIDTH    → strokeDilated
  //   4. Outline pixels = strokeDilated AND NOT gapDilated
  //
  // Everything is written in a single ImageData pass for performance:
  //   • Annotated pixels     → alpha 0   (transparent, reveals image below)
  //   • Outline pixels       → white, fully opaque
  //   • Everything else      → dark overlay (rgba 0,0,0,0.8)
  //
  // Because we rebuild from image2DData, clicking Finalize multiple times is
  // safe and idempotent — it simply regenerates the outline.
  const handleFinalize = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    const data = image2DData.current;

    // ── Step 1: build binary mask ────────────────────────────────────────
    const mask = new Uint8Array(CANVASWIDTH * CANVASHEIGHT);
    let hasAnnotations = false;

    for (let y = 0; y < CANVASHEIGHT; y++) {
      for (let x = 0; x < CANVASWIDTH; x++) {
        if (data[y][x] !== 0) {
          mask[y * CANVASWIDTH + x] = 1;
          hasAnnotations = true;
        }
      }
    }

    if (!hasAnnotations) return;

    // ── Step 2–3: compute gap and stroke zones ───────────────────────────
    const GAP = 3;
    const STROKE_WIDTH = 2;

    const gapDilated = dilate(mask, GAP);
    const strokeDilated = dilate(mask, GAP + STROKE_WIDTH);

    // ── Step 4: build ImageData in one pass ─────────────────────────────
    const imageData = ctx.createImageData(CANVASWIDTH, CANVASHEIGHT);
    const pixels = imageData.data;

    for (let i = 0; i < CANVASWIDTH * CANVASHEIGHT; i++) {
      const base = i * 4;

      if (mask[i]) {
        // Annotated: fully transparent → image canvas shows through
        pixels[base] = 0;
        pixels[base + 1] = 0;
        pixels[base + 2] = 0;
        pixels[base + 3] = 0;
      } else if (strokeDilated[i] && !gapDilated[i]) {
        // Outline ring: solid white
        pixels[base] = 255;
        pixels[base + 1] = 255;
        pixels[base + 2] = 255;
        pixels[base + 3] = 255;
      } else {
        // Normal dark overlay (rgba 0,0,0,0.8  →  alpha ≈ 204)
        pixels[base] = 0;
        pixels[base + 1] = 0;
        pixels[base + 2] = 0;
        pixels[base + 3] = 204;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Image Annotator</h1>

      <div className="mb-4 flex items-center flex-wrap gap-2">
        {/* CATEGORY */}
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(Number(e.target.value))} className="p-2 border border-gray-300 rounded">
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* BRUSH SIZE */}
        {brushSizes.map((size) => (
          <button key={size} onClick={() => setBrushSize(size)} className={`px-3 py-2 ${brushSize === size ? "bg-gray-700 text-white" : "bg-white border"}`}>
            {size}px
          </button>
        ))}

        {/* DRAW MODE */}
        <button onClick={() => setIsDrawMode((p) => !p)} disabled={!hasImage} className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50">
          {isDrawMode ? "Drawing ON" : "Draw"}
        </button>

        {/* ERASER */}
        <button onClick={() => setIsEraser((p) => !p)} disabled={!hasImage} className={`px-4 py-2 rounded disabled:opacity-50 ${isEraser ? "bg-yellow-500 text-white" : "bg-white border"}`}>
          {isEraser ? "Eraser ON" : "Eraser"}
        </button>

        {/* FILE INPUT */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="p-2 border border-gray-300 rounded" />

        {/* CLEAR */}
        <button onClick={clearCanvas} className="p-2 bg-red-500 text-white rounded">
          Clear Canvas
        </button>

        {/* LOG MATRIX */}
        <button onClick={() => console.log(image2DData.current)} className="p-2 bg-blue-500 text-white rounded">
          Log Matrix
        </button>

        {/* ⭐ FINALIZE */}
        <button onClick={handleFinalize} disabled={!hasImage} className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 font-semibold">
          Finalize
        </button>
      </div>

      <div style={{ position: "relative", width: CANVASWIDTH, height: CANVASHEIGHT }}>
        {/* Bottom layer: the actual image */}
        <canvas ref={imageCanvasRef} width={CANVASWIDTH} height={CANVASHEIGHT} className="border rounded-xs" style={{ position: "absolute" }} />

        {/* Top layer: dark overlay + holes + outline */}
        <canvas
          ref={overlayCanvasRef}
          width={CANVASWIDTH}
          height={CANVASHEIGHT}
          style={{ position: "absolute" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair"
        />
      </div>
    </div>
  );
};

export default App;
