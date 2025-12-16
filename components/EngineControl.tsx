import React from 'react';
import { Play, RotateCcw, Activity, Power, Sparkles, Cloud, Server } from 'lucide-react';
import { ModelProvider } from '../types';

interface EngineControlProps {
  isRunning: boolean;
  progress: number;
  totalSteps: number;
  onStart: () => void;
  onReset: () => void;
  onRunVanilla: () => void;
  statusMessage: string;
  isVanillaLoading: boolean;
  provider: ModelProvider;
  setProvider: (p: ModelProvider) => void;
}

const EngineControl: React.FC<EngineControlProps> = ({
  isRunning,
  progress,
  totalSteps,
  onStart,
  onReset,
  onRunVanilla,
  statusMessage,
  isVanillaLoading,
  provider,
  setProvider
}) => {
  const progressPercent = (progress / totalSteps) * 100;
  const isComplete = progress === totalSteps;
  const isBusy = isRunning || isVanillaLoading;
  const isError = statusMessage.startsWith("Error") || statusMessage.includes("Connection Failed");

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 shadow-lg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="text-indigo-400" size={24} />
            Control Unit
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-mono">
            STATUS: {isBusy ? 'ACTIVE' : (isComplete ? 'COMPLETED' : 'STANDBY')}
          </p>
        </div>
        
        {/* Reset Button */}
        {(isBusy || progress > 0) && (
            <button
              onClick={onReset}
              disabled={isBusy}
              className={`flex items-center gap-2 text-xs border border-slate-600 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 transition-colors ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RotateCcw size={14} />
              Reset System
            </button>
        )}
      </div>

      {/* Model Provider Selector */}
      {!isBusy && progress === 0 && (
        <div className="mb-6 p-1 bg-slate-900 rounded-lg flex border border-slate-700">
           <button 
             onClick={() => setProvider('gemini')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${provider === 'gemini' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Cloud size={14} />
             Gemini Flash
           </button>
           <button 
             onClick={() => setProvider('ollama')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${provider === 'ollama' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Server size={14} />
             Local Ollama
           </button>
        </div>
      )}

      {/* Main Action Area */}
      {!isRunning && progress === 0 ? (
        <div className="flex flex-col gap-3">
            <button
            onClick={onStart}
            disabled={isBusy}
            className={`w-full group relative flex flex-col items-center justify-center gap-3 bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-500/50 hover:border-indigo-400 text-indigo-100 py-6 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <div className="p-3 bg-indigo-600 rounded-full group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/50">
                <Power size={24} className="text-white" />
            </div>
            <div className="text-center">
                <span className="block text-lg font-bold">Initialize Story Engine</span>
                <span className="text-xs text-indigo-300/70">
                    {provider === 'ollama' ? 'Using Local Mistral Small 24B' : 'Using Gemini 2.5 Flash'}
                </span>
            </div>
            </button>
            
            <button
                onClick={onRunVanilla}
                disabled={isBusy}
                className={`w-full flex items-center justify-center gap-2 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 text-slate-300 py-3 rounded-lg transition-colors text-sm font-medium ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <Sparkles size={16} className="text-amber-400" />
                Run Vanilla Baseline Comparison
            </button>
        </div>
      ) : (
        <div className="space-y-4">
            {/* Progress Bar */}
            <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-semibold inline-block py-1 px-2 uppercase rounded-full bg-slate-700">
                            {isVanillaLoading ? "Baseline Generation" : "Neuro-Symbolic Generation"}
                        </span>
                        <span className="text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded uppercase">
                            {provider}
                        </span>
                    </div>
                    {!isVanillaLoading && (
                        <span className="text-right text-indigo-300 font-bold font-mono">
                            {Math.round(progressPercent)}%
                        </span>
                    )}
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-900 border border-slate-700">
                    <div style={{ width: isVanillaLoading ? '100%' : `${progressPercent}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ease-out ${isVanillaLoading ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500'}`}></div>
                </div>
            </div>
            
            {/* Status Log Console */}
            <div className={`p-3 bg-black/40 rounded border font-mono text-xs min-h-[48px] flex items-center shadow-inner ${isError ? 'border-red-500/50 text-red-200' : 'border-slate-700/80 text-slate-300'}`}>
                <span className={`mr-2 shrink-0 ${isError ? 'text-red-500' : 'text-indigo-500'}`}>{'>'}</span>
                <span className="whitespace-pre-wrap leading-relaxed break-words">{statusMessage}</span>
                {isBusy && !isError && <span className="animate-pulse ml-1 w-1.5 h-3 bg-indigo-500 inline-block align-middle"/>}
            </div>
        </div>
      )}
    </div>
  );
};

export default EngineControl;