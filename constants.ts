import { EventType, TimeSlicedMatrices, TransitionMatrix } from './types';

export const TOTAL_STEPS = 15;
export const EVENT_TYPES = Object.values(EventType);

// Helper to create a normalized row with defaults for 9 events
const createRow = (weights: Partial<Record<EventType, number>>): Record<EventType, number> => {
  const defaults: Record<EventType, number> = {
    [EventType.Introduction]: 0.00, // Minimize jumping back to start by default
    [EventType.Inciting_Incident]: 0.01,
    [EventType.Rising_Action]: 0.01,
    [EventType.Conflict]: 0.01,
    [EventType.Climax]: 0.01,
    [EventType.Falling_Action]: 0.01,
    [EventType.Resolution]: 0.01,
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

// --- SIMULATION MATRICES (Based on Research Plan Phase 2) ---

// Phase 1: Setup (Steps 0-3)
// Logic: Strongly force forward motion. Prevent loops back to Introduction.
const setupMatrix: TransitionMatrix = {
  [EventType.Introduction]: createRow({ [EventType.Description]: 5, [EventType.Inciting_Incident]: 3, [EventType.Dialogue]: 2 }),
  [EventType.Inciting_Incident]: createRow({ [EventType.Rising_Action]: 7, [EventType.Conflict]: 2, [EventType.Description]: 1 }),
  [EventType.Rising_Action]: createRow({ [EventType.Conflict]: 6, [EventType.Description]: 2, [EventType.Dialogue]: 2 }),
  [EventType.Conflict]: createRow({ [EventType.Rising_Action]: 4, [EventType.Dialogue]: 4 }),
  [EventType.Climax]: createRow({ [EventType.Falling_Action]: 8 }), // Unlikely in setup, but if happens, move on
  [EventType.Falling_Action]: createRow({ [EventType.Resolution]: 8 }),
  [EventType.Resolution]: createRow({ [EventType.Introduction]: 0.1, [EventType.Inciting_Incident]: 5 }), // If resolved too early, restart conflict
  [EventType.Dialogue]: createRow({ [EventType.Inciting_Incident]: 4, [EventType.Description]: 4 }),
  [EventType.Description]: createRow({ [EventType.Inciting_Incident]: 5, [EventType.Rising_Action]: 3 }),
};

// Phase 2: Development (Steps 4-10)
// Logic: Loop between Rising Action, Conflict, and Dialogue. Avoid early Resolution.
const developmentMatrix: TransitionMatrix = {
  [EventType.Introduction]: createRow({ [EventType.Rising_Action]: 8 }), // Correction if we somehow got here
  [EventType.Inciting_Incident]: createRow({ [EventType.Rising_Action]: 6, [EventType.Conflict]: 4 }),
  [EventType.Rising_Action]: createRow({ [EventType.Conflict]: 5, [EventType.Dialogue]: 3, [EventType.Climax]: 1 }),
  [EventType.Conflict]: createRow({ [EventType.Rising_Action]: 3, [EventType.Dialogue]: 3, [EventType.Climax]: 2 }),
  [EventType.Climax]: createRow({ [EventType.Falling_Action]: 5, [EventType.Resolution]: 1 }), 
  [EventType.Falling_Action]: createRow({ [EventType.Resolution]: 1, [EventType.Conflict]: 6 }), // Force back to conflict if too early
  [EventType.Resolution]: createRow({ [EventType.Conflict]: 8 }), // False resolution, go back
  [EventType.Dialogue]: createRow({ [EventType.Conflict]: 5, [EventType.Rising_Action]: 4 }),
  [EventType.Description]: createRow({ [EventType.Rising_Action]: 4, [EventType.Conflict]: 4 }),
};

// Phase 3: Conclusion (Steps 11-14)
// Logic: Funnel everything towards Climax -> Falling Action -> Resolution.
const resolutionMatrix: TransitionMatrix = {
  [EventType.Introduction]: createRow({ [EventType.Resolution]: 1 }),
  [EventType.Inciting_Incident]: createRow({ [EventType.Conflict]: 2, [EventType.Climax]: 6 }),
  [EventType.Rising_Action]: createRow({ [EventType.Climax]: 8, [EventType.Conflict]: 2 }),
  [EventType.Conflict]: createRow({ [EventType.Climax]: 9, [EventType.Rising_Action]: 1 }),
  [EventType.Climax]: createRow({ [EventType.Falling_Action]: 8, [EventType.Resolution]: 2 }),
  [EventType.Falling_Action]: createRow({ [EventType.Resolution]: 9, [EventType.Dialogue]: 1 }),
  [EventType.Resolution]: createRow({ [EventType.Resolution]: 6, [EventType.Description]: 2, [EventType.Dialogue]: 1 }), // Fade out
  [EventType.Dialogue]: createRow({ [EventType.Resolution]: 6, [EventType.Falling_Action]: 4 }),
  [EventType.Description]: createRow({ [EventType.Resolution]: 7, [EventType.Falling_Action]: 3 }),
};

export const DEFAULT_MATRICES: TimeSlicedMatrices = Array.from({ length: TOTAL_STEPS }, (_, i) => {
  if (i < 4) return setupMatrix;
  if (i < 11) return developmentMatrix;
  return resolutionMatrix;
});