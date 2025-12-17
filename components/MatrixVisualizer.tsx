import React, { useState, useEffect } from 'react';
import { EventType, TimeSlicedMatrices, GenerationStep } from '../types';
import { EVENT_TYPES, TOTAL_STEPS } from '../constants';
import { Download, HelpCircle, ArrowRight, BookOpen, Clock, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';

interface MatrixVisualizerProps {
  matrices: TimeSlicedMatrices;
  liveStepIndex: number; // The engine's current execution pointer
  steps: GenerationStep[]; // History of what actually happened
}

const MatrixVisualizer: React.FC<MatrixVisualizerProps> = ({ matrices, liveStepIndex, steps }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [viewStep, setViewStep] = useState(liveStepIndex);
  const [showAlternatives, setShowAlternatives] = useState(true);

  // Sync view with engine ONLY if we are at the latest step (auto-follow), 
  // otherwise let user explore history without jumping them back.
  useEffect(() => {
    if (Math.abs(viewStep - liveStepIndex) <= 1 || liveStepIndex === 0) {
        setViewStep(liveStepIndex);
    }
  }, [liveStepIndex]);

  const activeMatrix = matrices[viewStep] || matrices[0];

  // --- DERIVE HISTORY LOGIC ---
  // Determine what ACTUALLY happened at this time slice
  let actualFrom: EventType | undefined;
  let actualTo: EventType | undefined;

  // If viewing a step that has already been generated
  if (viewStep < steps.length) {
      actualTo = steps[viewStep].selectedEvent;
      // The 'from' event is the 'to' event of the previous step, or Intro if step 0
      if (viewStep === 0) {
          actualFrom = EventType.Introduction; // Simplification: T0 implies start
      } else {
          actualFrom = steps[viewStep - 1].selectedEvent;
      }
  }

  // --- HELPER: Phase Name ---
  const getPhaseName = (t: number) => {
      if (t < 4) return "PHASE 1: SETUP";
      if (t < 11) return "PHASE 2: DEVELOPMENT";
      return "PHASE 3: CONCLUSION";
  };

  const getPhaseColor = (t: number) => {
      if (t < 4) return "text-blue-400";
      if (t < 11) return "text-indigo-400";
      return "text-purple-400";
  };

  // Determine color intensity based on probability
  const getColor = (prob: number) => {
    const intensity = Math.min(255, Math.floor(prob * 255 * 3)); 
    return `rgba(16, 185, 129, ${prob})`; // Tailwind emerald-500 base
  };

  const downloadSystem1Doc = () => {
      const content = `# System 1: Sembolik Planlayıcı (Markov Zincirleri) Analizi\n(See full doc logic in source code...)`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `System1_Logic_Reference_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col">
      
      {/* Header Bar */}
      <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded">
                <BookOpen size={14} />
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-200">System 1: Symbolic Planner</h3>
                  <div className="text-[10px] text-slate-400 font-mono">Markov State Transition Model</div>
              </div>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => setShowAlternatives(!showAlternatives)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${showAlternatives ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
                title="Highlight high-probability alternative paths"
              >
                  <GitBranch size={12} />
                  {showAlternatives ? 'Hide Alts' : 'Show Alts'}
              </button>
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                  <HelpCircle size={16} />
              </button>
          </div>
      </div>

      {/* Explanation Banner */}
      {showInfo && (
          <div className="bg-slate-800/80 p-3 text-[11px] text-slate-300 border-b border-slate-700 space-y-2">
              <p><strong className="text-indigo-400">SATIRLAR (Y):</strong> Mevcut Durum.</p>
              <p><strong className="text-emerald-400">SÜTUNLAR (X):</strong> Hedef Durum.</p>
              <p><span className="text-amber-400 font-bold border border-amber-500 px-1 rounded">Turuncu</span> = Seçilen Yol.</p>
              <p><span className="text-cyan-400 font-bold border border-dashed border-cyan-400 px-1 rounded">Kesik Çizgi</span> = Yüksek Olasılıklı Alternatif ({'>'}15%).</p>
          </div>
      )}

      {/* Time Slice Navigation */}
      <div className="bg-[#0b0f19] p-3 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono">
              <div className="flex items-center gap-2">
                  <Clock size={12} className="text-slate-500" />
                  <span className="text-slate-400">TIME SLICE:</span>
                  <span className="text-white font-bold">T = {viewStep}</span>
              </div>
              <span className={`font-bold tracking-wider ${getPhaseColor(viewStep)}`}>
                  {getPhaseName(viewStep)}
              </span>
          </div>
          
          <div className="flex items-center gap-2">
               <button 
                onClick={() => setViewStep(Math.max(0, viewStep - 1))}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                disabled={viewStep === 0}
               >
                   <ChevronLeft size={16} />
               </button>
               <input 
                type="range" 
                min="0" 
                max={TOTAL_STEPS - 1} 
                value={viewStep} 
                onChange={(e) => setViewStep(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <button 
                onClick={() => setViewStep(Math.min(TOTAL_STEPS - 1, viewStep + 1))}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                disabled={viewStep === TOTAL_STEPS - 1}
               >
                   <ChevronRight size={16} />
               </button>
          </div>
      </div>

      {/* Visualization Container */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[500px]">
            
            {/* Axis Labels */}
            <div className="flex justify-between items-end mb-2 px-1">
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    Current State (Row) <ArrowRight size={10} /> Next State (Column)
                </span>
            </div>

            {/* Header Row */}
            <div className="flex mb-1">
            <div className="w-24 shrink-0"></div>
            {EVENT_TYPES.map(type => (
                <div key={type} className="flex-1 text-[9px] uppercase tracking-wider text-center text-slate-500 truncate px-0.5" title={type}>
                {type.substring(0, 4)}
                </div>
            ))}
            </div>

            {/* Matrix Rows */}
            {EVENT_TYPES.map((fromType) => (
            <div key={fromType} className="flex items-center mb-1 hover:bg-slate-800/50 rounded transition-colors group/row">
                <div className={`w-24 shrink-0 text-[10px] font-mono text-right pr-3 truncate transition-colors ${fromType === actualFrom ? 'text-amber-400 font-bold' : 'text-slate-500 group-hover/row:text-slate-300'}`} title={fromType}>
                {fromType.length > 12 ? fromType.substring(0, 10) + '..' : fromType}
                </div>
                
                {EVENT_TYPES.map((toType) => {
                const prob = activeMatrix[fromType][toType] || 0;
                
                // Logic for styling
                const isActualPath = fromType === actualFrom && toType === actualTo;
                const isHighProbAlt = showAlternatives && prob > 0.15 && !isActualPath;
                
                return (
                    <div key={toType} className="flex-1 h-7 mx-0.5 relative group">
                    <div 
                        className={`w-full h-full rounded-[2px] transition-all duration-300 flex items-center justify-center text-[9px] cursor-help relative
                           ${isActualPath ? 'ring-2 ring-amber-500 z-20 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : ''}
                           ${isHighProbAlt ? 'ring-1 ring-cyan-500/50 ring-dashed z-10' : ''}
                        `}
                        style={{ backgroundColor: getColor(prob) }}
                        title={`P(${toType} | ${fromType}) = ${(prob * 100).toFixed(1)}%`}
                    >
                         {/* Probability Text (Show on hover OR if it's the actual/high-alt path) */}
                        <span className={`font-bold transition-opacity 
                            ${(isActualPath || isHighProbAlt) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                            ${prob > 0.5 ? 'text-slate-900' : 'text-white drop-shadow-md'}
                        `}>
                        {prob.toFixed(2).replace('0.', '.')}
                        </span>
                    </div>
                    </div>
                );
                })}
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default MatrixVisualizer;