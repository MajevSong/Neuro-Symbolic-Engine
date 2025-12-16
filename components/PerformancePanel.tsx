import React from 'react';
import { GenerationStep, EvaluationResult } from '../types';
import { Zap, Brain, FileText, AlertOctagon, Info } from 'lucide-react';

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
        label="Total Output" 
        value={totalWords} 
        unit=" words" 
        icon={FileText} 
        iconColor="text-blue-400"
        tooltip="Cumulative volume of the narrative generated so far. Higher volume with high coherence indicates successful long-context handling."
      />

      <MetricCard 
        label="Logic Interventions" 
        value={totalRetries} 
        icon={AlertOctagon} 
        iconColor="text-amber-400"
        tooltip="Number of times System 2 (Neural) was rejected by System 1 (Symbolic) because it failed to meet the plot constraints."
      />

      {/* Metric 4: AI Judge Score (Preview) */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 z-10">
          <Zap size={12} className="text-purple-400" />
          <span>Final Quality</span>
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