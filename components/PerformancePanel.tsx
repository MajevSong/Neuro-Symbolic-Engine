import React from 'react';
import { GenerationStep, EvaluationResult } from '../types';
import { Zap, FileText, Fingerprint, ShieldCheck, Hash } from 'lucide-react';
import { calculateSelfBleuProxy } from '../services/geminiService';

interface PerformancePanelProps {
  steps: GenerationStep[];
  evaluation: EvaluationResult | null;
}

interface MiniMetricProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    unit?: string;
}

const MiniMetric: React.FC<MiniMetricProps> = ({ label, value, icon: Icon, color, unit }) => (
    <div className="flex items-center gap-3 px-4 border-r border-slate-700/50 last:border-0 hover:bg-slate-800/50 transition-colors h-full">
        <div className={`p-1.5 rounded bg-slate-800 border border-slate-700 ${color}`}>
            <Icon size={14} />
        </div>
        <div className="flex flex-col justify-center">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider leading-tight">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className="text-sm font-mono font-bold text-slate-200 leading-none">{value}</span>
                {unit && <span className="text-[9px] text-slate-500 font-medium">{unit}</span>}
            </div>
        </div>
    </div>
);

const PerformancePanel: React.FC<PerformancePanelProps> = ({ steps, evaluation }) => {
  // Live Calcs
  const csr = steps.length > 0
    ? ((steps.filter(s => s.retryCount === 0).length / steps.length) * 100).toFixed(0)
    : '--';

  const fullText = steps.map(s => s.generatedText).join(' ');
  const selfBleuStats = fullText.length > 20 ? calculateSelfBleuProxy(fullText) : { selfBleu: 0, uniqueNGrams: 0 };
  const displaySelfBleu = fullText.length > 50 ? selfBleuStats.selfBleu.toFixed(2) : '--';
  const totalWords = steps.reduce((acc, step) => acc + step.generatedText.split(/\s+/).length, 0);
  
  // Aggregate Score
  const score = evaluation ? ((evaluation.coherenceScore + evaluation.creativityScore + evaluation.flowScore)/3).toFixed(1) : '--';

  return (
    <div className="w-full h-full flex items-center justify-between">
       <div className="flex items-center h-full py-2">
            <MiniMetric label="CSR Adherence" value={csr} unit="%" icon={ShieldCheck} color="text-emerald-400" />
            <MiniMetric label="Diversity (S-BLEU)" value={displaySelfBleu} icon={Fingerprint} color="text-amber-400" />
            <MiniMetric label="Vocabulary" value={selfBleuStats.uniqueNGrams} unit="3-grams" icon={Hash} color="text-pink-400" />
            <MiniMetric label="Volume" value={totalWords} unit="words" icon={FileText} color="text-blue-400" />
       </div>
       
       <div className="flex items-center gap-4 pl-4 border-l border-slate-700 h-10">
           <div className="flex items-center gap-3 bg-indigo-500/10 py-1.5 px-4 rounded-lg border border-indigo-500/20 shadow-inner">
                <Zap size={14} className="text-indigo-400 fill-indigo-400/20" />
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-indigo-300/70 font-bold uppercase tracking-widest">AI Judge</span>
                    <span className="text-lg font-mono font-bold text-white leading-none">{score}<span className="text-xs text-indigo-400/50 ml-1">/10</span></span>
                </div>
           </div>
       </div>
    </div>
  );
};

export default PerformancePanel;