import React, { useState, useEffect } from 'react';
import { EventType, TrajectoryModel, GenerationStep, DiscoveredPath } from '../types';
import { EVENT_TYPES, getMatrixForStep, TRAJECTORY_BINS, GLOBAL_CONSTRAINTS } from '../constants';
import { HelpCircle, ArrowRight, BookOpen, Clock, ChevronLeft, ChevronRight, GitBranch, Lock, Zap } from 'lucide-react';

interface MatrixVisualizerProps {
  trajectory: TrajectoryModel;
  totalSteps: number;
  liveStepIndex: number; 
  steps: GenerationStep[]; 
  activeArchetype?: DiscoveredPath | null; // NEW: The override path
}

const MatrixVisualizer: React.FC<MatrixVisualizerProps> = ({ trajectory, totalSteps, liveStepIndex, steps, activeArchetype }) => {
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

  // Use the helper to dynamically get the matrix based on where we are in the story
  const activeMatrix = getMatrixForStep(viewStep, totalSteps, trajectory);

  // --- DERIVE HISTORY LOGIC ---
  const relevantHistory = steps.slice(0, viewStep);

  let actualFrom: EventType | undefined;
  let actualTo: EventType | undefined;

  if (viewStep < steps.length) {
      actualTo = steps[viewStep].selectedEvent;
      if (viewStep === 0) {
          actualFrom = EventType.Introduction; 
      } else {
          actualFrom = steps[viewStep - 1].selectedEvent;
      }
  }

  // --- DETERMINE FORCED TARGET (ARCHETYPE) ---
  // If an archetype is active, what *should* be the next event at this step?
  let forcedTarget: EventType | null = null;
  if (activeArchetype) {
      // The visualizer grid shows P(Target | Source). 
      // The Archetype dictates the Target at `viewStep`.
      // Note: Steps array is 0-indexed. 
      if (activeArchetype.sequence[viewStep]) {
          forcedTarget = activeArchetype.sequence[viewStep];
      }
  }

  // --- HELPER: Semantic Phase Label ---
  const getTimeLabel = (stepIndex: number) => {
      // Calculate progress based on 1-based index to reach 100% at the end
      const progress = (stepIndex + 1) / totalSteps;
      const pct = Math.round(progress * 100);
      
      let phase = "Unknown";
      if (progress <= 0.20) phase = "Setup Phase";
      else if (progress <= 0.45) phase = "Rising Action";
      else if (progress <= 0.65) phase = "Midpoint / Crisis";
      else if (progress <= 0.85) phase = "Climax Zone";
      else phase = "Resolution";

      return `${phase} (${pct}%)`;
  };

  const getPhaseColor = (stepIndex: number) => {
      const progress = (stepIndex + 1) / totalSteps;
      if (progress <= 0.20) return "text-blue-400";
      if (progress >= 0.85) return "text-purple-400";
      return "text-indigo-400";
  };

  const getColor = (prob: number, isLocked: boolean) => {
    if (isLocked) return 'rgba(30, 41, 59, 0.5)'; // Slate 800ish for locked
    const intensity = Math.min(255, Math.floor(prob * 255 * 3)); 
    return `rgba(16, 185, 129, ${prob})`; 
  };

  const checkIsLocked = (event: EventType) => {
      const constraints = GLOBAL_CONSTRAINTS[event];
      if (!constraints) return false;
      
      // Check Dependency Lock
      if (constraints.requiresEvent) {
          const hasRequirement = relevantHistory.some(s => s.selectedEvent === constraints.requiresEvent);
          if (!hasRequirement) return true;
      }
      
      // Check Max Occurrence Lock
      if (constraints.maxOccurrences !== undefined) {
          const count = relevantHistory.filter(s => s.selectedEvent === event).length;
          if (count >= constraints.maxOccurrences) return true;
      }

      return false;
  };

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col relative">
      
      {/* Archetype Overlay Banner */}
      {activeArchetype && (
          <div className="absolute top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700 pt-4">
          <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${activeArchetype ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {activeArchetype ? <Zap size={14} /> : <BookOpen size={14} />}
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-200">
                      {activeArchetype ? 'System 1: Forced Path (Archetype)' : 'System 1: Symbolic Planner'}
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                      {activeArchetype ? `Override: ${activeArchetype.name}` : 'History-Aware Markov Chain'}
                  </div>
              </div>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => setShowAlternatives(!showAlternatives)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${showAlternatives ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
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

      {showInfo && (
          <div className="bg-slate-800/80 p-3 text-[11px] text-slate-300 border-b border-slate-700 space-y-2">
              <p><strong className="text-indigo-400">Y AXIS:</strong> Current State.</p>
              <p><strong className="text-emerald-400">X AXIS:</strong> Potential Next State.</p>
              <p className="flex items-center gap-1"><Lock size={10} className="text-slate-500" /> <span className="text-slate-400">Locked: Missing prerequisite event.</span></p>
              {activeArchetype && <p className="flex items-center gap-1"><Zap size={10} className="text-amber-500" /> <span className="text-amber-400">Golden Border: Archetype Forced Path.</span></p>}
          </div>
      )}

      {/* Time Slice Navigation */}
      <div className="bg-[#0b0f19] p-3 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono">
              <div className="flex items-center gap-2">
                  <Clock size={12} className="text-slate-500" />
                  <span className="text-slate-400">MODEL TIME:</span>
                  <span className="text-white font-bold">Step {viewStep + 1} of {totalSteps}</span>
              </div>
              <span className={`font-bold tracking-wider uppercase ${getPhaseColor(viewStep)}`}>
                  {getTimeLabel(viewStep)}
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
                max={totalSteps - 1} 
                value={viewStep} 
                onChange={(e) => setViewStep(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <button 
                onClick={() => setViewStep(Math.min(totalSteps - 1, viewStep + 1))}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                disabled={viewStep === totalSteps - 1}
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
                
                // Logic Checks
                const isLocked = checkIsLocked(toType);
                const isForced = forcedTarget === toType; // Is this where the Archetype WANTS us to go?
                
                const isActualPath = fromType === actualFrom && toType === actualTo;
                const isHighProbAlt = showAlternatives && prob > 0.15 && !isActualPath && !isLocked;
                
                return (
                    <div key={toType} className="flex-1 h-7 mx-0.5 relative group">
                    <div 
                        className={`w-full h-full rounded-[2px] transition-all duration-300 flex items-center justify-center text-[9px] cursor-help relative
                           ${isActualPath ? 'ring-2 ring-indigo-500 z-20 scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : ''}
                           ${isForced ? 'ring-2 ring-amber-500 z-30 shadow-[0_0_10px_rgba(245,158,11,0.6)]' : ''} 
                           ${isHighProbAlt ? 'ring-1 ring-cyan-500/50 ring-dashed z-10' : ''}
                           ${isLocked ? 'opacity-30' : 'opacity-100'}
                        `}
                        style={{ backgroundColor: getColor(prob, isLocked) }}
                        title={
                            isForced 
                            ? `ARCHETYPE FORCE: This path is mandated by '${activeArchetype?.name}'`
                            : (isLocked ? `LOCKED: Prerequisites not met for ${toType}` : `P(${toType} | ${fromType}) = ${(prob * 100).toFixed(1)}%`)
                        }
                    >
                        {isLocked ? (
                            <Lock size={8} className="text-slate-500" />
                        ) : isForced ? (
                            <Zap size={10} className="text-white drop-shadow-md animate-pulse" />
                        ) : (
                            <span className={`font-bold transition-opacity 
                                ${(isActualPath || isHighProbAlt || isForced) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                ${prob > 0.5 ? 'text-slate-900' : 'text-white drop-shadow-md'}
                            `}>
                            {prob.toFixed(2).replace('0.', '.')}
                            </span>
                        )}
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