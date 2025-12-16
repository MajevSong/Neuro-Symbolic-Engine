import React from 'react';
import { EvaluationResult, GenerationStep, EventType } from '../types';
import { Activity, Hexagon } from 'lucide-react';

interface ComparisonChartsProps {
  neuroResult: EvaluationResult | null;
  vanillaResult: EvaluationResult | null;
  steps: GenerationStep[];
}

const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ neuroResult, vanillaResult, steps }) => {
  // --- 1. RADAR CHART LOGIC ---
  const metrics = ['Coherence', 'Creativity', 'Flow', 'Diversity', 'Structure'];
  const radius = 80;
  const center = 100;
  
  const getCoordinates = (value: number, index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return {
      x: center + (value / 10) * radius * Math.cos(angle),
      y: center + (value / 10) * radius * Math.sin(angle),
    };
  };

  const getPoints = (scores: number[]) => {
    return scores.map((score, i) => {
      const { x, y } = getCoordinates(score, i, metrics.length);
      return `${x},${y}`;
    }).join(' ');
  };

  // Normalize scores to 0-10 scale
  // Diversity (Self-BLEU) is inverted (Lower is better, so 0.1 -> 9, 0.9 -> 1)
  const processData = (res: EvaluationResult | null, isNeuro: boolean) => {
    if (!res) return [0, 0, 0, 0, 0];
    const diversityScore = res.metrics ? Math.max(0, 10 - (res.metrics.selfBleu * 10)) : 5;
    const structureScore = isNeuro && res.metrics ? (res.metrics.csr / 10) : (res.flowScore); // CSR for Neuro, Flow for Vanilla logic
    return [
      res.coherenceScore || 0,
      res.creativityScore || 0,
      res.flowScore || 0,
      diversityScore, // Diversity
      structureScore // Structural Adherence
    ];
  };

  const neuroScores = processData(neuroResult, true);
  const vanillaScores = processData(vanillaResult, false);
  const neuroPoly = getPoints(neuroScores);
  const vanillaPoly = getPoints(vanillaScores);

  // --- 2. TENSION ARC LOGIC ---
  // Map EventTypes to arbitrary "Tension" values (1-10)
  const getTension = (e: EventType) => {
      switch(e) {
          case EventType.Introduction: return 2;
          case EventType.Description: return 3;
          case EventType.Dialogue: return 4;
          case EventType.Inciting_Incident: return 6;
          case EventType.Rising_Action: return 7;
          case EventType.Conflict: return 8;
          case EventType.Climax: return 10;
          case EventType.Falling_Action: return 5;
          case EventType.Resolution: return 2;
          default: return 1;
      }
  };

  // Generate points for the line chart
  const tensionPoints = steps.map((s, i) => {
      const x = (i / (steps.length - 1 || 1)) * 300; // Width 300
      const y = 100 - (getTension(s.selectedEvent) * 10); // Height 100, inverted Y
      return `${x},${y}`;
  }).join(' ');

  if (!neuroResult && steps.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Chart 1: Quality Radar */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col items-center">
            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <Hexagon size={16} className="text-purple-400"/>
                Model Comparison (Quality)
            </h4>
            <div className="relative w-64 h-64">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Background Grid */}
                    {[2, 4, 6, 8, 10].map(r => (
                        <circle key={r} cx={center} cy={center} r={(r/10)*radius} fill="none" stroke="#334155" strokeWidth="1" />
                    ))}
                    {metrics.map((label, i) => {
                        const { x, y } = getCoordinates(11, i, metrics.length);
                        return (
                            <text key={label} x={x} y={y} fontSize="8" fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">
                                {label}
                            </text>
                        );
                    })}
                    
                    {/* Vanilla Area */}
                    {vanillaResult && (
                        <polygon points={vanillaPoly} fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" strokeWidth="2" />
                    )}
                    
                    {/* Neuro Area */}
                    {neuroResult && (
                        <polygon points={neuroPoly} fill="rgba(99, 102, 241, 0.4)" stroke="#6366f1" strokeWidth="2" />
                    )}
                </svg>
            </div>
            <div className="flex gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-indigo-500/40 border border-indigo-500 rounded-sm"></span>
                    <span className="text-indigo-200">Neuro-Symbolic</span>
                </div>
                {vanillaResult && (
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-amber-500/30 border border-amber-500 rounded-sm"></span>
                        <span className="text-amber-200">Vanilla Baseline</span>
                    </div>
                )}
            </div>
        </div>

        {/* Chart 2: Structural Arc */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-cyan-400"/>
                Generated Narrative Arc (Tension)
            </h4>
            <div className="w-full h-48 flex items-end justify-center relative bg-slate-900/50 rounded border border-slate-700/50 p-2">
                {steps.length > 1 ? (
                    <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible">
                        {/* Reference Lines */}
                        <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="4" />
                        <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeDasharray="4" />
                        <line x1="0" y1="80" x2="300" y2="80" stroke="#1e293b" strokeDasharray="4" />
                        
                        {/* The Line */}
                        <polyline points={tensionPoints} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Points */}
                        {steps.map((s, i) => {
                             const x = (i / (steps.length - 1)) * 300;
                             const y = 100 - (getTension(s.selectedEvent) * 10);
                             return (
                                 <circle key={i} cx={x} cy={y} r="3" fill="#0891b2" stroke="#fff" strokeWidth="1" className="hover:r-4 transition-all">
                                     <title>{s.selectedEvent}</title>
                                 </circle>
                             );
                        })}
                    </svg>
                ) : (
                    <div className="text-xs text-slate-500 italic self-center">
                        Waiting for structure generation...
                    </div>
                )}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                <span>SETUP</span>
                <span>CONFLICT</span>
                <span>RESOLUTION</span>
            </div>
        </div>
    </div>
  );
};

export default ComparisonCharts;