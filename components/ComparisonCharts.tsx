import React from 'react';
import { EvaluationResult, GenerationStep, EventType } from '../types';
import { Activity, Hexagon, BarChart3, TrendingUp } from 'lucide-react';

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

  // --- 2. BAR CHART LOGIC (Event Distribution) ---
  // Count occurrences of each event type in the generated steps
  const eventCounts: Record<string, number> = steps.reduce((acc, step) => {
      acc[step.selectedEvent] = (acc[step.selectedEvent] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  // Sort by count descending to show most frequent events at top
  const sortedEventCounts = (Object.entries(eventCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...(Object.values(eventCounts) as number[]), 1);

  // --- 3. TENSION ARC LOGIC ---
  // Map EventTypes to arbitrary "Tension" values (1-10) for the line chart
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

  // Generate SVG points string for the line chart
  const tensionPoints = steps.map((s, i) => {
      const x = (i / (steps.length - 1 || 1)) * 100; // Use percentage for width coordinate in viewBox
      const y = 100 - (getTension(s.selectedEvent) * 10); // Height 100, inverted Y
      return `${x * 3},${y}`; // Scale X to 300 width
  }).join(' ');

  if (!neuroResult && steps.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Chart 1: Quality Radar (Left - 4 Cols) */}
        <div className="lg:col-span-4 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col items-center">
            <h4 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 self-start uppercase tracking-wider">
                <Hexagon size={14} className="text-purple-400"/>
                Metric Radar
            </h4>
            <div className="relative w-48 h-48 lg:w-56 lg:h-56">
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                    {/* Background Grid */}
                    {[2, 4, 6, 8, 10].map(r => (
                        <circle key={r} cx={center} cy={center} r={(r/10)*radius} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2,2"/>
                    ))}
                    {metrics.map((label, i) => {
                        const { x, y } = getCoordinates(11.5, i, metrics.length);
                        return (
                            <text key={label} x={x} y={y} fontSize="9" fontWeight="600" fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">
                                {label}
                            </text>
                        );
                    })}
                    
                    {/* Vanilla Area (Amber) */}
                    {vanillaResult && (
                        <polygon points={vanillaPoly} fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" />
                    )}
                    
                    {/* Neuro Area (Indigo) */}
                    {neuroResult && (
                        <polygon points={neuroPoly} fill="rgba(99, 102, 241, 0.3)" stroke="#6366f1" strokeWidth="2" />
                    )}
                </svg>
            </div>
            <div className="flex gap-4 mt-6 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
                    <span className="text-indigo-200">Neuro-Symbolic</span>
                </div>
                {vanillaResult && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
                        <span className="text-amber-200">Vanilla Baseline</span>
                    </div>
                )}
            </div>
        </div>

        {/* Chart 2: Event Type Distribution (Middle - 4 Cols) */}
        <div className="lg:col-span-4 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
            <h4 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <BarChart3 size={14} className="text-emerald-400"/>
                Event Frequency
            </h4>
            <div className="flex-1 flex flex-col justify-center gap-2.5 overflow-y-auto max-h-[240px] custom-scrollbar pr-2">
                {sortedEventCounts.length > 0 ? (
                    sortedEventCounts.map(([type, count]) => (
                        <div key={type} className="w-full">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-medium">
                                <span>{type.replace(/_/g, ' ')}</span>
                                <span className="font-mono text-emerald-400 font-bold">{count}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-xs text-slate-500 italic text-center py-10">
                        Waiting for data...
                    </div>
                )}
            </div>
        </div>

        {/* Chart 3: Structural Arc (Right - 4 Cols) */}
        <div className="lg:col-span-4 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
             <h4 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp size={14} className="text-cyan-400"/>
                Tension Arc
            </h4>
            <div className="flex-1 w-full flex items-end justify-center relative bg-gradient-to-t from-slate-900/80 to-slate-900/20 rounded-lg border border-slate-700/50 p-2 overflow-hidden">
                {steps.length > 1 ? (
                    <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible">
                        <defs>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                            </linearGradient>
                        </defs>
                        {/* Reference Lines */}
                        <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        <line x1="0" y1="80" x2="300" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        
                        {/* The Line */}
                        <polyline points={tensionPoints} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]" />
                        
                        {/* Points */}
                        {steps.map((s, i) => {
                             const x = (i / (steps.length - 1)) * 300;
                             const y = 100 - (getTension(s.selectedEvent) * 10);
                             return (
                                 <circle key={i} cx={x} cy={y} r="2.5" fill="#0b0f19" stroke="#22d3ee" strokeWidth="1.5" className="hover:scale-150 transition-transform cursor-help">
                                     <title>{s.selectedEvent} (Step {i})</title>
                                 </circle>
                             );
                        })}
                    </svg>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                        <Activity size={24} className="opacity-20" />
                        <span className="text-[10px] italic">Generating Structure...</span>
                    </div>
                )}
            </div>
             <div className="flex justify-between mt-3 text-[9px] text-slate-500 font-mono border-t border-slate-700/50 pt-2">
                <span>SETUP</span>
                <span>CONFLICT</span>
                <span>RES</span>
            </div>
        </div>
    </div>
  );
};

export default ComparisonCharts;