
export enum EventType {
  Introduction = 'Introduction',
  Inciting_Incident = 'Inciting_Incident',
  Rising_Action = 'Rising_Action',
  Conflict = 'Conflict',
  Revelation = 'Revelation', // Plot Twist
  Climax = 'Climax',
  Falling_Action = 'Falling_Action',
  Resolution = 'Resolution',
  Story_End = 'Story_End', // Definitive Closure
  Dialogue = 'Dialogue',
  Description = 'Description',
}

export interface GenerationStep {
  stepIndex: number; 
  selectedEvent: EventType;
  generatedText: string;
  verificationScore: number;
  verified: boolean;
  retryCount: number;
  timestamp: number;
  promptUsed: string; 
}

// A 11x11 matrix representing transition probabilities between EventTypes
export type TransitionMatrix = Record<EventType, Record<EventType, number>>;

// Trajectory Model uses 20 discrete time bins
export type TrajectoryModel = TransitionMatrix[]; 

export interface ConstraintConfig {
    maxOccurrences?: number; 
    minStepProgress?: number; 
    cooldown?: number; 
    requiresEvent?: EventType; 
}

export interface ResearchMetrics {
  csr: number; 
  selfBleu: number; 
  uniqueNGrams: number; 
}

export interface EvaluationResult {
  coherenceScore: number; 
  creativityScore: number; 
  flowScore: number; 
  critique: string;
  metrics?: ResearchMetrics; 
}

export interface EngineConfig {
  steps: number;
  selfLoopPenalty: number;
}

export type ModelProvider = 'gemini' | 'ollama';

// NEW: Stores a full narrative path found in the dataset (e.g. Intro->Action->Climax)
export interface DiscoveredPath {
    id: string;
    sequence: EventType[];
    frequency: number; // How many stories followed this EXACT path?
    percentage: number;
    name: string; // Auto-generated name like "Classic Tragedy" or "Action Heavy"
}

export interface PhaseTransitionSummary {
    binIndex: number; 
    progressLabel: string; 
    from: EventType;
    to: EventType;
    probability: number;
}

export interface DatasetStats {
  count: number;
  distribution: Record<EventType, number>;
  mostCommonPath: string[];
  topTransitions?: PhaseTransitionSummary[]; 
  discoveredPaths: DiscoveredPath[]; // NEW: The mined archetypes
}

export interface SavedModel {
  type: 'neuro-symbolic-model';
  version: string;
  timestamp: string;
  trajectory: TrajectoryModel; 
  stats: DatasetStats;
}
