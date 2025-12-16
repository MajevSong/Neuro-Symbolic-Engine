import React, { useState, useEffect } from 'react';
import { GenerationStep, EventType } from '../types';
import { CheckCircle, AlertTriangle, RefreshCw, Layers, Sparkles, Download, Copy, FileText, Code, ChevronDown, ChevronUp } from 'lucide-react';

interface StoryTimelineProps {
  steps: GenerationStep[];
  vanillaStory: string | null;
  vanillaPrompt?: string | null;
}

const getEventColor = (type: EventType) => {
  switch (type) {
    case EventType.Introduction: return 'border-l-blue-500 bg-blue-500/5 text-blue-200';
    case EventType.Inciting_Incident: return 'border-l-indigo-500 bg-indigo-500/5 text-indigo-200';
    case EventType.Rising_Action: return 'border-l-pink-500 bg-pink-500/5 text-pink-200';
    case EventType.Conflict: return 'border-l-red-500 bg-red-500/5 text-red-200';
    case EventType.Climax: return 'border-l-orange-500 bg-orange-500/5 text-orange-200';
    case EventType.Falling_Action: return 'border-l-yellow-500 bg-yellow-500/5 text-yellow-200';
    case EventType.Resolution: return 'border-l-emerald-500 bg-emerald-500/5 text-emerald-200';
    case EventType.Dialogue: return 'border-l-purple-500 bg-purple-500/5 text-purple-200';
    case EventType.Description: return 'border-l-slate-400 bg-slate-500/5 text-slate-200';
    default: return 'border-l-gray-500 bg-gray-500/5 text-gray-200';
  }
};

const StoryTimeline: React.FC<StoryTimelineProps> = ({ steps, vanillaStory, vanillaPrompt }) => {
  const [activeTab, setActiveTab] = useState<'neuro' | 'vanilla'>('neuro');
  // Track open prompt states for individual Neuro steps
  const [openPrompts, setOpenPrompts] = useState<Record<number, boolean>>({});

  const togglePrompt = (index: number) => {
      setOpenPrompts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  useEffect(() => {
    if (!vanillaStory && activeTab === 'vanilla') {
        setActiveTab('neuro');
    }
  }, [vanillaStory, activeTab]);

  const handleDownloadPart = (part: 'introduction' | 'conflict' | 'resolution') => {
      let start = 0;
      let end = 0;
      
      // Mapping phases to step indices based on constants.ts (TOTAL_STEPS=15)
      if (part === 'introduction') { start = 0; end = 4; } // Steps 0-3 (Setup)
      if (part === 'conflict') { start = 4; end = 11; } // Steps 4-10 (Development)
      if (part === 'resolution') { start = 11; end = 15; } // Steps 11-14 (Conclusion)

      // Allow partial downloads of available steps
      const actualEnd = Math.min(end, steps.length);
      if (actualEnd <= start) return;

      const text = steps.slice(start, actualEnd).map(s => s.generatedText).join('\n\n');
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story_${part}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const getStepCount = (start: number, end: number) => {
      if (steps.length <= start) return 0;
      return Math.min(steps.length, end) - start;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Narrative Output
            {steps.length > 0 && <span className="text-xs font-normal text-slate-500">({steps.length}/15 steps)</span>}
        </h3>
        
        <div className="flex gap-2 items-center flex-wrap">
            {steps.length > 0 && activeTab === 'neuro' && (
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 gap-1 mr-2">
                   <button 
                     onClick={() => handleDownloadPart('introduction')} 
                     disabled={getStepCount(0, 4) === 0}
                     className="px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-slate-600"
                     title="Download Setup Phase (Steps 0-3)"
                   >
                       <FileText size={10} /> Intro ({getStepCount(0, 4)}/4)
                   </button>
                   <button 
                     onClick={() => handleDownloadPart('conflict')} 
                     disabled={getStepCount(4, 11) === 0}
                     className="px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-slate-600"
                     title="Download Development Phase (Steps 4-10)"
                   >
                       <FileText size={10} /> Conflict ({getStepCount(4, 11)}/7)
                   </button>
                   <button 
                     onClick={() => handleDownloadPart('resolution')} 
                     disabled={getStepCount(11, 15) === 0}
                     className="px-2 py-1 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-slate-600"
                     title="Download Resolution Phase (Steps 11-14)"
                   >
                       <FileText size={10} /> Resolution ({getStepCount(11, 15)}/4)
                   </button>
                </div>
            )}

            {vanillaStory && (
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setActiveTab('neuro')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'neuro' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Layers size={14} />
                        Neuro
                    </button>
                    <button
                        onClick={() => setActiveTab('vanilla')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'vanilla' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Sparkles size={14} />
                        Vanilla
                    </button>
                </div>
            )}
        </div>
      </div>

      {activeTab === 'neuro' && (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
            {steps.map((step, index) => (
            <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Timeline Dot */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-xs font-mono font-bold text-slate-400">
                {step.stepIndex}
                </div>
                
                {/* Card */}
                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-r-lg border-l-4 shadow-lg ${getEventColor(step.selectedEvent)}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-75">
                    {step.selectedEvent.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                    {step.verified ? (
                        <div className="flex items-center text-emerald-400 text-xs gap-1" title={`Confidence: ${(step.verificationScore * 100).toFixed(0)}%`}>
                        <CheckCircle size={12} />
                        <span className="font-mono">{(step.verificationScore * 100).toFixed(0)}%</span>
                        </div>
                    ) : (
                        <div className="flex items-center text-amber-400 text-xs gap-1">
                        <AlertTriangle size={12} />
                        <span className="font-mono">Low Conf.</span>
                        </div>
                    )}
                    {step.retryCount > 0 && (
                        <div className="flex items-center text-slate-500 text-xs gap-1" title="Retries triggered">
                        <RefreshCw size={10} />
                        {step.retryCount}
                        </div>
                    )}
                    </div>
                </div>
                
                <p className="text-sm md:text-base leading-relaxed text-slate-100 font-serif mb-3">
                    {step.generatedText}
                </p>

                {/* Prompt Toggle */}
                <div className="border-t border-slate-700/50 pt-2">
                    <button 
                        onClick={() => togglePrompt(index)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                        <Code size={10} />
                        {openPrompts[index] ? 'Hide' : 'Show'} System Prompt
                        {openPrompts[index] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    {openPrompts[index] && (
                        <div className="mt-2 bg-black/40 p-2 rounded text-[10px] font-mono text-slate-400 whitespace-pre-wrap border border-slate-700/50">
                            {step.promptUsed || "No prompt record available."}
                        </div>
                    )}
                </div>
                </div>
            </div>
            ))}

            {steps.length === 0 && (
            <div className="text-center py-10 text-slate-500 italic">
                Engine is waiting to initialize...
            </div>
            )}
        </div>
      )}

      {activeTab === 'vanilla' && vanillaStory && (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-amber-500/20 shadow-lg">
            {/* Vanilla Prompt Display */}
            {vanillaPrompt && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2 text-amber-500/80 text-xs font-bold uppercase tracking-wider">
                        <Code size={12} />
                        Standard Prompt (Global Context)
                    </div>
                    <div className="bg-black/40 p-3 rounded text-[11px] font-mono text-slate-400 whitespace-pre-wrap border border-slate-700/50">
                        {vanillaPrompt}
                    </div>
                </div>
            )}

            <h4 className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
                Vanilla LLM Output (Gemini 2.5 Flash)
            </h4>
            <div className="prose prose-invert prose-sm md:prose-base max-w-none font-serif leading-relaxed text-slate-200">
                {vanillaStory.split('\n').map((paragraph, i) => (
                    paragraph.trim() ? <p key={i} className="mb-4">{paragraph.trim()}</p> : null
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default StoryTimeline;