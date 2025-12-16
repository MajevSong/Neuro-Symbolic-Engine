import React from 'react';
import { EventType, TransitionMatrix } from '../types';
import { EVENT_TYPES } from '../constants';

interface MatrixVisualizerProps {
  matrix: TransitionMatrix;
  stepIndex: number;
  highlightFrom?: EventType;
  highlightTo?: EventType;
}

const MatrixVisualizer: React.FC<MatrixVisualizerProps> = ({ matrix, stepIndex, highlightFrom, highlightTo }) => {
  // Determine color intensity based on probability
  const getColor = (prob: number, isHighlighted: boolean) => {
    // Green base color
    const intensity = Math.min(255, Math.floor(prob * 255 * 3)); // Boost visibility of low probs
    const bg = `rgba(16, 185, 129, ${prob})`; // Tailwind emerald-500 equivalent
    
    if (isHighlighted) {
      return `rgba(245, 158, 11, 0.8)`; // Amber-500 for selected path
    }
    return bg;
  };

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 font-mono">
        Time Slice T={stepIndex} (Markov Transition Probabilities)
      </h3>
      
      <div className="flex flex-col">
        {/* Header Row */}
        <div className="flex">
          <div className="w-24 shrink-0"></div>
          {EVENT_TYPES.map(type => (
            <div key={type} className="flex-1 text-[10px] sm:text-xs text-center text-slate-400 rotate-0 mb-2 truncate px-1">
              To: {type.substring(0, 4)}
            </div>
          ))}
        </div>

        {/* Matrix Rows */}
        {EVENT_TYPES.map((fromType) => (
          <div key={fromType} className="flex items-center mb-1">
            <div className={`w-24 shrink-0 text-[10px] sm:text-xs font-mono text-right pr-3 truncate ${fromType === highlightFrom ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              From: {fromType.substring(0, 4)}
            </div>
            
            {EVENT_TYPES.map((toType) => {
              const prob = matrix[fromType][toType] || 0;
              const isSelected = fromType === highlightFrom && toType === highlightTo;
              
              return (
                <div key={toType} className="flex-1 h-8 mx-0.5 relative group">
                  <div 
                    className={`w-full h-full rounded-sm transition-all duration-500 flex items-center justify-center text-[10px] ${isSelected ? 'ring-2 ring-amber-400 z-10' : ''}`}
                    style={{ backgroundColor: getColor(prob, isSelected) }}
                  >
                    <span className={`opacity-0 group-hover:opacity-100 ${prob > 0.5 ? 'text-slate-900' : 'text-slate-100'}`}>
                      {prob.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500 text-right italic">
        Hover cells to see probability P(Event[t+1] | Event[t])
      </div>
    </div>
  );
};

export default MatrixVisualizer;