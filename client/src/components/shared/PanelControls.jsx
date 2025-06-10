// export default function PanelControls({ 
//   bothVisible,
//   toggleLeftPanel, 
//   toggleRightPanel 
// }) {
//   return (
//     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
//       <div className="flex gap-1 bg-white rounded-full shadow-md p-1">
//         <button
//           onClick={toggleLeftPanel}
//           className="p-1 rounded-full hover:bg-gray-100"
//           title={bothVisible ? "Hide Question" : "Show Question"}
//         >
//           {bothVisible ? "◀" : "▶"}
//         </button>
//         <button
//           onClick={toggleRightPanel}
//           className="p-1 rounded-full hover:bg-gray-100"
//           title={bothVisible ? "Hide Editor" : "Show Editor"}
//         >
//           {bothVisible ? "▶" : "◀"}
//         </button>
//       </div>
//     </div>
//   );
// }

export default function PanelControls({ onMinimize, onMaximize, onClose }) {
    return (
        <div className="flex items-center space-x-1">
            {onMinimize && (
                <button 
                    onClick={onMinimize} 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
                    title="Minimize"
                >
                    <span className="transform rotate-45">_</span>
                </button>
            )}
            
            {onMaximize && (
                <button 
                    onClick={onMaximize}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
                    title="Maximize"
                >
                    <span>□</span>
                </button>
            )}
            
            {onClose && (
                <button 
                    onClick={onClose}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-red-500"
                    title="Close"
                >
                    <span>×</span>
                </button>
            )}
        </div>
    );
}