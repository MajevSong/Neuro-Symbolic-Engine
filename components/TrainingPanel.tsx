import React, { useRef, useState } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, Loader2, BarChart2, Brain, Zap } from 'lucide-react';
import { DatasetStats } from '../types';

interface TrainingPanelProps {
  onFileUpload: (file: File) => Promise<void>;
  isTraining: boolean;
  trainingProgress: number;
  trainingStatus: string;
  datasetStats: DatasetStats | null;
}

const TrainingPanel: React.FC<TrainingPanelProps> = ({ 
  onFileUpload, 
  isTraining, 
  trainingProgress, 
  trainingStatus,
  datasetStats 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      setError("Please upload a .json file.");
      return;
    }

    setError(null);
    try {
      await onFileUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown training error");
    }
  };

  // Helper to find percentage for stats visualization
  const getPercentage = (count: number, total: number) => {
      return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  const renderStats = () => {
      if (!datasetStats) return null;
      // Explicitly cast Object.values result to number[] to avoid 'unknown' type issues in strict mode
      const totalEvents = (Object.values(datasetStats.distribution) as number[]).reduce((a, b) => a + b, 0);
      
      const topEvents = (Object.entries(datasetStats.distribution) as [string, number][])
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4); // Show top 4 detected events

      return (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {topEvents.map(([type, count]) => (
                  <div key={type} className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase truncate">{type}</div>
                      <div className="text-sm font-bold text-indigo-300">
                          {getPercentage(count, totalEvents)}% <span className="text-[10px] font-normal text-slate-500">({count})</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 mt-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full" style={{ width: `${getPercentage(count, totalEvents)}%` }}></div>
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="text-pink-400" size={24} />
            Neuro-Symbolic Training
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-xs font-mono">
                Powered by Local Mistral Small (24B)
            </p>
            <span className="flex items-center gap-1 text-[10px] bg-slate-700/50 text-amber-400 px-1.5 py-0.5 rounded border border-slate-600/50 border-amber-500/30">
                <Zap size={10} />
                RTX Accelerated
            </span>
          </div>
        </div>
        {datasetStats && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded text-emerald-400 text-xs font-mono flex items-center gap-2">
                <CheckCircle size={12} />
                Learned from {datasetStats.count} stories
            </div>
        )}
      </div>

      <div className="relative group">
        {!isTraining && !datasetStats && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 hover:border-pink-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-900/50 hover:bg-slate-800"
          >
            <Upload className="mx-auto h-10 w-10 text-slate-500 group-hover:text-pink-400 transition-colors mb-3" />
            <p className="text-sm text-slate-300 font-medium">Load 'stories.json' Dataset</p>
            <p className="text-xs text-slate-500 mt-1">
                Will analyze via local Ollama (mistral-small:24b). Ensure Ollama is running.
            </p>
          </div>
        )}

        {isTraining && (
            <div className="border border-slate-700 bg-slate-900 rounded-lg p-6 text-center">
                 <div className="flex justify-center mb-4">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                 </div>
                 <h3 className="text-slate-200 font-bold mb-1">Training on Local GPU...</h3>
                 <p className="text-xs text-slate-400 font-mono mb-4">{trainingStatus}</p>
                 
                 <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                    <div 
                        className="bg-pink-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${trainingProgress}%` }}
                    />
                 </div>
            </div>
        )}

        {datasetStats && !isTraining && (
           <div>
               <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart2 size={16} className="text-indigo-400"/>
                        <span className="text-xs font-bold text-slate-300 uppercase">Mistral Classification Stats</span>
                    </div>
                    {renderStats()}
               </div>

               <div className="flex gap-2">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-3 rounded border border-slate-600 transition-colors"
                   >
                       Retrain New Dataset
                   </button>
               </div>
           </div>
        )}

        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".json,application/json"
        />
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 rounded border border-red-400/20">
            <AlertCircle size={14} />
            {error}
        </div>
      )}
    </div>
  );
};

export default TrainingPanel;