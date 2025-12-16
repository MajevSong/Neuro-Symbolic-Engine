import React from 'react';
import { GenerationStep, EvaluationResult } from '../types';
import { Zap, Brain, FileText, AlertOctagon, Info, ShieldCheck, Fingerprint, Hash } from 'lucide-react';
import { calculateSelfBleuProxy } from '../services/geminiService';

interface PerformancePanelProps {
  steps: GenerationStep[];
  evaluation: EvaluationResult | null;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  iconColor: string;
  tooltip: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, icon: Icon, iconColor, tooltip }) => (
  <div className="group relative bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between transition-all hover:border-slate-600">
    <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 cursor-help">
      <Icon size={12} className={iconColor} />
      <span>{label}</span>
      <Info size={10} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
    </div>
    
    <div className="text-xl font-mono text-slate-100 font-bold">
      {value}<span className="text-sm text-slate-500">{unit}</span>
    </div>

    {/* Tooltip */}
    <div className="absolute z-20 top-full left-0 mt-2 w-48 p-2 bg-black/90 text-slate-200 text-xs rounded border border-slate-600 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
        {tooltip}
    </div>
  </div>
);

const PerformancePanel: React.FC<PerformancePanelProps> = ({ steps, evaluation }) => {
  // Calculate live metrics
  const avgConfidence = steps.length > 0
    ? (steps.reduce((acc, step) => acc + step.verificationScore, 0) / steps.length * 100).toFixed(0)
    : '--';
    
  const totalRetries = steps.reduce((acc, step) => acc + step.retryCount, 0);
  const totalWords = steps.reduce((acc, step) => acc + step.generatedText.split(/\s+/).length, 0);

  // CSR: Percentage of steps generated with 0 retries (Passed 1st try)
  const csr = steps.length > 0
    ? ((steps.filter(s => s.retryCount === 0).length / steps.length) * 100).toFixed(1)
    : '--';

  // Self-BLEU & Vocab Calculation
  const fullText = steps.map(s => s.generatedText).join(' ');
  const selfBleuStats = fullText.length > 20 ? calculateSelfBleuProxy(fullText) : { selfBleu: 0, uniqueNGrams: 0 };
  const displaySelfBleu = fullText.length > 50 ? selfBleuStats.selfBleu.toFixed(2) : '--';
  const displayVocab = fullText.length > 50 ? selfBleuStats.uniqueNGrams : '--';

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 relative">
      <MetricCard 
        label="NLI Confidence" 
        value={avgConfidence} 
        unit="%" 
        icon={Brain} 
        iconColor="text-emerald-400"
        tooltip="Natural Language Inference Score. Measures the probability that the generated text logically entails the required Event Type."
      />

      <MetricCard 
        label="CSR (Adherence)" 
        value={csr} 
        unit="%" 
        icon={ShieldCheck} 
        iconColor="text-cyan-400"
        tooltip="Constraint Satisfaction Rate. The percentage of generated segments that passed the Logic Verifier on the first try (Zero-Shot)."
      />

      <MetricCard 
        label="Logic Interventions" 
        value={totalRetries} 
        icon={AlertOctagon} 
        iconColor="text-amber-400"
        tooltip="Number of times System 2 (Neural) was rejected by System 1 (Symbolic) because it failed to meet the plot constraints."
      />

      <MetricCard 
        label="Diversity (S-BLEU)" 
        value={displaySelfBleu} 
        unit=""
        icon={Fingerprint} 
        iconColor={typeof displaySelfBleu === 'string' || Number(displaySelfBleu) < 0.4 ? "text-emerald-400" : "text-amber-400"}
        tooltip="Self-BLEU Score (0.0-1.0). Lower is better. Measures lexical diversity based on n-gram overlap. High scores indicate repetitive loops."
      />

      <MetricCard 
        label="Unique 3-grams" 
        value={displayVocab} 
        unit="" 
        icon={Hash} 
        iconColor="text-indigo-400"
        tooltip="Vocabulary Richness. Count of unique 3-word combinations found in the generated story so far."
      />

      <MetricCard 
        label="Total Output" 
        value={totalWords} 
        unit=" words" 
        icon={FileText} 
        iconColor="text-blue-400"
        tooltip="Cumulative volume of the narrative generated so far. Higher volume with high coherence indicates successful long-context handling."
      />

      {/* Metric: AI Judge Score (Preview) */}
      <div className="col-span-2 bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 z-10">
          <Zap size={12} className="text-purple-400" />
          <span>Final Quality Estimate</span>
          <Info size={10} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
        <div className="text-xl font-mono text-slate-100 font-bold z-10">
          {evaluation ? ((evaluation.coherenceScore + evaluation.creativityScore + evaluation.flowScore)/3).toFixed(1) : '--'}
        </div>
        {!evaluation && <div className="absolute inset-0 bg-slate-800/50 z-0"></div>}
        
        <div className="absolute z-20 top-full left-0 mt-2 w-48 p-2 bg-black/90 text-slate-200 text-xs rounded border border-slate-600 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            Aggregate score (1-10) based on Coherence, Creativity, and Narrative Flow assessed by the AI Critic.
        </div>
      </div>
    </div>
  );
};

export default PerformancePanel;