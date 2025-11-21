import React, { useEffect, useRef, useState } from 'react';
import { useWidgetProps, useDisplayMode } from '../hooks';
import '../styles/index.css';
import { cn } from '../lib/utils';

interface Props {
  title?: string;
  description?: string;
  diagramType?: string;
  mermaidCode?: string;
  fileKey?: string;
  nodeId?: string;
  lastModified?: string;
  author?: string;
}

const FigjamDiagram: React.FC = () => {
  const props = useWidgetProps<Props>({
    title: 'FigJam Diagram',
    description: '',
    diagramType: 'flowchart',
    mermaidCode: '',
    fileKey: '',
    nodeId: '',
    lastModified: '',
    author: ''
  });

  const { title, description, diagramType, mermaidCode, fileKey, nodeId, lastModified, author } = props;
  const displayMode = useDisplayMode();
  const isDark = displayMode === 'dark' || 
    (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (mermaidCode && diagramRef.current && !rendered) {
      // Load Mermaid dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.onload = () => {
        if (window.mermaid) {
          const theme = isDark ? 'dark' : 'default';
          window.mermaid.initialize({ startOnLoad: false, theme });
          window.mermaid.render('mermaid-svg', mermaidCode).then((result: { svg: string }) => {
            if (diagramRef.current) {
              diagramRef.current.innerHTML = result.svg;
              setRendered(true);
            }
          }).catch((error: Error) => {
            console.error('Mermaid rendering error:', error);
            if (diagramRef.current) {
              diagramRef.current.innerHTML = `<div style="padding: 20px; text-align: center; color: ${isDark ? '#999' : '#666'};">Failed to render diagram</div>`;
            }
          });
        }
      };
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [mermaidCode, rendered, isDark]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleEditInFigma = () => {
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({
        type: 'figma-open-file',
        data: { fileKey, nodeId }
      }, '*');
    }
  };

  return (
    <div className={cn(
      "w-full",
      isDark ? "bg-transparent text-[#ececec]" : "bg-transparent text-[#2d2d2d]"
    )}>
      <div 
        ref={containerRef}
        className={cn(
          "rounded-3xl overflow-hidden border",
          isDark
            ? "bg-[#2a2a2a] border-[#3a3a3a]"
            : "bg-white border-gray-200"
        )}
      >
        {/* Diagram Container */}
        <div className="relative" style={{ height: '406px', minHeight: '406px' }}>
          <div 
            className={cn(
              "w-full h-full overflow-hidden relative",
              isPanning ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{ userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <div
              ref={diagramRef}
              className="flex justify-center items-center w-full h-full transition-transform"
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoom})`,
                transformOrigin: 'center center',
                transitionDuration: isPanning ? '0ms' : '200ms'
              }}
            >
              {!mermaidCode && (
                <div className={cn(
                  "text-center py-16",
                  isDark ? "text-[#808080]" : "text-gray-500"
                )}>
                  <div className="text-6xl mb-4 opacity-50">📊</div>
                  <div className={cn(
                    "text-xl font-semibold mb-2",
                    isDark ? "text-[#ececec]" : "text-[#2d2d2d]"
                  )}>
                    No diagram available
                  </div>
                  <div className={cn(
                    "text-sm",
                    isDark ? "text-[#a0a0a0]" : "text-gray-600"
                  )}>
                    Diagram data not provided
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Right - Fullscreen Button */}
          <div className="absolute top-3 right-3">
            <button
              onClick={handleFullscreen}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150",
                isDark
                  ? "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white"
                  : "bg-white hover:bg-gray-50 text-[#222222] border border-gray-200"
              )}
              aria-label="Fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M8.02979 11.0293C8.2897 10.77 8.71078 10.7705 8.97022 11.0303C9.22965 11.2903 9.22921 11.7113 8.96924 11.9708L5.26709 15.6651H8.99952L9.1333 15.6788C9.4365 15.7406 9.66452 16.0087 9.66455 16.3301C9.66455 16.6516 9.43651 16.9196 9.1333 16.9815L8.99952 16.9952H3.65967C3.2924 16.9952 2.99463 16.6974 2.99463 16.3301V11C2.99471 10.6328 3.29245 10.335 3.65967 10.335C4.02689 10.335 4.32464 10.6328 4.32471 11V14.7266L8.02979 11.0293ZM16.9947 9.00001C16.9947 9.36728 16.6969 9.66505 16.3296 9.66505C15.9624 9.66499 15.6646 9.36724 15.6646 9.00001V5.26759L11.9703 8.96973C11.7108 9.2297 11.2898 9.23014 11.0298 8.97071C10.77 8.71127 10.7695 8.2902 11.0289 8.03028L14.7261 4.3252H10.9996C10.6324 4.3251 10.3345 4.02737 10.3345 3.66016C10.3345 3.29296 10.6324 2.99522 10.9996 2.99512H16.3296L16.4634 3.0088C16.7666 3.07069 16.9947 3.3387 16.9947 3.66016V9.00001Z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          {/* Bottom Left - Edit in Figma Button */}
          {fileKey && (
            <div className="absolute bottom-3 left-3">
              <button
                onClick={handleEditInFigma}
                className={cn(
                  "px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-150 text-sm font-medium",
                  isDark
                    ? "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white"
                    : "bg-white hover:bg-gray-50 text-[#222222] border border-gray-200"
                )}
              >
                <img 
                  src="https://static.figma.com/uploads/e6d605c4b12ced5f283846ce355611a821873174" 
                  style={{ width: '20px', height: '20px' }}
                  alt="Figma"
                />
                Edit in Figma
              </button>
            </div>
          )}

          {/* Bottom Right - Zoom Controls */}
          <div className="absolute bottom-3 right-3 flex gap-0">
            <button
              onClick={handleZoomOut}
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-all duration-150 border",
                "rounded-l-full border-r-0",
                isDark
                  ? "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white border-[#4a4a4a]"
                  : "bg-white hover:bg-gray-50 text-[#222222] border-gray-200"
              )}
              aria-label="Zoom out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M14.8628 8.27637L14.8501 8.40039L14.8628 8.27734L14.9829 8.28906L14.9956 8.29102L15.1147 8.32617C15.3833 8.43183 15.5737 8.69377 15.5737 9C15.5737 9.34975 15.3252 9.64145 14.9956 9.70898L14.9829 9.71094L14.8628 9.72266L14.8501 9.72363H3.1499C2.75037 9.72363 2.42632 9.39957 2.42627 9C2.42627 8.60042 2.75032 8.27637 3.1499 8.27637H14.8628Z" fill="currentColor" stroke="currentColor" strokeWidth="0.25"/>
              </svg>
            </button>
            <button
              onClick={handleZoomIn}
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-all duration-150 border",
                "rounded-r-full",
                isDark
                  ? "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white border-[#4a4a4a]"
                  : "bg-white hover:bg-gray-50 text-[#222222] border-gray-200"
              )}
              aria-label="Zoom in"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M8.99951 2.42627C9.39913 2.42627 9.72314 2.75034 9.72314 3.1499V8.27588H14.8628L14.8501 8.3999L14.8628 8.27686L14.9829 8.28955L14.9956 8.29053L14.9702 8.41357L14.9956 8.2915C15.3251 8.35903 15.5736 8.64989 15.5737 8.99951C15.5737 9.34928 15.3252 9.64092 14.9956 9.7085L14.9829 9.71143V9.71045L14.8628 9.72314L14.8501 9.72412V9.72314H9.72314V14.8501C9.72299 15.2496 9.39902 15.5737 8.99951 15.5737C8.60018 15.5736 8.27604 15.2495 8.27588 14.8501V9.72314H3.1499C2.75034 9.72314 2.42627 9.39913 2.42627 8.99951C2.42643 8.60007 2.75042 8.27588 3.1499 8.27588H8.27588V3.1499C8.27588 2.75042 8.60007 2.42643 8.99951 2.42627Z" fill="currentColor" stroke="currentColor" strokeWidth="0.25"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata Section */}
        {(title || description || author || lastModified) && (
          <div className={cn(
            "p-4 border-t",
            isDark ? "border-[#3a3a3a]" : "border-gray-200"
          )}>
            {title && (
              <div className={cn(
                "text-base font-semibold mb-1",
                isDark ? "text-white" : "text-[#2d2d2d]"
              )}>
                {title}
              </div>
            )}
            {description && (
              <div className={cn(
                "text-sm mb-3",
                isDark ? "text-[#a0a0a0]" : "text-gray-600"
              )}>
                {description}
              </div>
            )}
            {(author || lastModified) && (
              <div className={cn(
                "text-xs flex items-center gap-2",
                isDark ? "text-[#808080]" : "text-gray-500"
              )}>
                {author && <span>{author}</span>}
                {author && lastModified && <span>•</span>}
                {lastModified && <span>{new Date(lastModified).toLocaleDateString()}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Add mermaid type declaration
declare global {
  interface Window {
    mermaid: any;
  }
}

export default FigjamDiagram;








