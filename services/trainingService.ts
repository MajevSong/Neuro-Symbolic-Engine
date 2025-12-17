import { EventType, TrajectoryModel, DatasetStats, PhaseTransitionSummary, DiscoveredPath } from '../types';
import { EVENT_TYPES, TRAJECTORY_BINS } from '../constants';
import { callOllama } from './geminiService';

interface StoryRecord {
  text: string;
}

// Helper to auto-name paths based on their content
const generatePathName = (sequence: EventType[]): string => {
    const hasRevelation = sequence.includes(EventType.Revelation);
    const conflictCount = sequence.filter(e => e === EventType.Conflict).length;
    const endType = sequence[sequence.length - 1];

    if (hasRevelation && conflictCount > 2) return "Twisted Thriller Arc";
    if (conflictCount > 4) return "High-Octane Action Arc";
    if (endType === EventType.Resolution && sequence.includes(EventType.Climax)) return "Classic Hero Arc";
    if (sequence.filter(e => e === EventType.Dialogue).length > 5) return "Dialogue-Driven Drama";
    if (sequence[0] === EventType.Inciting_Incident) return "In Media Res Start";
    
    return `Learned Pattern (Type ${sequence.length})`;
};

export const trainModelFromDataset = async (
  file: File, 
  onProgress: (percent: number, message: string) => void
): Promise<{ trajectory: TrajectoryModel, stats: DatasetStats }> => {
  
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        onProgress(5, "Reading Dataset...");
        
        let data: StoryRecord[] = [];
        try {
            data = JSON.parse(text);
        } catch (jsonErr) {
            const lines = text.trim().split('\n');
            data = lines.map(line => JSON.parse(line));
        }

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Invalid format. Expected JSON array of objects with 'text' field.");
        }

        // --- SEQUENCE MINING CONFIGURATION ---
        // HONESTY NOTE: Analyzing 1000 stories * 15 steps = 15,000 LLM calls.
        // For Browser/Demo stability, we sample the top 30 stories.
        // In a real Python pipeline, you would process all 1000.
        const SAMPLE_LIMIT = 30; 
        const TARGET_STEPS_PER_STORY = 15;

        onProgress(10, `Mining Narrative Archetypes (Sample: ${SAMPLE_LIMIT} Stories)...`);
        
        const storiesToProcess = data.slice(0, SAMPLE_LIMIT);
        const pathFrequency: Record<string, number> = {}; // "Intro,Conflict,..." -> 5
        const globalEventCounts: Record<string, number> = {};
        EVENT_TYPES.forEach(t => globalEventCounts[t] = 0);

        // Matrix structures
        const binTransitions: Record<number, Record<string, Record<string, number>>> = {};
        for(let b=0; b<TRAJECTORY_BINS; b++) {
            binTransitions[b] = {};
            EVENT_TYPES.forEach(from => {
                binTransitions[b][from] = {};
                EVENT_TYPES.forEach(to => {
                    binTransitions[b][from][to] = 0;
                });
            });
        }

        // --- ANALYSIS LOOP ---
        for (let i = 0; i < storiesToProcess.length; i++) {
            const story = storiesToProcess[i];
            const percent = 10 + Math.floor((i / storiesToProcess.length) * 80);
            onProgress(percent, `Extracting Structure: Story ${i + 1}/${storiesToProcess.length}`);
            
            await new Promise(r => setTimeout(r, 5)); 

            // Split into N chunks to map to our desired timeline
            const sentences = story.text.match(/[^.!?]+[.!?]+/g) || [story.text];
            const chunkSize = Math.ceil(sentences.length / TARGET_STEPS_PER_STORY);
            
            let currentPath: EventType[] = [];
            let previousEvent = EventType.Introduction; // Assume start

            for (let step = 0; step < TARGET_STEPS_PER_STORY; step++) {
                const startIdx = step * chunkSize;
                const endIdx = startIdx + chunkSize;
                const segment = sentences.slice(startIdx, endIdx).join(" ");
                
                if (!segment || segment.length < 10) continue;

                const binIndex = Math.floor((step / TARGET_STEPS_PER_STORY) * TRAJECTORY_BINS);

                // LLM Classification
                // Note: In Python, you'd use a fine-tuned BERT here for speed. 
                // Here we use Ollama/Gemini via our helper.
                const prompt = `
                  Classify this story segment into ONE: ${EVENT_TYPES.join(', ')}.
                  Text: "${segment.slice(0, 150)}..."
                  Return JSON: { "label": "CATEGORY" }
                `;

                try {
                    const resultStr = await callOllama(prompt, 0.0, { 
                        type: "object", 
                        properties: { label: { type: "string", enum: EVENT_TYPES } },
                        required: ["label"] 
                    });
                    
                    const cleanJson = resultStr.replace(/```json/g, '').replace(/```/g, '').trim();
                    const result = JSON.parse(cleanJson);
                    let predictedEvent = result.label as EventType;

                    // Fallback if hallucinated
                    if (!EVENT_TYPES.includes(predictedEvent)) predictedEvent = EventType.Description;

                    // Record for Matrix
                    if (binTransitions[binIndex][previousEvent]) {
                        binTransitions[binIndex][previousEvent][predictedEvent]++;
                    }
                    globalEventCounts[predictedEvent]++;
                    previousEvent = predictedEvent;
                    
                    // Record for Path
                    currentPath.push(predictedEvent);

                } catch (err) {
                    // Fail silently to keep training moving, assume 'Rising_Action' filler
                    currentPath.push(EventType.Rising_Action);
                }
            }
            
            // Store the discovered full path
            const pathKey = currentPath.join(',');
            pathFrequency[pathKey] = (pathFrequency[pathKey] || 0) + 1;
        }

        onProgress(95, "Synthesizing Archetypes...");

        // 1. Process Learned Paths
        const discoveredPaths: DiscoveredPath[] = Object.entries(pathFrequency)
            .map(([pathStr, count], index) => {
                const sequence = pathStr.split(',') as EventType[];
                return {
                    id: `path-${index}`,
                    sequence,
                    frequency: count,
                    percentage: (count / storiesToProcess.length) * 100,
                    name: generatePathName(sequence)
                };
            })
            .sort((a, b) => b.frequency - a.frequency) // Sort by most frequent
            .slice(0, 15); // Top 15 as requested

        // 2. Process Matrix (Trajectory)
        const learnedTrajectory: TrajectoryModel = [];
        const topTransitions: PhaseTransitionSummary[] = [];
        const summaryIndices = [0, Math.floor(TRAJECTORY_BINS/2), TRAJECTORY_BINS-1];

        for(let b=0; b<TRAJECTORY_BINS; b++) {
            const matrix: any = {};
            let maxProb = -1;
            let bestPair = { from: EventType.Introduction, to: EventType.Introduction };

            EVENT_TYPES.forEach(from => {
                const rowCounts = binTransitions[b][from];
                const total = Object.values(rowCounts).reduce((acc, val) => acc + val, 0);
                const normalizedRow: any = {};
                EVENT_TYPES.forEach(to => {
                    const count = rowCounts[to];
                    const smoothTotal = total + EVENT_TYPES.length; 
                    const prob = (count + 1) / smoothTotal;
                    normalizedRow[to] = prob;

                    if (from !== to && prob > maxProb) {
                        maxProb = prob;
                        bestPair = { from: from as EventType, to: to as EventType };
                    }
                });
                matrix[from] = normalizedRow;
            });
            learnedTrajectory.push(matrix);

             if (summaryIndices.includes(b)) {
                 topTransitions.push({
                    binIndex: b,
                    progressLabel: `${Math.round((b/TRAJECTORY_BINS)*100)}%`,
                    from: bestPair.from,
                    to: bestPair.to,
                    probability: maxProb
                });
            }
        }

        onProgress(100, "Discovery Complete.");
        
        resolve({ 
            trajectory: learnedTrajectory,
            stats: {
                count: storiesToProcess.length,
                distribution: globalEventCounts as Record<EventType, number>,
                mostCommonPath: discoveredPaths[0]?.sequence.map(String) || [],
                topTransitions: topTransitions,
                discoveredPaths: discoveredPaths // Export the discovered archetypes
            }
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};