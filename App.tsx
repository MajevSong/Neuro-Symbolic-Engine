import React, { useState, useRef, useEffect } from 'react';
import { EventType, GenerationStep, TimeSlicedMatrices, EvaluationResult, ModelProvider, DatasetStats, SavedModel } from './types';
import { DEFAULT_MATRICES, TOTAL_STEPS } from './constants';
import { generateStorySegment, verifySegment, evaluateStory, generateVanillaStory } from './services/geminiService';
import { trainModelFromDataset } from './services/trainingService';
import EngineControl from './components/EngineControl';
import PerformancePanel from './components/PerformancePanel';
import StoryTimeline from './components/StoryTimeline';
import MatrixVisualizer from './components/MatrixVisualizer';
import EvaluationReport from './components/EvaluationReport';
import TrainingPanel from './components/TrainingPanel';
import ComparisonCharts from './components/ComparisonCharts';
import { Layout, X, Settings, PanelLeft, Database, Binary, Brain, ArrowRight, ShieldCheck, FileText, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [isRunning, setIsRunning] = useState(false);
  const [isVanillaLoading, setIsVanillaLoading] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [matrices, setMatrices] = useState<TimeSlicedMatrices>(DEFAULT_MATRICES);
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

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom effect
  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [steps, statusMessage]);


  // --- Symbolic Logic (Step A) ---
  const selectNextEvent = (
    stepIndex: number, 
    prevEvent: EventType, 
    matrix: TimeSlicedMatrices
  ): EventType => {
    const transitionRow = matrix[stepIndex][prevEvent];
    const entries = Object.entries(transitionRow) as [EventType, number][];
    let weightedEntries = entries.map(([event, prob]) => {
      if (event === prevEvent) return [event, prob * 0.5] as [EventType, number];
      return [event, prob] as [EventType, number];
    });
    const totalWeight = weightedEntries.reduce((sum, [, prob]) => sum + prob, 0);
    weightedEntries = weightedEntries.map(([event, prob]) => [event, prob / totalWeight]);
    const r = Math.random();
    let cumulative = 0;
    for (const [event, prob] of weightedEntries) {
      cumulative += prob;
      if (r <= cumulative) return event;
    }
    return weightedEntries[weightedEntries.length - 1][0];
  };

  const getMostLikelyNextEvent = (
      stepIndex: number,
      currentEvent: EventType,
      matrix: TimeSlicedMatrices
  ): EventType | undefined => {
      if (stepIndex >= TOTAL_STEPS - 1) return undefined;
      const nextStepIndex = stepIndex + 1;
      const transitionRow = matrix[nextStepIndex][currentEvent];
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

  // --- Training & Load Handler ---
  const handleFileUpload = async (file: File) => {
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingStatus("Inspecting file...");

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const json = JSON.parse(text);

            if (json.type === 'neuro-symbolic-model' && json.matrices && json.stats) {
                 setTrainingProgress(100);
                 setTrainingStatus("Restoring saved model state...");
                 await new Promise(r => setTimeout(r, 500));
                 
                 const savedModel = json as SavedModel;
                 setMatrices(savedModel.matrices);
                 setDatasetStats(savedModel.stats);
                 setStatusMessage(`Model Loaded: Version ${savedModel.version}.`);
                 setIsTraining(false);
                 return;
            }

            if (Array.isArray(json) || (typeof json === 'object' && !json.matrices)) {
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
        setMatrices(result.matrices);
        setDatasetStats(result.stats);
        setStatusMessage(`Training complete. Analyzed ${result.stats.count} stories.`);
    } catch (e) {
        console.error(e);
        setStatusMessage("Training failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
        setIsTraining(false);
    }
  };

  // --- EXECUTION PROTOCOL ---
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
      for (let step = 0; step < TOTAL_STEPS; step++) {
        if (signal.aborted) break;

        setStatusMessage(`Sys1: Planning step ${step+1}/${TOTAL_STEPS}...`);
        await new Promise(r => setTimeout(r, 600));

        let nextEvent: EventType;
        if (step === 0) {
            nextEvent = EventType.Introduction; 
        } else {
            nextEvent = selectNextEvent(step, previousEvent, matrices);
        }
        setCurrentEvent(nextEvent);

        const foreshadowEvent = getMostLikelyNextEvent(step, nextEvent, matrices);
        
        setStatusMessage(`Sys2: Generating <${nextEvent}>...`);
        
        let segmentResult = { text: "", promptUsed: "" };
        let verified = false;
        let verificationScore = 0;
        let retryCount = 0;
        const MAX_RETRIES = 2;

        while (!verified && retryCount <= MAX_RETRIES) {
             if (signal.aborted) throw new Error("Aborted");
             segmentResult = await generateStorySegment(storyContext, nextEvent, step, provider, foreshadowEvent);
             
             setStatusMessage(`Verifier: Checking logic constraint (${retryCount + 1})...`);
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

  // Determine current live step for visualization
  const liveStepIndex = isRunning ? steps.length : (steps.length > 0 ? steps.length - 1 : 0);
  const boundedStepIndex = Math.min(Math.max(liveStepIndex, 0), TOTAL_STEPS - 1);

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
                totalSteps={TOTAL_STEPS}
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
                matrices={matrices}
            />

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <MatrixVisualizer 
                    matrices={matrices} 
                    liveStepIndex={boundedStepIndex}
                    steps={steps}
                />
            </div>

        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-600 text-center font-mono bg-[#0b0f19]">
            v2.1.0 • Research Preview • Localhost
        </div>
      </aside>


      {/* --- RIGHT MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0b0f19] relative">
          
          {/* Top HUD (Performance Metrics) - Always Visible */}
          <div className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md flex items-center px-6 shadow-sm z-10 shrink-0">
               <PerformancePanel steps={steps} evaluation={evaluationResult} />
          </div>

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar" ref={scrollContainerRef}>
              
              <div className="max-w-5xl mx-auto space-y-8 pb-20">
                  {/* Analysis Charts (Collapsible or Top Placed) */}
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

                  {/* Story Timeline (The Main Feed) */}
                  <section className="min-h-[300px]">
                      <StoryTimeline 
                          steps={steps} 
                          vanillaStory={vanillaStory} 
                          vanillaPrompt={vanillaPrompt}
                      />
                  </section>

                  {/* Final Report */}
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

      {/* Architecture Modal Overlay */}
      {showArchitecture && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowArchitecture(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full p-8 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowArchitecture(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24} /></button>
            
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">
                Hybrid Neuro-Symbolic Architecture
            </h2>
            
            <div className="flex flex-col gap-10">
                {/* 1. VISUAL FLOWCHART */}
                <div className="relative flex items-center justify-between p-10 bg-[#0b0f19] rounded-xl border border-slate-800 shadow-inner overflow-hidden">
                    
                    {/* Background decorative grid */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" 
                         style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                    </div>

                    {/* Step 1: Input/Context */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-slate-300 shadow-lg">
                            <Database size={32} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-slate-200">History</div>
                            <div className="text-[10px] text-slate-500 font-mono">Context Window</div>
                        </div>
                    </div>

                    <ArrowRight size={24} className="text-slate-600" />

                    {/* Step 2: System 1 (Symbolic) */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-indigo-900/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                            <Binary size={40} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-indigo-300">System 1</div>
                            <div className="text-[10px] text-indigo-400/60 font-mono">Symbolic Planner</div>
                        </div>
                        <div className="absolute -top-6 text-[10px] font-mono text-indigo-500 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30">
                            P(E | Context)
                        </div>
                    </div>

                    <ArrowRight size={24} className="text-indigo-600" />

                    {/* Step 3: System 2 (Neural) */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-pink-900/20 border-2 border-pink-500 flex items-center justify-center text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                            <Brain size={40} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-pink-300">System 2</div>
                            <div className="text-[10px] text-pink-400/60 font-mono">Neural Generator</div>
                        </div>
                         <div className="absolute -top-6 text-[10px] font-mono text-pink-500 bg-pink-950/50 px-2 py-0.5 rounded border border-pink-500/30">
                            Constraint Prompt
                        </div>
                    </div>

                    <ArrowRight size={24} className="text-pink-600" />

                    {/* Step 4: Verifier */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-900/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <ShieldCheck size={32} />
                        </div>
                         <div className="text-center">
                            <div className="text-sm font-bold text-emerald-300">Verifier</div>
                            <div className="text-[10px] text-emerald-400/60 font-mono">NLI Check</div>
                        </div>
                    </div>
                    
                    <ArrowRight size={24} className="text-emerald-600" />

                     {/* Step 5: Output */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-slate-100 shadow-lg">
                            <FileText size={32} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-slate-200">Story</div>
                            <div className="text-[10px] text-slate-500 font-mono">Appended Segment</div>
                        </div>
                    </div>

                    {/* FEEDBACK LOOP VISUALIZATION */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[120px] pointer-events-none">
                         {/* This SVG draws the curved line from Verifier back to System 2 */}
                         <svg className="w-full h-full overflow-visible">
                            <path 
                                d="M 520 20 C 520 100, 320 100, 320 50" 
                                fill="none" 
                                stroke="#ef4444" 
                                strokeWidth="2" 
                                strokeDasharray="6 4"
                                className="opacity-40 animate-pulse"
                            />
                            <text x="420" y="90" fill="#ef4444" fontSize="10" fontFamily="monospace" textAnchor="middle">REJECT & RETRY</text>
                         </svg>
                         <div className="absolute right-[22%] top-[60%] p-1 bg-red-900/50 rounded-full border border-red-500 text-red-400">
                             <RotateCcw size={12} />
                         </div>
                    </div>

                </div>

                {/* 2. TEXTUAL EXPLANATION */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    <div className="space-y-3">
                        <h3 className="text-indigo-400 font-bold flex items-center gap-2">
                            <Binary size={18} />
                            System 1: The Planner
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            A discrete <strong>Markov Chain</strong> model acts as the high-level planner. Instead of letting the LLM hallucinate the plot, System 1 selects the next <code className="text-indigo-300 bg-indigo-900/30 px-1 rounded">EventType</code> (e.g., <em>Inciting Incident</em>) based on learned probabilities from the training dataset. This ensures structural integrity {'($P(E_{t+1}|E_t)$)'}.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-pink-400 font-bold flex items-center gap-2">
                            <Brain size={18} />
                            System 2: The Generator
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            A constrained <strong>Large Language Model</strong> (Gemini/Mistral) receives the target event and context. Crucially, it is <em>not</em> asked to "write a story" but to "write a specific segment" that fulfills the structural requirement. Dynamic prompts prevent repetitive loops.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-emerald-400 font-bold flex items-center gap-2">
                            <ShieldCheck size={18} />
                            The Verifier Loop
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            A separate NLI (Natural Language Inference) process evaluates the output. It asks: <em>"Does this text actually constitute a {currentEvent}?"</em>. If confidence is low, the segment is rejected, and System 2 is forced to retry with higher temperature, preventing structural drift.
                        </p>
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