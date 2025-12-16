import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, BarChart2, Brain, Zap, FileText, Save } from 'lucide-react';
import { DatasetStats, SavedModel, TimeSlicedMatrices } from '../types';

interface TrainingPanelProps {
  onFileUpload: (file: File) => Promise<void>;
  isTraining: boolean;
  trainingProgress: number;
  trainingStatus: string;
  datasetStats: DatasetStats | null;
  matrices: TimeSlicedMatrices;
}

const TrainingPanel: React.FC<TrainingPanelProps> = ({ 
  onFileUpload, 
  isTraining, 
  trainingProgress, 
  trainingStatus,
  datasetStats,
  matrices
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

  const handleSaveModel = () => {
      if (!datasetStats || !matrices) return;

      const savedModel: SavedModel = {
          type: 'neuro-symbolic-model',
          version: '1.0',
          timestamp: new Date().toISOString(),
          matrices: matrices,
          stats: datasetStats
      };

      const blob = new Blob([JSON.stringify(savedModel, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuro_symbolic_model_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  // Helper to determine status icon
  const getStatusIcon = (status: string) => {
      if (status.includes("Reading")) return <FileText size={16} className="text-blue-400 animate-pulse" />;
      if (status.includes("Analyzing")) return <Brain size={16} className="text-pink-400 animate-pulse" />;
      if (status.includes("Calculating")) return <BarChart2 size={16} className="text-emerald-400 animate-pulse" />;
      return <Loader2 size={16} className="text-slate-400 animate-spin" />;
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
            <p className="text-sm text-slate-300 font-medium">Load Dataset or Saved Model</p>
            <p className="text-xs text-slate-500 mt-1">
                Upload <code>stories.json</code> to train OR a <code>model.json</code> to load instantly.
            </p>
          </div>
        )}

        {isTraining && (
            <div className="border border-slate-700 bg-slate-900 rounded-lg p-6 text-center">
                 <div className="flex justify-center mb-4">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                 </div>
                 <h3 className="text-slate-200 font-bold mb-3">Training on Local GPU...</h3>
                 
                 {/* Enhanced Status Message */}
                 <div className="bg-slate-800/80 rounded-lg p-3 mb-4 border border-slate-700/50 inline-flex items-center gap-3 px-6 mx-auto shadow-inner">
                     {getStatusIcon(trainingStatus)}
                     <p className="text-sm text-indigo-300 font-mono font-medium">
                        {trainingStatus}
                     </p>
                 </div>
                 
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
                    <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                            <BarChart2 size={16} className="text-indigo-400"/>
                            <span className="text-xs font-bold text-slate-300 uppercase">Training Stats</span>
                         </div>
                         {matrices && (
                            <button 
                                onClick={handleSaveModel}
                                className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 transition-colors"
                            >
                                <Save size={10} /> Save Model
                            </button>
                         )}
                    </div>
                    {renderStats()}
               </div>

               <div className="flex gap-2">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-3 rounded border border-slate-600 transition-colors"
                   >
                       Load Different Dataset / Model
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