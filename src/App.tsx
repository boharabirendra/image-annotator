import React, { useState, useRef, useEffect } from "react";

const App = () => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matrixRef = useRef<number[][] | null>(null);

  const isMouseDownRef = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState(1);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushSize, setBrushSize] = useState(1);
  const [hasImage, setHasImage] = useState(false);
  const [isEraser, setIsEraser] = useState(false);

  const categories = [
    { name: "Person", value: 1 },
    { name: "Road", value: 2 },
    { name: "Car", value: 3 },
    { name: "Footpath", value: 4 },
  ];

  const brushSizes = [3, 13, 19];

  const canvasWidth = 800;
  const canvasHeight = 600;

  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    if (!imageCanvas) return;

    const ctx = imageCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    matrixRef.current = Array.from({ length: canvasHeight }, () =>
      Array.from({ length: canvasWidth }, () => 0),
    );
  }, []);

  const applyOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  };

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.floor(e.clientX - rect.left),
      y: Math.floor(e.clientY - rect.top),
    };
  };

  // ⭐ DRAW / ERASE FUNCTION
  const revealBrush = (cx: number, cy: number) => {
    if (!matrixRef.current) return;

    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    const half = Math.floor(brushSize / 2);

    if (isEraser) {
      // ERASER MODE
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.8)";
    } else {
      // DRAW MODE
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    }

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = cx + dx;
        const py = cy + dy;

        if (px < 0 || px >= canvasWidth) continue;
        if (py < 0 || py >= canvasHeight) continue;

        if (isEraser) {
          matrixRef.current[py][px] = 0;
        } else {
          matrixRef.current[py][px] = selectedCategory;
        }

        ctx.fillRect(px, py, 1, 1);
      }
    }

    ctx.globalCompositeOperation = "source-over";
  };

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

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        matrixRef.current = Array.from({ length: canvasHeight }, () =>
          Array.from({ length: canvasWidth }, () => 0),
        );

        setHasImage(true);

        applyOverlay();
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    const imageCanvas = imageCanvasRef.current;

    if (imageCanvas) {
      const ctx = imageCanvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
    }

    const overlayCanvas = overlayCanvasRef.current;

    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");

      if (ctx) ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    matrixRef.current = Array.from({ length: canvasHeight }, () =>
      Array.from({ length: canvasWidth }, () => 0),
    );

    setHasImage(false);
    setIsDrawMode(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Image Annotator</h1>

      <div className="mb-4 flex items-center flex-wrap gap-2">
        {/* CATEGORY */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(Number(e.target.value))}
          className="p-2 border border-gray-300 rounded"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* BRUSH SIZE */}
        {brushSizes.map((size) => (
          <button
            key={size}
            onClick={() => setBrushSize(size)}
            className={`px-3 py-2 ${
              brushSize === size ? "bg-gray-700 text-white" : "bg-white border"
            }`}
          >
            {size}px
          </button>
        ))}

        {/* DRAW MODE */}
        <button
          onClick={() => setIsDrawMode((p) => !p)}
          disabled={!hasImage}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          {isDrawMode ? "Drawing ON" : "Draw"}
        </button>

        {/* ⭐ ERASER BUTTON */}
        <button
          onClick={() => setIsEraser((p) => !p)}
          disabled={!hasImage}
          className={`px-4 py-2 rounded ${
            isEraser ? "bg-yellow-500 text-white" : "bg-white border"
          }`}
        >
          {isEraser ? "Eraser ON" : "Eraser"}
        </button>

        {/* FILE INPUT */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="p-2 border border-gray-300 rounded"
        />

        <button
          onClick={clearCanvas}
          className="p-2 bg-red-500 text-white rounded"
        >
          Clear Canvas
        </button>

        <button
          onClick={() => console.log(matrixRef.current)}
          className="p-2 bg-blue-500 text-white rounded"
        >
          Log Matrix
        </button>
      </div>

      <div
        style={{
          position: "relative",
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <canvas
          ref={imageCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="border rounded-xs"
          style={{ position: "absolute" }}
        />

        <canvas
          ref={overlayCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
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
