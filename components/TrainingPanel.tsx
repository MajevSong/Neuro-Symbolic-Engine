import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, BarChart2, Brain, Zap, FileText, Save, GitMerge, ArrowRight, Waypoints } from 'lucide-react';
import { DatasetStats, SavedModel, TrajectoryModel, DiscoveredPath } from '../types';

interface TrainingPanelProps {
  onFileUpload: (file: File) => Promise<void>;
  isTraining: boolean;
  trainingProgress: number;
  trainingStatus: string;
  datasetStats: DatasetStats | null;
  trajectory: TrajectoryModel; 
  activeArchetype?: DiscoveredPath | null;
  setActiveArchetype?: (path: DiscoveredPath | null) => void;
}

const TrainingPanel: React.FC<TrainingPanelProps> = ({ 
  onFileUpload, 
  isTraining, 
  trainingProgress, 
  trainingStatus,
  datasetStats,
  trajectory,
  activeArchetype,
  setActiveArchetype
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
      if (!datasetStats || !trajectory) return;

      const savedModel: SavedModel = {
          type: 'neuro-symbolic-model',
          version: '2.0',
          timestamp: new Date().toISOString(),
          trajectory: trajectory,
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

  const renderStats = () => {
      if (!datasetStats) return null;
      const totalEvents = (Object.values(datasetStats.distribution) as number[]).reduce((a, b) => a + b, 0);
      
      const topEvents = (Object.entries(datasetStats.distribution) as [string, number][])
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4); 

      return (
          <div className="mt-4">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {topEvents.map(([type, count]) => (
                        <div key={type} className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                            <div className="text-[10px] text-slate-400 uppercase truncate">{type}</div>
                            <div className="text-sm font-bold text-indigo-300">
                                {totalEvents > 0 ? Math.round((count/totalEvents)*100) : 0}% <span className="text-[10px] font-normal text-slate-500">({count})</span>
                            </div>
                        </div>
                    ))}
               </div>
          </div>
      );
  };

  const renderArchetypes = () => {
      if (!datasetStats?.discoveredPaths || !setActiveArchetype) return null;

      return (
          <div className="mt-6 bg-slate-900/50 p-3 rounded-lg border border-indigo-500/20">
              <h4 className="text-xs font-bold text-indigo-300 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <Waypoints size={14} /> Discovered Narrative Archetypes
              </h4>
              <p className="text-[10px] text-slate-500 mb-3">
                  The sequence miner found {datasetStats.discoveredPaths.length} distinct recurring plot structures. 
                  Select one to force the engine to follow this exact learned path.
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {/* Default Dynamic Option */}
                  <div 
                    onClick={() => setActiveArchetype(null)}
                    className={`p-2 rounded border cursor-pointer transition-all flex items-center justify-between group ${
                        activeArchetype === null 
                        ? 'bg-indigo-600 border-indigo-500 shadow-md' 
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                      <div>
                          <div className={`text-xs font-bold ${activeArchetype === null ? 'text-white' : 'text-slate-300'}`}>Dynamic Markov Chain (Probabilistic)</div>
                          <div className={`text-[10px] ${activeArchetype === null ? 'text-indigo-200' : 'text-slate-500'}`}>
                              Uses the trained probability matrices to generate unique paths (Default)
                          </div>
                      </div>
                      {activeArchetype === null && <CheckCircle size={14} className="text-white"/>}
                  </div>

                  {/* Learned Paths */}
                  {datasetStats.discoveredPaths.slice(0, 5).map((path) => (
                      <div 
                        key={path.id}
                        onClick={() => setActiveArchetype(path)}
                        className={`p-2 rounded border cursor-pointer transition-all flex flex-col gap-2 group ${
                            activeArchetype?.id === path.id 
                            ? 'bg-emerald-900/30 border-emerald-500/50 shadow-md' 
                            : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                          <div className="flex items-center justify-between">
                                <div>
                                    <div className={`text-xs font-bold ${activeArchetype?.id === path.id ? 'text-emerald-300' : 'text-slate-300'}`}>
                                        {path.name}
                                    </div>
                                    <div className="text-[9px] text-slate-500 font-mono">
                                        Frequency: {path.frequency} stories
                                    </div>
                                </div>
                                {activeArchetype?.id === path.id && <CheckCircle size={14} className="text-emerald-400"/>}
                          </div>
                          
                          {/* Visual Path Preview */}
                          <div className="flex items-center gap-0.5 opacity-60">
                              {path.sequence.slice(0, 8).map((evt, idx) => (
                                  <div key={idx} className="w-1.5 h-1.5 rounded-full" 
                                    style={{ backgroundColor: evt.includes('Conflict') ? '#f87171' : (evt.includes('Introduction') ? '#60a5fa' : '#94a3b8') }}
                                    title={evt}
                                  />
                              ))}
                              {path.sequence.length > 8 && <span className="text-[8px] text-slate-600">+</span>}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const getStatusIcon = (status: string) => {
      if (status.includes("Reading")) return <FileText size={16} className="text-blue-400 animate-pulse" />;
      if (status.includes("Extracting")) return <Brain size={16} className="text-pink-400 animate-pulse" />;
      if (status.includes("Synthesizing")) return <BarChart2 size={16} className="text-emerald-400 animate-pulse" />;
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
                Mined {datasetStats.count} stories
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
            <p className="text-sm text-slate-300 font-medium">Load Dataset to Mine Patterns</p>
            <p className="text-xs text-slate-500 mt-1">
                Upload <code>stories.json</code>. The engine will discover narrative structures.
            </p>
          </div>
        )}

        {isTraining && (
            <div className="border border-slate-700 bg-slate-900 rounded-lg p-6 text-center">
                 <div className="flex justify-center mb-4">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                 </div>
                 <h3 className="text-slate-200 font-bold mb-3">Mining Sequence Patterns...</h3>
                 
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
                    <div className="flex items-center justify-between mb-2 border-b border-slate-700 pb-2">
                         <div className="flex items-center gap-2">
                            <BarChart2 size={16} className="text-indigo-400"/>
                            <span className="text-xs font-bold text-slate-300 uppercase">Analysis Results</span>
                         </div>
                         {trajectory && (
                            <button 
                                onClick={handleSaveModel}
                                className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 transition-colors"
                            >
                                <Save size={10} /> Save Model
                            </button>
                         )}
                    </div>
                    {renderStats()}
                    {renderArchetypes()} 
               </div>

               <div className="flex gap-2">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-3 rounded border border-slate-600 transition-colors"
                   >
                       Load Different Dataset
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