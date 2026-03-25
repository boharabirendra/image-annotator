import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matrixRef = useRef<number[][] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);

  const categories = [
    { name: 'Person', value: 1 },
    { name: 'Road', value: 2 },
    { name: 'Car', value: 3 },
    { name: 'Footpath', value: 4 },
  ];

  const colors = ['white', 'red', 'blue', 'green', 'yellow'];

  const canvasWidth = 800;
  const canvasHeight = 600;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    matrixRef.current = Array.from({ length: canvasHeight }, () => Array.from({ length: canvasWidth }, () => 0));
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    drawPixel(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    drawPixel(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const drawPixel = (x: number, y: number) => {
    if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight || !matrixRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Update matrix
    matrixRef.current[y][x] = selectedCategory;
    // Draw on canvas with color based on category
    ctx.fillStyle = colors[selectedCategory];
    ctx.fillRect(x, y, 1, 1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        // Redraw annotations
        if (matrixRef.current) {
          for (let y = 0; y < canvasHeight; y++) {
            for (let x = 0; x < canvasWidth; x++) {
              const val = matrixRef.current[y][x];
              if (val !== 0) {
                ctx.fillStyle = colors[val];
                ctx.fillRect(x, y, 1, 1);
              }
            }
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    matrixRef.current = Array.from({ length: canvasHeight }, () => Array.from({ length: canvasWidth }, () => 0));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Image Annotator</h1>
      <div className="mb-4 flex items-center">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(Number(e.target.value))}
          className="mr-4 p-2 border border-gray-300 rounded"
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.name} ({cat.value})
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="p-2 border border-gray-300 rounded"
        />
        <button onClick={clearCanvas} className="p-2 bg-red-500 text-white rounded ml-4">Clear Canvas</button>
        <button onClick={() => console.log(matrixRef.current)} className="p-2 bg-blue-500 text-white rounded ml-4">Log Matrix</button>
      </div>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="border border-gray-300"
      />
    </div>
  );
};

export default App;
