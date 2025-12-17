import React, { useState } from 'react';
import { GenerationStep, EventType } from '../types';
import { CheckCircle, AlertTriangle, RefreshCw, Layers, Sparkles, FileText, Code, ChevronDown, ChevronUp, Loader2, Copy, Download, FileJson } from 'lucide-react';

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
    case EventType.Revelation: return 'border-l-violet-500 bg-violet-500/10 text-violet-200'; // NEW: Plot Twist color
    case EventType.Climax: return 'border-l-orange-500 bg-orange-500/5 text-orange-200';
    case EventType.Falling_Action: return 'border-l-yellow-500 bg-yellow-500/5 text-yellow-200';
    case EventType.Resolution: return 'border-l-emerald-500 bg-emerald-500/5 text-emerald-200';
    case EventType.Story_End: return 'border-l-slate-200 bg-slate-100/10 text-white font-bold'; // NEW: The End color
    case EventType.Dialogue: return 'border-l-purple-500 bg-purple-500/5 text-purple-200';
    case EventType.Description: return 'border-l-slate-400 bg-slate-500/5 text-slate-200';
    default: return 'border-l-gray-500 bg-gray-500/5 text-gray-200';
  }
};

const StoryTimeline: React.FC<StoryTimelineProps> = ({ steps, vanillaStory, vanillaPrompt }) => {
  // Track open prompt states for individual Neuro steps
  const [openPrompts, setOpenPrompts] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const togglePrompt = (index: number) => {
      setOpenPrompts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const copyToClipboard = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadAppendix = () => {
      let content = `# Research Appendix: Prompt Engineering Logs\n`;
      content += `Date: ${new Date().toISOString()}\n`;
      content += `Paper ID: #8821\n\n`;
      
      content += `==================================================================\n`;
      content += `PART 1: VANILLA BASELINE PROMPT (Control Group)\n`;
      content += `==================================================================\n\n`;
      content += `The following prompt was sent to the model to generate the entire story in one pass:\n\n`;
      content += `\`\`\`text\n${vanillaPrompt || "Not available"}\n\`\`\`\n\n`;

      content += `==================================================================\n`;
      content += `PART 2: NEURO-SYMBOLIC STEP-BY-STEP PROMPTS (Experimental Group)\n`;
      content += `==================================================================\n\n`;
      content += `The Neuro-Symbolic engine generates the story in 15 discrete steps. Below are the specific prompts constructed for each step, including the dynamic context injection.\n\n`;

      steps.forEach((step) => {
          content += `### Step ${step.stepIndex}: ${step.selectedEvent}\n`;
          content += `**Target Event:** ${step.selectedEvent}\n`;
          content += `**Verification Score:** ${(step.verificationScore * 100).toFixed(0)}%\n\n`;
          content += `**Prompt Used:**\n\`\`\`text\n${step.promptUsed}\n\`\`\`\n\n`;
          content += `**Generated Output:**\n> ${step.generatedText}\n\n`;
          content += `---\n\n`;
      });

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Appendix_Prompts_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

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
    <div className="space-y-6">
      {/* Header / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Scientific Log
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">EXPORT RAW DATA FOR PRESENTATION</p>
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
             {/* Appendix Download Button */}
             <button 
                onClick={handleDownloadAppendix}
                disabled={steps.length === 0 && !vanillaPrompt}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 font-bold border border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download all prompts as a Markdown file for your paper's appendix"
              >
                  <FileJson size={14} /> Download Prompt Appendix (.md)
             </button>

             <div className="h-4 w-px bg-slate-700 mx-2 hidden md:block"></div>

             <button 
                onClick={() => handleDownloadPart('introduction')} 
                disabled={getStepCount(0, 4) === 0}
                className="px-2 py-1 text-[10px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
              >
                  <FileText size={10} /> Intro
              </button>
              <button 
                onClick={() => handleDownloadPart('conflict')} 
                disabled={getStepCount(4, 11) === 0}
                className="px-2 py-1 text-[10px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
              >
                  <FileText size={10} /> Conflict
              </button>
              <button 
                onClick={() => handleDownloadPart('resolution')} 
                disabled={getStepCount(11, 15) === 0}
                className="px-2 py-1 text-[10px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
              >
                  <FileText size={10} /> Res
              </button>
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          
          {/* LEFT: Neuro-Symbolic Timeline */}
          <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                        <Layers size={18} className="text-indigo-400" />
                        <div>
                            <h4 className="text-sm font-bold text-slate-200">Neuro-Symbolic Engine</h4>
                            <p className="text-[10px] text-slate-500">Markov Chain Controlled (Step-by-Step)</p>
                        </div>
                    </div>
                    <span className="text-xs font-mono bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded">
                        Step {steps.length}/15
                    </span>
              </div>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/20 before:via-slate-700/50 before:to-transparent pl-2">
                {steps.map((step, index) => (
                    <div key={index} className="relative pl-8 group">
                        
                        {/* Timeline Dot */}
                        <div className="absolute left-0 top-0 flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-900 shadow z-10 text-[10px] font-mono font-bold text-slate-400 ring-4 ring-[#0b0f19]">
                            {step.stepIndex}
                        </div>
                        
                        {/* Card */}
                        <div className={`p-4 rounded-r-lg rounded-bl-lg border-l-2 shadow-lg transition-all ${getEventColor(step.selectedEvent)} bg-opacity-10`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                                {step.selectedEvent.replace(/_/g, ' ')}
                                </span>
                                <div className="flex items-center gap-2">
                                {step.verified ? (
                                    <div className="flex items-center text-emerald-400 text-[10px] gap-1" title={`Confidence: ${(step.verificationScore * 100).toFixed(0)}%`}>
                                    <CheckCircle size={10} />
                                    <span className="font-mono">{(step.verificationScore * 100).toFixed(0)}%</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-amber-400 text-[10px] gap-1">
                                    <AlertTriangle size={10} />
                                    <span className="font-mono">Low Conf.</span>
                                    </div>
                                )}
                                {step.retryCount > 0 && (
                                    <div className="flex items-center text-slate-500 text-[10px] gap-1" title="Retries triggered">
                                    <RefreshCw size={10} />
                                    {step.retryCount}
                                    </div>
                                )}
                                </div>
                            </div>
                            
                            <p className="text-sm leading-relaxed text-slate-200 font-serif mb-3">
                                {step.generatedText}
                            </p>

                            {/* Prompt Toggle */}
                            <div className="border-t border-slate-700/30 pt-2 mt-2">
                                <button 
                                    onClick={() => togglePrompt(index)}
                                    className={`flex items-center gap-1 text-[9px] uppercase tracking-wide font-bold transition-colors ${openPrompts[index] ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'}`}
                                >
                                    <Code size={10} />
                                    {openPrompts[index] ? 'Hide System Prompt' : 'Inspect System Prompt'}
                                    {openPrompts[index] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                                
                                {openPrompts[index] && (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex justify-between items-center bg-slate-950 border border-slate-700 border-b-0 rounded-t px-3 py-1.5">
                                            <span className="text-[9px] text-slate-500 font-mono">PROMPT_DEBUG_VIEW</span>
                                            <button 
                                                onClick={() => copyToClipboard(step.promptUsed, `step-${index}`)}
                                                className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white transition-colors"
                                            >
                                                {copiedId === `step-${index}` ? <CheckCircle size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                                {copiedId === `step-${index}` ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <div className="bg-black/60 p-3 rounded-b text-[10px] font-mono text-slate-400 whitespace-pre-wrap border border-slate-700 max-h-60 overflow-y-auto custom-scrollbar select-text">
                                            {step.promptUsed || "No prompt record available."}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {steps.length === 0 && (
                    <div className="text-center py-12 text-slate-600 italic text-sm border-2 border-dashed border-slate-800 rounded-xl ml-8">
                        Waiting for System 1 initialization...
                    </div>
                )}
            </div>
          </div>

          {/* RIGHT: Vanilla Baseline */}
          <div className="space-y-4 xl:sticky xl:top-0">
               <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-400" />
                        <div>
                            <h4 className="text-sm font-bold text-slate-200">Vanilla Baseline</h4>
                            <p className="text-[10px] text-slate-500">Standard LLM (Unconstrained)</p>
                        </div>
                    </div>
                    {vanillaStory ? (
                        <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2 py-1 rounded">
                            Complete
                        </span>
                    ) : (
                         <span className="text-xs font-mono text-slate-600 px-2 py-1">
                            Pending
                        </span>
                    )}
              </div>

              <div className="bg-slate-800/40 p-6 rounded-xl border border-amber-500/10 shadow-lg min-h-[300px]">
                {vanillaStory ? (
                    <div className="animate-in fade-in duration-700">
                        {/* Vanilla Prompt Display */}
                        {vanillaPrompt && (
                            <div className="mb-6 group">
                                <div className="flex items-center justify-between mb-2">
                                     <div className="flex items-center gap-2 text-amber-500/50 group-hover:text-amber-500 transition-colors text-[10px] font-bold uppercase tracking-wider cursor-help">
                                        <Code size={10} />
                                        Baseline Prompt Context
                                     </div>
                                     <button 
                                        onClick={() => copyToClipboard(vanillaPrompt, 'vanilla')}
                                        className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors flex items-center gap-1"
                                     >
                                         {copiedId === 'vanilla' ? <CheckCircle size={10} /> : <Copy size={10} />}
                                     </button>
                                </div>
                                <div className="bg-black/30 p-3 rounded text-[10px] font-mono text-slate-500 group-hover:text-slate-400 transition-colors whitespace-pre-wrap border border-slate-700/30 max-h-32 overflow-y-auto custom-scrollbar select-text">
                                    {vanillaPrompt}
                                </div>
                            </div>
                        )}

                        <div className="prose prose-invert prose-sm max-w-none font-serif leading-relaxed text-slate-300">
                            {vanillaStory.split('\n').map((paragraph, i) => (
                                paragraph.trim() ? <p key={i} className="mb-4 text-justify">{paragraph.trim()}</p> : null
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 py-20">
                        {steps.length > 0 ? (
                            <>
                                <Loader2 size={24} className="animate-spin text-amber-500/50" />
                                <p className="text-sm italic">Generating Baseline...</p>
                            </>
                        ) : (
                            <>
                                <Sparkles size={32} className="opacity-20" />
                                <p className="text-sm italic">Waiting to start...</p>
                            </>
                        )}
                    </div>
                )}
              </div>
          </div>

      </div>
    </div>
  );
};

export default StoryTimeline;