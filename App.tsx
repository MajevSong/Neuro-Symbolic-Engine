import React, { useState, useRef } from 'react';
import { EventType, GenerationStep, TimeSlicedMatrices, EvaluationResult, ModelProvider, DatasetStats } from './types';
import { DEFAULT_MATRICES, TOTAL_STEPS } from './constants';
import { generateStorySegment, verifySegment, evaluateStory, generateVanillaStory } from './services/geminiService';
import { trainModelFromDataset } from './services/trainingService';
import EngineControl from './components/EngineControl';
import PerformancePanel from './components/PerformancePanel';
import StoryTimeline from './components/StoryTimeline';
import MatrixVisualizer from './components/MatrixVisualizer';
import EvaluationReport from './components/EvaluationReport';
import TrainingPanel from './components/TrainingPanel';
import { Layout, FileJson, Database, BrainCircuit, ShieldCheck, X } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [isRunning, setIsRunning] = useState(false);
  const [isVanillaLoading, setIsVanillaLoading] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [matrices, setMatrices] = useState<TimeSlicedMatrices>(DEFAULT_MATRICES);
  const [currentEvent, setCurrentEvent] = useState<EventType>(EventType.Introduction);
  const [statusMessage, setStatusMessage] = useState("System Idle. Load dataset to train or start default simulation.");
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
  const [vanillaEvaluation, setVanillaEvaluation] = useState<EvaluationResult | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Symbolic Logic (Step A) ---
  const selectNextEvent = (
    stepIndex: number, 
    prevEvent: EventType, 
    matrix: TimeSlicedMatrices
  ): EventType => {
    // 1. Get probabilities for the current step and previous event
    const transitionRow = matrix[stepIndex][prevEvent];
    
    // 2. Apply Self-Loop Penalty (Alpha coefficient)
    // Research Paper: "If E_{t+1} == E_t, multiply by alpha (e.g. 0.5) and re-normalize"
    const entries = Object.entries(transitionRow) as [EventType, number][];
    let weightedEntries = entries.map(([event, prob]) => {
      if (event === prevEvent) return [event, prob * 0.5] as [EventType, number]; // Alpha = 0.5
      return [event, prob] as [EventType, number];
    });

    // 3. Normalize
    const totalWeight = weightedEntries.reduce((sum, [, prob]) => sum + prob, 0);
    weightedEntries = weightedEntries.map(([event, prob]) => [event, prob / totalWeight]);

    // 4. Weighted Random Selection
    const r = Math.random();
    let cumulative = 0;
    for (const [event, prob] of weightedEntries) {
      cumulative += prob;
      if (r <= cumulative) return event;
    }
    return weightedEntries[weightedEntries.length - 1][0]; // Fallback
  };

  // --- Training Handler ---
  const handleFileUpload = async (file: File) => {
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingStatus("Initializing...");
    
    try {
        const result = await trainModelFromDataset(file, (percent, msg) => {
            setTrainingProgress(percent);
            setTrainingStatus(msg);
        });
        
        setMatrices(result.matrices);
        setDatasetStats(result.stats);
        setStatusMessage(`Training complete. Analyzed ${result.stats.count} stories and updated transition matrices.`);
    } catch (e) {
        console.error(e);
        setStatusMessage("Training failed: " + e);
        throw e;
    } finally {
        setIsTraining(false);
    }
  };

  // --- The Main Generation Loop ---
  const runGenerationLoop = async () => {
    setIsRunning(true);
    setSteps([]);
    setEvaluationResult(null); // Clear previous evaluation
    setCurrentEvent(EventType.Introduction);
    abortControllerRef.current = new AbortController();
    
    let previousEvent = EventType.Introduction;
    let storyContext = "";
    
    // Temporary Steps array to pass to evaluation at the end
    const generatedSteps: GenerationStep[] = [];

    try {
      for (let step = 0; step < TOTAL_STEPS; step++) {
        if (abortControllerRef.current?.signal.aborted) break;

        // --- Phase 2: System 1 (Symbolic) ---
        setStatusMessage(`[Step ${step}] System 1: Calculating transition P(E|${previousEvent})...`);
        await new Promise(r => setTimeout(r, 600));

        let nextEvent: EventType;
        if (step === 0) {
            nextEvent = EventType.Introduction; 
        } else {
            nextEvent = selectNextEvent(step, previousEvent, matrices);
        }
        setCurrentEvent(nextEvent);

        // --- Phase 3: System 2 (Neural Generator) ---
        setStatusMessage(`[Step ${step}] System 2: Generating <${nextEvent}> segment...`);
        
        let segmentText = "";
        let verified = false;
        let verificationScore = 0;
        let retryCount = 0;
        const MAX_RETRIES = 2;

        // --- Phase 4: Verification (NLI) & Closed Loop ---
        while (!verified && retryCount <= MAX_RETRIES) {
             if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
             
             segmentText = await generateStorySegment(storyContext, nextEvent, step, provider);
             
             setStatusMessage(`[Step ${step}] Verifier: NLI Entailment Check (Attempt ${retryCount + 1})...`);
             const check = await verifySegment(segmentText, nextEvent, provider);
             
             verificationScore = check.confidence;
             verified = check.verified;

             if (!verified) {
                 setStatusMessage(`[Step ${step}] Verifier: Rejected (${check.confidence}). Reasoning: ${check.reasoning}`);
                 retryCount++;
                 await new Promise(r => setTimeout(r, 1000));
             }
        }

        // Commit Step
        const newStep: GenerationStep = {
            stepIndex: step,
            selectedEvent: nextEvent,
            generatedText: segmentText,
            verificationScore,
            verified,
            retryCount,
            timestamp: Date.now()
        };

        setSteps(prev => [...prev, newStep]);
        generatedSteps.push(newStep);

        storyContext += " " + segmentText;
        previousEvent = nextEvent;
        
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }

      // --- Phase 5: Evaluation ---
      if (!abortControllerRef.current?.signal.aborted) {
          setStatusMessage(`Phase 5: Running AI Judge Evaluation (${provider === 'ollama' ? 'Local' : 'Cloud'})...`);
          setIsEvaluating(true);
          // Pass the generated steps so we can calculate CSR (Constraint Satisfaction Rate)
          const evaluation = await evaluateStory(storyContext, provider, generatedSteps);
          setEvaluationResult(evaluation);
          setIsEvaluating(false);
          setStatusMessage("Pipeline execution complete. Story Evaluated.");
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }

    } catch (error) {
       if (error instanceof Error && error.message === "Aborted") {
           setStatusMessage("Execution aborted by user.");
       } else {
           setStatusMessage(`Error: ${error}`);
           console.error(error);
       }
       setIsEvaluating(false);
    } finally {
      setIsRunning(false);
    }
  };

  const runVanillaLoop = async () => {
      setIsVanillaLoading(true);
      setVanillaStory(null);
      setVanillaEvaluation(null);
      setStatusMessage(`Generating Baseline Story (${provider === 'ollama' ? 'Local Ollama' : 'Vanilla LLM'})...`);

      try {
        const story = await generateVanillaStory(provider);
        setVanillaStory(story);
        
        setStatusMessage("Evaluating Baseline Story...");
        const evalResult = await evaluateStory(story, provider);
        setVanillaEvaluation(evalResult);
        
        setStatusMessage("Baseline comparison complete.");
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

      } catch (error) {
          setStatusMessage(`Error generating baseline story: ${error}`);
          console.error(error);
      } finally {
          setIsVanillaLoading(false);
      }
  };

  const handleReset = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setSteps([]);
    setEvaluationResult(null);
    setVanillaStory(null);
    setVanillaEvaluation(null);
    setIsRunning(false);
    setIsEvaluating(false);
    setIsVanillaLoading(false);
    setStatusMessage("System reset. Matrices retained.");
    setCurrentEvent(EventType.Introduction);
  };

  const visualizerStepIndex = isRunning ? steps.length : (steps.length > 0 ? steps.length - 1 : 0);
  const boundedStepIndex = Math.min(Math.max(visualizerStepIndex, 0), TOTAL_STEPS - 1);
  const activeMatrix = matrices[boundedStepIndex];
  const highlightFrom = steps.length > 0 && isRunning ? steps[steps.length - 1].selectedEvent : (steps.length > 0 ? steps[steps.length - 2]?.selectedEvent : undefined);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 relative">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Controls & Visualization */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8 h-fit">
           <header className="mb-2 flex justify-between items-start">
             <div>
               <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                 Neuro-Symbolic Engine
               </h1>
               <p className="text-xs text-slate-500 font-mono mt-1">
                 PAPER ID: #8821 | REPLICATION
               </p>
             </div>
             <button 
                onClick={() => setShowArchitecture(true)}
                className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 px-3 py-1.5 rounded-full transition-colors"
             >
                <Layout size={12} />
                Architecture
             </button>
           </header>
           
           <TrainingPanel 
             onFileUpload={handleFileUpload}
             isTraining={isTraining}
             trainingProgress={trainingProgress}
             trainingStatus={trainingStatus}
             datasetStats={datasetStats}
           />

           <EngineControl 
             isRunning={isRunning}
             progress={steps.length}
             totalSteps={TOTAL_STEPS}
             onStart={runGenerationLoop}
             onReset={handleReset}
             onRunVanilla={runVanillaLoop}
             statusMessage={statusMessage}
             isVanillaLoading={isVanillaLoading}
             provider={provider}
             setProvider={setProvider}
           />

           <PerformancePanel 
             steps={steps} 
             evaluation={evaluationResult} 
           />

           <div className="space-y-2">
             <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-amber-500"></span>
               System 1: Symbolic Planner
             </h3>
             <MatrixVisualizer 
                matrix={activeMatrix} 
                stepIndex={boundedStepIndex}
                highlightFrom={highlightFrom}
                highlightTo={currentEvent}
             />
           </div>
        </div>

        {/* Right Column: Story Output */}
        <div className="lg:col-span-2">
          <StoryTimeline steps={steps} vanillaStory={vanillaStory} />
          
          <EvaluationReport 
            neuroResult={evaluationResult} 
            vanillaResult={vanillaEvaluation}
            isLoading={isEvaluating || (isVanillaLoading && !!vanillaStory)} 
          />
        </div>
      </div>

      {/* Architecture Modal */}
      {showArchitecture && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowArchitecture(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full p-6 md:p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowArchitecture(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <Layout className="text-indigo-400" />
              System Architecture
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-900 via-indigo-500 to-indigo-900 -z-10"></div>

              {/* Step 1 */}
              <div className="bg-slate-800/80 p-4 rounded-lg border border-indigo-500/20 relative group hover:border-indigo-500/50 transition-colors">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] text-indigo-400 font-mono tracking-wider border border-slate-800">STEP 1</div>
                  <div className="h-10 w-10 bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-500/30 text-indigo-300">
                      <Database size={18} />
                  </div>
                  <h3 className="text-center font-bold text-slate-200 text-sm mb-1">Data Processing</h3>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      Reads JSON Dataset (<span className="font-mono text-indigo-300">stories.json</span>). Heuristic tokenizer labels events & builds transition matrices in-browser.
                  </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 relative hover:border-indigo-500/30 transition-colors">
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] text-indigo-400 font-mono tracking-wider border border-slate-800">STEP 2</div>
                  <div className="h-10 w-10 bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-500/30 text-indigo-300">
                      <FileJson size={18} />
                  </div>
                  <h3 className="text-center font-bold text-slate-200 text-sm mb-1">Markov Construction</h3>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      Custom Time-Sliced Matrices loaded into Engine. Selection logic applies self-loop penalties and random sampling.
                  </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 relative hover:border-indigo-500/30 transition-colors">
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] text-indigo-400 font-mono tracking-wider border border-slate-800">STEP 3</div>
                  <div className="h-10 w-10 bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-500/30 text-indigo-300">
                      <BrainCircuit size={18} />
                  </div>
                  <h3 className="text-center font-bold text-slate-200 text-sm mb-1">Neural Generation</h3>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      LLM (Gemini / Ollama) generates text segments conditioned on the selected Event Type and previous context.
                  </p>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 relative hover:border-indigo-500/30 transition-colors">
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] text-indigo-400 font-mono tracking-wider border border-slate-800">STEP 4</div>
                  <div className="h-10 w-10 bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-500/30 text-indigo-300">
                      <ShieldCheck size={18} />
                  </div>
                  <h3 className="text-center font-bold text-slate-200 text-sm mb-1">Verification Loop</h3>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      NLI Model verifies if output matches intended event. Retries generation if confidence is low.
                  </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;