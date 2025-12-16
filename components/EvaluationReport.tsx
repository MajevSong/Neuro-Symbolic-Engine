import React from 'react';
import { EvaluationResult } from '../types';
import { Award, Layers, Sparkles, Download, FileText, Activity, Info, HelpCircle } from 'lucide-react';

interface EvaluationReportProps {
  neuroResult: EvaluationResult | null;
  vanillaResult: EvaluationResult | null;
  isLoading: boolean;
}

interface ScoreCardProps {
    label: string;
    score: string | number;
    colorClass: string;
    subText?: string;
    description: string;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, colorClass, subText, description }) => (
    <div className="group relative bg-slate-800 p-3 rounded-lg text-center border border-slate-700 flex flex-col justify-center h-full hover:border-slate-500 transition-colors">
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <HelpCircle size={10} className="text-slate-500" />
        </div>
        <div className={`text-xl md:text-2xl font-bold ${colorClass} mb-1`}>{score}</div>
        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
        {subText && <div className="text-[9px] text-slate-500 mt-1">{subText}</div>}

        {/* Tooltip */}
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/95 text-slate-200 text-[10px] text-left rounded border border-slate-600 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            {description}
        </div>
    </div>
);

const EvaluationReport: React.FC<EvaluationReportProps> = ({ neuroResult, vanillaResult, isLoading }) => {
  
  const handleDownloadReport = () => {
      if (!neuroResult) return;
      
      const reportData = {
          timestamp: new Date().toISOString(),
          neuro_symbolic: neuroResult,
          vanilla_baseline: vanillaResult || "Not Run",
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_metrics_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500/30 animate-pulse mt-8">
        <div className="h-6 w-1/3 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 w-full bg-slate-700 rounded mb-2"></div>
        <div className="h-4 w-2/3 bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (!neuroResult && !vanillaResult) return null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-indigo-500/50 shadow-2xl mt-8">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="text-amber-400" />
            Performance Evaluation
        </h3>
        
        {neuroResult && (
            <button 
                onClick={handleDownloadReport}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-600 transition-colors"
                title="Download JSON Metrics for Paper"
            >
                <Download size={14} />
                Export Data
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Neuro-Symbolic Results */}
        {neuroResult && (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 text-indigo-300 font-semibold border-b border-indigo-500/30 pb-2">
                    <div className="flex items-center gap-2">
                        <Layers size={16} />
                        <span>Neuro-Symbolic Engine</span>
                    </div>
                    <span className="text-xs bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200">Experimental</span>
                </div>
                
                {/* Qualitative Scores */}
                <div className="grid grid-cols-3 gap-2">
                    <ScoreCard 
                        label="Coherence" 
                        score={`${neuroResult.coherenceScore}/10`} 
                        colorClass="text-indigo-400" 
                        description="Global logical consistency score (1-10). Does the plot make sense from start to finish without hallucinations?"
                    />
                    <ScoreCard 
                        label="Creativity" 
                        score={`${neuroResult.creativityScore}/10`} 
                        colorClass="text-pink-400" 
                        description="Novelty score (1-10). Assessing the uniqueness of character voice and plot twists."
                    />
                    <ScoreCard 
                        label="Flow" 
                        score={`${neuroResult.flowScore}/10`} 
                        colorClass="text-cyan-400" 
                        description="Pacing score (1-10). How well the story moves between Rising Action, Climax, and Resolution."
                    />
                </div>

                {/* Quantitative Research Metrics */}
                {neuroResult.metrics && (
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-indigo-500/20">
                         <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                             <Activity size={12} /> RESEARCH METRICS
                         </h4>
                         <div className="grid grid-cols-3 gap-2">
                            <ScoreCard 
                                label="CSR" 
                                score={`${neuroResult.metrics.csr.toFixed(1)}%`} 
                                colorClass="text-emerald-400" 
                                subText="Constraint Sat."
                                description="Constraint Satisfaction Rate: The % of generated segments that passed the Logic Verifier on the first try. Measures control efficiency."
                            />
                            <ScoreCard 
                                label="Self-BLEU" 
                                score={neuroResult.metrics.selfBleu} 
                                colorClass={neuroResult.metrics.selfBleu < 0.4 ? "text-emerald-400" : "text-amber-400"}
                                subText="Diversity (Lower is better)" 
                                description="Diversity Metric (0.0-1.0). Measures n-gram overlap with itself. LOWER is BETTER. High scores indicate repetitive looping."
                            />
                            <ScoreCard 
                                label="Vocab" 
                                score={neuroResult.metrics.uniqueNGrams} 
                                colorClass="text-slate-300"
                                subText="Unique 3-grams" 
                                description="Vocabulary Richness: The count of unique 3-word combinations used. Higher generally indicates better descriptive prose."
                            />
                         </div>
                    </div>
                )}

                <div className="bg-indigo-900/20 p-3 rounded border border-indigo-500/20">
                    <p className="text-xs text-indigo-200/80 italic leading-relaxed">
                        "{neuroResult.critique}"
                    </p>
                </div>
            </div>
        )}

        {/* Vanilla Results */}
        {vanillaResult && (
             <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 text-amber-300 font-semibold border-b border-amber-500/30 pb-2">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} />
                        <span>Vanilla Baseline</span>
                    </div>
                    <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">Control</span>
                </div>
                 
                 <div className="grid grid-cols-3 gap-2">
                     <ScoreCard 
                        label="Coherence" 
                        score={`${vanillaResult.coherenceScore}/10`} 
                        colorClass="text-amber-400" 
                        description="Global logical consistency score (1-10) for the Vanilla model."
                     />
                     <ScoreCard 
                        label="Creativity" 
                        score={`${vanillaResult.creativityScore}/10`} 
                        colorClass="text-pink-400" 
                        description="Novelty score (1-10) for the Vanilla model."
                     />
                     <ScoreCard 
                        label="Flow" 
                        score={`${vanillaResult.flowScore}/10`} 
                        colorClass="text-cyan-400" 
                        description="Pacing score (1-10) for the Vanilla model."
                     />
                 </div>

                 {vanillaResult.metrics && (
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-amber-500/20">
                         <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                             <Activity size={12} /> RESEARCH METRICS
                         </h4>
                         <div className="grid grid-cols-3 gap-2">
                            <ScoreCard 
                                label="CSR" 
                                score="N/A" 
                                colorClass="text-slate-600" 
                                subText="Unconstrained"
                                description="Not Applicable: Vanilla models do not have symbolic constraints to satisfy."
                            />
                            <ScoreCard 
                                label="Self-BLEU" 
                                score={vanillaResult.metrics.selfBleu} 
                                colorClass="text-slate-400"
                                subText="Diversity" 
                                description="Diversity Metric (0.0-1.0). Lower is better. Measures how repetitive the baseline story is."
                            />
                            <ScoreCard 
                                label="Vocab" 
                                score={vanillaResult.metrics.uniqueNGrams} 
                                colorClass="text-slate-300"
                                subText="Unique 3-grams" 
                                description="Vocabulary Richness: The count of unique 3-word combinations used."
                            />
                         </div>
                    </div>
                )}

                 <div className="bg-amber-900/20 p-3 rounded border border-amber-500/20">
                     <p className="text-xs text-amber-200/80 italic leading-relaxed">
                         "{vanillaResult.critique}"
                     </p>
                 </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationReport;