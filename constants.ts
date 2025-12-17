import { EventType, TrajectoryModel, TransitionMatrix, ConstraintConfig } from './types';

export const EVENT_TYPES = Object.values(EventType);
export const TRAJECTORY_BINS = 20; // High resolution analysis

// --- NARRATIVE CONSTRAINTS (The "Memory" Module) ---
export const GLOBAL_CONSTRAINTS: Record<EventType, ConstraintConfig> = {
    [EventType.Introduction]: { 
        maxOccurrences: 1, 
        cooldown: 0 
    },
    [EventType.Inciting_Incident]: { 
        maxOccurrences: 1, 
        minStepProgress: 0.05 
    }, 
    [EventType.Rising_Action]: { 
        cooldown: 1,
        requiresEvent: EventType.Inciting_Incident 
    }, 
    [EventType.Conflict]: { 
        cooldown: 0,
        requiresEvent: EventType.Rising_Action 
    },
    [EventType.Revelation]: { 
        maxOccurrences: 1, 
        minStepProgress: 0.4, // Plot twists shouldn't happen too early
        requiresEvent: EventType.Rising_Action
    },
    [EventType.Climax]: { 
        maxOccurrences: 1, 
        minStepProgress: 0.6,
        requiresEvent: EventType.Conflict 
    }, 
    [EventType.Falling_Action]: { 
        minStepProgress: 0.7,
        requiresEvent: EventType.Climax 
    },
    [EventType.Resolution]: { 
        maxOccurrences: 1, 
        minStepProgress: 0.8,
        requiresEvent: EventType.Climax 
    },
    [EventType.Story_End]: {
        maxOccurrences: 1,
        minStepProgress: 0.9, // Must be at the very end
        requiresEvent: EventType.Resolution // Logic: Resolve first, then End.
    },
    [EventType.Dialogue]: { 
        cooldown: 0 
    },
    [EventType.Description]: { 
        cooldown: 2 
    }, 
};

// Helper to create a normalized row
const createRow = (weights: Partial<Record<EventType, number>>): Record<EventType, number> => {
  const defaults: Record<EventType, number> = {
    [EventType.Introduction]: 0.01, 
    [EventType.Inciting_Incident]: 0.01,
    [EventType.Rising_Action]: 0.01,
    [EventType.Conflict]: 0.01,
    [EventType.Revelation]: 0.01,
    [EventType.Climax]: 0.01,
    [EventType.Falling_Action]: 0.01,
    [EventType.Resolution]: 0.01,
    [EventType.Story_End]: 0.01,
    [EventType.Dialogue]: 0.01,
    [EventType.Description]: 0.01, 
  };
  
  const merged = { ...defaults, ...weights };
  const total = Object.values(merged).reduce((sum, val) => sum + val, 0);
  
  const normalized: any = {};
  for (const key of EVENT_TYPES) {
    normalized[key] = merged[key as EventType] / total;
  }
  return normalized;
};

// Default fallback matrix (Generic)
const GENERIC_MATRIX: TransitionMatrix = {
    [EventType.Introduction]: createRow({ [EventType.Inciting_Incident]: 0.5, [EventType.Description]: 0.4, [EventType.Dialogue]: 0.1 }),
    [EventType.Inciting_Incident]: createRow({ [EventType.Rising_Action]: 0.7, [EventType.Conflict]: 0.3 }),
    [EventType.Rising_Action]: createRow({ [EventType.Conflict]: 0.5, [EventType.Dialogue]: 0.3, [EventType.Revelation]: 0.2 }),
    [EventType.Conflict]: createRow({ [EventType.Climax]: 0.3, [EventType.Rising_Action]: 0.4, [EventType.Revelation]: 0.3 }),
    [EventType.Revelation]: createRow({ [EventType.Conflict]: 0.5, [EventType.Climax]: 0.5 }), // Twists usually lead to conflict or climax
    [EventType.Climax]: createRow({ [EventType.Falling_Action]: 0.9, [EventType.Resolution]: 0.1 }),
    [EventType.Falling_Action]: createRow({ [EventType.Resolution]: 0.9, [EventType.Story_End]: 0.1 }),
    [EventType.Resolution]: createRow({ [EventType.Story_End]: 0.9, [EventType.Dialogue]: 0.1 }),
    [EventType.Story_End]: createRow({ [EventType.Story_End]: 1.0 }), // Absorbing state
    [EventType.Dialogue]: createRow({ [EventType.Conflict]: 0.3, [EventType.Rising_Action]: 0.3, [EventType.Revelation]: 0.1 }),
    [EventType.Description]: createRow({ [EventType.Inciting_Incident]: 0.3, [EventType.Dialogue]: 0.3 }),
};

// Default Trajectory is just 20 copies of generic (until trained)
export const DEFAULT_TRAJECTORY: TrajectoryModel = Array(TRAJECTORY_BINS).fill(GENERIC_MATRIX);

export const getMatrixForStep = (
    currentStepIndex: number, 
    totalSteps: number, 
    trajectory: TrajectoryModel
): TransitionMatrix => {
    if (totalSteps <= 0) return trajectory[0];
    const progress = Math.min(0.99, Math.max(0, currentStepIndex / totalSteps));
    const binIndex = Math.floor(progress * TRAJECTORY_BINS);
    return trajectory[binIndex] || trajectory[0];
};