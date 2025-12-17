import React, { useState, useRef, useEffect } from 'react';
import { EventType, GenerationStep, TrajectoryModel, EvaluationResult, ModelProvider, DatasetStats, SavedModel, TransitionMatrix, DiscoveredPath } from './types';
import { DEFAULT_TRAJECTORY, getMatrixForStep, GLOBAL_CONSTRAINTS } from './constants';
import { generateStorySegment, verifySegment, evaluateStory, generateVanillaStory } from './services/geminiService';
import { trainModelFromDataset } from './services/trainingService';
import EngineControl from './components/EngineControl';
import PerformancePanel from './components/PerformancePanel';
import StoryTimeline from './components/StoryTimeline';
import MatrixVisualizer from './components/MatrixVisualizer';
import EvaluationReport from './components/EvaluationReport';
import TrainingPanel from './components/TrainingPanel';
import ComparisonCharts from './components/ComparisonCharts';
import { Layout, X, Database, Binary, Brain, ArrowRight, ShieldCheck, FileText, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [isRunning, setIsRunning] = useState(false);
  const [isVanillaLoading, setIsVanillaLoading] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  
  // Dynamic Story Length
  const [storyLength, setStoryLength] = useState<number>(15);
  
  // Trajectory & Archetypes
  const [trajectory, setTrajectory] = useState<TrajectoryModel>(DEFAULT_TRAJECTORY);
  const [activeArchetype, setActiveArchetype] = useState<DiscoveredPath | null>(null); // NEW: User's selected Golden Path
  
  const [currentEvent, setCurrentEvent] = useState<EventType>(EventType.Introduction);
  const [statusMessage, setStatusMessage] = useState("System Idle. Ready.");
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [provider, setProvider] = useState<ModelProvider>('gemini');
  
  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState("");
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);

  // Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Vanilla / Baseline State
  const [vanillaStory, setVanillaStory] = useState<string | null>(null);
  const [vanillaPrompt, setVanillaPrompt] = useState<string | null>(null);
  const [vanillaEvaluation, setVanillaEvaluation] = useState<EvaluationResult | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [steps, statusMessage]);

  // --- Logic Selection ---
  const selectNextEvent = (
    stepIndex: number, 
    prevEvent: EventType, 
    trajectory: TrajectoryModel,
    totalLength: number,
    history: GenerationStep[]
  ): EventType => {
    
    // PRIORITY 1: ARCHETYPE MODE (The "Golden Path" Strategy)
    // If user selected a discovered path, we follow it STRICTLY.
    if (activeArchetype) {
        // If the path is shorter/longer than current length, handle gracefully
        if (activeArchetype.sequence[stepIndex]) {
            return activeArchetype.sequence[stepIndex];
        }
        // Fallback if story is longer than path: Use standard matrix logic
    }

    // PRIORITY 2: MARKOV MODE (Dynamic)
    const matrix = getMatrixForStep(stepIndex, totalLength, trajectory);
    const transitionRow = matrix[prevEvent];
    let entries = Object.entries(transitionRow) as [EventType, number][];
    const progress = stepIndex / totalLength;

    entries = entries.map(([event, prob]) => {
        let modifiedProb = prob;
        const constraints = GLOBAL_CONSTRAINTS[event];

        if (constraints) {
            if (constraints.requiresEvent) {
                const hasRequirement = history.some(s => s.selectedEvent === constraints.requiresEvent);
                if (!hasRequirement) modifiedProb = 0;
            }
            if (constraints.maxOccurrences !== undefined) {
                const count = history.filter(s => s.selectedEvent === event).length;
                if (count >= constraints.maxOccurrences) modifiedProb = 0; 
            }
            if (constraints.minStepProgress !== undefined) {
                if (progress < constraints.minStepProgress) modifiedProb = 0;
            }
            if (constraints.cooldown !== undefined) {
                const lastOccurrenceIndex = [...history].reverse().findIndex(s => s.selectedEvent === event);
                if (lastOccurrenceIndex !== -1 && lastOccurrenceIndex < constraints.cooldown) {
                    modifiedProb *= 0.1; 
                }
            }
        }
        if (event === prevEvent) modifiedProb *= 0.3; 
        return [event, modifiedProb];
    });

    const totalWeight = entries.reduce((sum, [, prob]) => sum + prob, 0);
    
    if (totalWeight <= 0.0001) {
        const fallback = entries.find(([, p]) => p > 0);
        return fallback ? fallback[0] : EventType.Rising_Action;
    }

    const normalizedEntries = entries.map(([event, prob]) => [event, prob / totalWeight] as [EventType, number]);
    const r = Math.random();
    let cumulative = 0;
    for (const [event, prob] of normalizedEntries) {
      cumulative += prob;
      if (r <= cumulative) return event;
    }
    return normalizedEntries[normalizedEntries.length - 1][0];
  };

  const getMostLikelyNextEvent = (
      stepIndex: number,
      currentEvent: EventType,
      trajectory: TrajectoryModel,
      totalLength: number
  ): EventType | undefined => {
      // If Archetype active, look ahead in array
      if (activeArchetype) {
          return activeArchetype.sequence[stepIndex + 1];
      }
      
      if (stepIndex >= totalLength - 1) return undefined;
      const matrix = getMatrixForStep(stepIndex + 1, totalLength, trajectory);
      const transitionRow = matrix[currentEvent];
      let maxProb = -1;
      let likelyEvent: EventType | undefined = undefined;
      Object.entries(transitionRow).forEach(([evt, prob]) => {
          if (prob > maxProb) {
              maxProb = prob;
              likelyEvent = evt as EventType;
          }
      });
      return likelyEvent;
  };

  const handleFileUpload = async (file: File) => {
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingStatus("Inspecting file...");

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const json = JSON.parse(text);

            if (json.type === 'neuro-symbolic-model' && json.trajectory && json.stats) {
                 setTrainingProgress(100);
                 setTrainingStatus("Restoring saved model state...");
                 await new Promise(r => setTimeout(r, 500));
                 
                 const savedModel = json as SavedModel;
                 setTrajectory(savedModel.trajectory);
                 setDatasetStats(savedModel.stats);
                 setStatusMessage(`Model Loaded: Version ${savedModel.version}.`);
                 setIsTraining(false);
                 return;
            }

            if (Array.isArray(json) || (typeof json === 'object' && !json.trajectory)) {
                 await runTrainingProcess(file);
            } else {
                 throw new Error("Unknown file format.");
            }

        } catch (err) {
            console.error(err);
            setStatusMessage("File Error: " + (err instanceof Error ? err.message : String(err)));
            setIsTraining(false);
        }
    };
    reader.readAsText(file);
  };

  const runTrainingProcess = async (file: File) => {
    try {
        const result = await trainModelFromDataset(file, (percent, msg) => {
            setTrainingProgress(percent);
            setTrainingStatus(msg);
        });
        setTrajectory(result.trajectory);
        setDatasetStats(result.stats);
        setStatusMessage(`Training complete. Mined ${result.stats.discoveredPaths.length} unique narrative archetypes.`);
    } catch (e) {
        console.error(e);
        setStatusMessage("Training failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
        setIsTraining(false);
    }
  };

  const runComparisonProtocol = async () => {
      setSteps([]);
      setEvaluationResult(null);
      setVanillaStory(null);
      setVanillaPrompt(null);
      setVanillaEvaluation(null);
      setCurrentEvent(EventType.Introduction);
      abortControllerRef.current = new AbortController();

      runVanillaLoop(abortControllerRef.current.signal);
      await runNeuroLoop(abortControllerRef.current.signal);
  };

  const runNeuroLoop = async (signal: AbortSignal) => {
    setIsRunning(true);
    let previousEvent = EventType.Introduction;
    let storyContext = "";
    const generatedSteps: GenerationStep[] = [];

    try {
      for (let step = 0; step < storyLength; step++) {
        if (signal.aborted) break;

        setStatusMessage(activeArchetype 
            ? `Sys1 (Archetype): Following '${activeArchetype.name}' Step ${step+1}...`
            : `Sys1 (Dynamic): Computing Trajectory ${step+1}...`);
        
        await new Promise(r => setTimeout(r, 400));

        let nextEvent: EventType;
        if (step === 0) {
            nextEvent = activeArchetype ? activeArchetype.sequence[0] : EventType.Introduction; 
        } else {
            nextEvent = selectNextEvent(step, previousEvent, trajectory, storyLength, generatedSteps);
        }
        setCurrentEvent(nextEvent);

        const foreshadowEvent = getMostLikelyNextEvent(step, nextEvent, trajectory, storyLength);
        
        setStatusMessage(`Sys2: Generating <${nextEvent}>...`);
        
        let segmentResult = { text: "", promptUsed: "" };
        let verified = false;
        let verificationScore = 0;
        let retryCount = 0;
        const MAX_RETRIES = 2;

        while (!verified && retryCount <= MAX_RETRIES) {
             if (signal.aborted) throw new Error("Aborted");
             segmentResult = await generateStorySegment(storyContext, nextEvent, step, provider, foreshadowEvent);
             
             // If following an archetype, we verify strictly against the plan
             setStatusMessage(`Verifier: Logic Check (${retryCount + 1})...`);
             const check = await verifySegment(segmentResult.text, nextEvent, provider);
             verificationScore = check.confidence;
             verified = check.verified;

             if (!verified) {
                 retryCount++;
                 await new Promise(r => setTimeout(r, 500));
             }
        }

        const newStep: GenerationStep = {
            stepIndex: step,
            selectedEvent: nextEvent,
            generatedText: segmentResult.text,
            promptUsed: segmentResult.promptUsed,
            verificationScore,
            verified,
            retryCount,
            timestamp: Date.now()
        };

        setSteps(prev => [...prev, newStep]);
        generatedSteps.push(newStep);
        storyContext += " " + segmentResult.text;
        previousEvent = nextEvent;
    }

      if (!signal.aborted) {
          setStatusMessage(`Running Final Evaluation...`);
          setIsEvaluating(true);
          const evaluation = await evaluateStory(storyContext, provider, generatedSteps);
          setEvaluationResult(evaluation);
          setIsEvaluating(false);
          setStatusMessage("Protocol Complete.");
      }

    } catch (error) {
       if (error instanceof Error && error.message === "Aborted") {
           setStatusMessage("Execution aborted.");
       } else {
           setStatusMessage(`Error: ${error}`);
       }
       setIsEvaluating(false);
    } finally {
      setIsRunning(false);
    }
  };

  const runVanillaLoop = async (signal: AbortSignal) => {
      setIsVanillaLoading(true);
      try {
        const result = await generateVanillaStory(provider);
        if (signal.aborted) return;
        setVanillaStory(result.text);
        setVanillaPrompt(result.promptUsed);
        
        const evalResult = await evaluateStory(result.text, provider);
        if (signal.aborted) return;
        setVanillaEvaluation(evalResult);
      } catch (error) {
          console.error("Vanilla Error:", error);
      } finally {
          setIsVanillaLoading(false);
      }
  };

  const handleReset = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setSteps([]);
    setEvaluationResult(null);
    setVanillaStory(null);
    setVanillaPrompt(null);
    setVanillaEvaluation(null);
    setIsRunning(false);
    setIsEvaluating(false);
    setIsVanillaLoading(false);
    setStatusMessage("System Reset.");
    setCurrentEvent(EventType.Introduction);
  };

  const liveStepIndex = isRunning ? steps.length : (steps.length > 0 ? steps.length - 1 : 0);
  const boundedStepIndex = Math.min(Math.max(liveStepIndex, 0), storyLength - 1);

  return (
    <div className="flex h-screen w-full bg-[#0b0f19] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* --- LEFT SIDEBAR (Controls) --- */}
      <aside className="w-[400px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#0f172a] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0b0f19]">
            <div>
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Neuro-Symbolic
                </h1>
                <p className="text-[10px] text-slate-500 font-mono tracking-wider">PAPER ID: #8821 | ENGINE</p>
            </div>
            <button onClick={() => setShowArchitecture(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <Layout size={18} />
            </button>
        </div>

        {/* Scrollable Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            
            <EngineControl 
                isRunning={isRunning}
                progress={steps.length}
                totalSteps={storyLength} 
                storyLength={storyLength} 
                setStoryLength={setStoryLength} 
                onStart={runComparisonProtocol}
                onReset={handleReset}
                statusMessage={statusMessage}
                isVanillaLoading={isVanillaLoading}
                provider={provider}
                setProvider={setProvider}
            />

            <TrainingPanel 
                onFileUpload={handleFileUpload}
                isTraining={isTraining}
                trainingProgress={trainingProgress}
                trainingStatus={trainingStatus}
                datasetStats={datasetStats}
                trajectory={trajectory}
                activeArchetype={activeArchetype}
                setActiveArchetype={setActiveArchetype}
            />

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <MatrixVisualizer 
                    trajectory={trajectory} 
                    totalSteps={storyLength}
                    liveStepIndex={boundedStepIndex}
                    steps={steps}
                    activeArchetype={activeArchetype} // Pass down the override state
                />
            </div>

        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-600 text-center font-mono bg-[#0b0f19]">
            v2.4.0 • Archetype Mining Enabled
        </div>
      </aside>


      {/* --- RIGHT MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0b0f19] relative">
          
          <div className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md flex items-center px-6 shadow-sm z-10 shrink-0">
               <PerformancePanel steps={steps} evaluation={evaluationResult} />
          </div>

          <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar" ref={scrollContainerRef}>
              
              <div className="max-w-5xl mx-auto space-y-8 pb-20">
                  {(steps.length > 0 || vanillaEvaluation) && (
                      <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <ComparisonCharts 
                              neuroResult={evaluationResult} 
                              vanillaResult={vanillaEvaluation} 
                              steps={steps}
                              vanillaStory={vanillaStory}
                          />
                      </section>
                  )}

                  <section className="min-h-[300px]">
                      <StoryTimeline 
                          steps={steps} 
                          vanillaStory={vanillaStory} 
                          vanillaPrompt={vanillaPrompt}
                      />
                  </section>

                  <section>
                      <EvaluationReport 
                          neuroResult={evaluationResult} 
                          vanillaResult={vanillaEvaluation}
                          isLoading={isEvaluating || (isVanillaLoading && !vanillaEvaluation)} 
                      />
                  </section>
              </div>

          </div>
      </main>
      
      {/* ... Architecture Modal (Keep existing) ... */}
       {showArchitecture && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowArchitecture(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full p-8 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowArchitecture(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24} /></button>
            
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">
                Hybrid Neuro-Symbolic Architecture (Discovery Mode)
            </h2>
            
            <div className="flex flex-col gap-10">
                <div className="relative flex items-center justify-between p-10 bg-[#0b0f19] rounded-xl border border-slate-800 shadow-inner overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-slate-300 shadow-lg">
                            <Database size={32} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-slate-200">Dataset</div>
                            <div className="text-[10px] text-slate-500 font-mono">1000 Stories</div>
                        </div>
                    </div>

                    <ArrowRight size={24} className="text-slate-600" />

                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-amber-900/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                            <Brain size={40} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-amber-300">Miner</div>
                            <div className="text-[10px] text-amber-400/60 font-mono">Sequence Analysis</div>
                        </div>
                    </div>

                    <ArrowRight size={24} className="text-amber-600" />
                    
                    <div className="relative z-10 flex flex-col items-center gap-3">
                         <div className="w-20 h-20 rounded-2xl bg-indigo-900/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                            <Binary size={40} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-indigo-300">Archetypes</div>
                            <div className="text-[10px] text-indigo-400/60 font-mono">Discovered Paths</div>
                        </div>
                    </div>
                    
                    <ArrowRight size={24} className="text-indigo-600" />

                     <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-slate-100 shadow-lg">
                            <FileText size={32} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-slate-200">Result</div>
                            <div className="text-[10px] text-slate-500 font-mono">Data-Driven Story</div>
                        </div>
                    </div>

                </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default App;