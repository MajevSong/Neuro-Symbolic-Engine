
export enum EventType {
  Introduction = 'Introduction',
  Inciting_Incident = 'Inciting_Incident',
  Rising_Action = 'Rising_Action',
  Conflict = 'Conflict',
  Climax = 'Climax',
  Falling_Action = 'Falling_Action',
  Resolution = 'Resolution',
  Dialogue = 'Dialogue',
  Description = 'Description',
}

export interface GenerationStep {
  stepIndex: number; // 0 to 14
  selectedEvent: EventType;
  generatedText: string;
  verificationScore: number;
  verified: boolean;
  retryCount: number;
  timestamp: number;
}

// A 9x9 matrix representing transition probabilities between EventTypes
export type TransitionMatrix = Record<EventType, Record<EventType, number>>;

export type TimeSlicedMatrices = TransitionMatrix[];

export interface ResearchMetrics {
  csr: number; // Constraint Satisfaction Rate (0-100%)
  selfBleu: number; // Diversity Score (Lower is better, 0-1.0)
  uniqueNGrams: number; // Vocabulary richness
}

export interface EvaluationResult {
  coherenceScore: number; // 1-10
  creativityScore: number; // 1-10
  flowScore: number; // 1-10
  critique: string;
  metrics?: ResearchMetrics; // Optional for Vanilla, Required for Neuro
}

export interface EngineConfig {
  steps: number;
  selfLoopPenalty: number;
}

export type ModelProvider = 'gemini' | 'ollama';

export interface DatasetStats {
  count: number;
  distribution: Record<EventType, number>;
  mostCommonPath: string[];
}

export interface SavedModel {
  type: 'neuro-symbolic-model';
  version: string;
  timestamp: string;
  matrices: TimeSlicedMatrices;
  stats: DatasetStats;
}