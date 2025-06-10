import { PanelResizeHandle } from 'react-resizable-panels';

export default function ResizeHandle({ orientation = 'vertical' }) {
  if (orientation === 'horizontal') {
    return (
      <PanelResizeHandle className="h-3 w-full flex items-center justify-center cursor-row-resize bg-gray-200 hover:bg-blue-300 transition-colors group z-10">
        <div className="h-1 w-32 bg-gray-400 rounded group-hover:bg-blue-500 transition-colors mx-auto" />
      </PanelResizeHandle>
    );
  }
  return (
    <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-400 transition-colors cursor-col-resize flex items-center justify-center group">
      <div className="w-0.5 h-8 bg-gray-400 rounded group-hover:bg-blue-500 transition-colors" />
    </PanelResizeHandle>
  );
}