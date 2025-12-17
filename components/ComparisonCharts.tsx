import React from 'react';
import { EvaluationResult, GenerationStep, EventType } from '../types';
import { Activity, Hexagon, BarChart3, TrendingUp, Scale, AlignLeft } from 'lucide-react';

interface ComparisonChartsProps {
  neuroResult: EvaluationResult | null;
  vanillaResult: EvaluationResult | null;
  steps: GenerationStep[];
  vanillaStory: string | null;
}

const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ neuroResult, vanillaResult, steps, vanillaStory }) => {
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

  const processData = (res: EvaluationResult | null) => {
    if (!res) return [0, 0, 0, 0, 0];
    const diversityScore = res.metrics ? Math.max(0, 10 - (res.metrics.selfBleu * 10)) : 5;
    const structureScore = res.metrics ? (res.metrics.csr / 10) : 0;
    
    return [
      res.coherenceScore || 0,
      res.creativityScore || 0,
      res.flowScore || 0,
      diversityScore, 
      structureScore
    ];
  };

  const neuroScores = processData(neuroResult);
  const vanillaScores = processData(vanillaResult);
  const neuroPoly = getPoints(neuroScores);
  const vanillaPoly = getPoints(vanillaScores);

  // --- 2. VOLUME / WORD COUNT LOGIC ---
  const TARGET_WORDS = 1200;
  const neuroWordCount = steps.reduce((acc, step) => acc + step.generatedText.split(/\s+/).length, 0);
  const vanillaWordCount = vanillaStory ? vanillaStory.split(/\s+/).length : 0;
  
  const maxVolume = Math.max(TARGET_WORDS, neuroWordCount, vanillaWordCount);

  // --- 3. BAR CHART LOGIC (Event Distribution) ---
  const eventCounts: Record<string, number> = steps.reduce((acc, step) => {
      acc[step.selectedEvent] = (acc[step.selectedEvent] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  const sortedEventCounts = (Object.entries(eventCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...(Object.values(eventCounts) as number[]), 1);

  // --- 4. TENSION ARC LOGIC ---
  
  // A. Neuro Arc (Explicit from Steps)
  const getNeuroTension = (e: EventType) => {
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

  const neuroTensionPoints = steps.map((s, i) => {
      const x = (i / (steps.length - 1 || 1)) * 100;
      const y = 100 - (getNeuroTension(s.selectedEvent) * 10);
      return `${x * 3},${y}`;
  }).join(' ');

  // B. Vanilla Arc (Estimated from Text Chunks)
  let vanillaTensionPoints = "";
  if (vanillaStory) {
      // Split vanilla story into 15 chunks to match Neuro steps
      const words = vanillaStory.split(/\s+/);
      const chunkSize = Math.ceil(words.length / 15);
      const chunks = [];
      for (let i = 0; i < 15; i++) {
          chunks.push(words.slice(i * chunkSize, (i + 1) * chunkSize).join(" "));
      }

      // Heuristic: Calculate tension based on sentence length (shorter = higher tension) and exclamation marks
      vanillaTensionPoints = chunks.map((chunk, i) => {
          if (!chunk) return `0,100`;
          
          const sentences = chunk.split(/[.!?]+/).filter(s => s.length > 0);
          const avgSentenceLength = chunk.length / (sentences.length || 1);
          const exclamations = (chunk.match(/!/g) || []).length;
          
          // Base tension 5
          let score = 5;
          // Shorter sentences increase tension (Fast pacing)
          if (avgSentenceLength < 50) score += 2;
          if (avgSentenceLength < 30) score += 1;
          // Longer sentences decrease tension (Slow pacing)
          if (avgSentenceLength > 100) score -= 2;
          
          // Exclamations boost tension
          score += exclamations * 1.5;
          
          // Clamp 1-10
          score = Math.max(1, Math.min(10, score));

          const x = (i / 14) * 100;
          const y = 100 - (score * 10);
          return `${x * 3},${y}`;
      }).join(' ');
  }

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
                    {vanillaResult && <polygon points={vanillaPoly} fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" />}
                    {neuroResult && <polygon points={neuroPoly} fill="rgba(99, 102, 241, 0.3)" stroke="#6366f1" strokeWidth="2" />}
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

        {/* Chart 2: Volume & Frequency Analysis (Middle - 4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
             {/* Volume Analysis */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex-1 flex flex-col">
                <h4 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                    <Scale size={14} className="text-blue-400"/>
                    Volume Analysis
                </h4>
                <div className="space-y-4">
                    {/* Neuro Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-indigo-300 font-mono">
                            <span>Neuro-Symbolic</span>
                            <span>{neuroWordCount} words</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2">
                             <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(neuroWordCount/maxVolume)*100}%` }}></div>
                        </div>
                    </div>
                    {/* Vanilla Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-amber-300 font-mono">
                            <span>Vanilla Baseline</span>
                            <span>{vanillaWordCount} words</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2">
                             <div className={`bg-amber-500 h-full rounded-full ${vanillaWordCount === 0 ? 'opacity-0' : ''}`} style={{ width: `${(vanillaWordCount/maxVolume)*100}%` }}></div>
                        </div>
                    </div>
                     {/* Target Marker */}
                     <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>Target Goal</span>
                            <span>{TARGET_WORDS} words</span>
                        </div>
                        <div className="w-full bg-slate-900/50 rounded-full h-1.5 mt-1 border border-dashed border-slate-600">
                             <div className="bg-slate-600 h-full rounded-full opacity-30" style={{ width: `${(TARGET_WORDS/maxVolume)*100}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Freq */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg h-40 flex flex-col">
                <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2 uppercase tracking-wider">
                    <BarChart3 size={14} className="text-emerald-400"/>
                    Event Dist (Neuro)
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {sortedEventCounts.map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-[9px] text-slate-400">
                            <span className="truncate w-24">{type}</span>
                            <div className="flex-1 mx-2 h-1 bg-slate-900 rounded">
                                <div className="h-full bg-emerald-500 rounded" style={{ width: `${(count/maxCount)*100}%` }}></div>
                            </div>
                            <span className="font-mono">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Chart 3: Structural Arc Comparison (Right - 4 Cols) */}
        <div className="lg:col-span-4 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
             <h4 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp size={14} className="text-cyan-400"/>
                Tension Arc Comparison
            </h4>
            <div className="flex-1 w-full flex items-end justify-center relative bg-gradient-to-t from-slate-900/80 to-slate-900/20 rounded-lg border border-slate-700/50 p-2 overflow-hidden">
                {(steps.length > 1 || vanillaStory) ? (
                    <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible">
                        <defs>
                            <linearGradient id="neuroGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
                            </linearGradient>
                        </defs>
                        {/* Reference Lines */}
                        <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        <line x1="0" y1="80" x2="300" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4" />
                        
                        {/* Vanilla Line (Amber) - Made thicker and more opaque for presentation visibility */}
                        {vanillaStory && (
                             <polyline 
                                points={vanillaTensionPoints} 
                                fill="none" 
                                stroke="#f59e0b" 
                                strokeWidth="3" 
                                strokeOpacity="0.8" 
                                strokeDasharray="6,4" 
                                strokeLinecap="round"
                                className="drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]"
                             />
                        )}

                        {/* Neuro Line (Indigo) */}
                        {steps.length > 1 && (
                            <polyline points={neuroTensionPoints} fill="none" stroke="url(#neuroGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_4px_rgba(99,102,241,0.5)]" />
                        )}

                        {/* Neuro Points */}
                        {steps.map((s, i) => {
                             const x = (i / (steps.length - 1)) * 300;
                             const y = 100 - (getNeuroTension(s.selectedEvent) * 10);
                             return (
                                 <circle key={i} cx={x} cy={y} r="2" fill="#0b0f19" stroke="#6366f1" strokeWidth="1.5" />
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
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-indigo-500"></span> Neuro</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-500 border border-dashed border-amber-500"></span> Vanilla (Est.)</span>
                </div>
                <div className="flex gap-4">
                    <span>SETUP</span>
                    <span>CONFLICT</span>
                    <span>RES</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ComparisonCharts;