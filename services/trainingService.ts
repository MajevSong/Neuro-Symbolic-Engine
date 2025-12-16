import { EventType, TimeSlicedMatrices, DatasetStats } from '../types';
import { EVENT_TYPES, TOTAL_STEPS } from '../constants';
import { callOllama } from './geminiService';

interface StoryRecord {
  text: string;
}

export const trainModelFromDataset = async (
  file: File, 
  onProgress: (percent: number, message: string) => void
): Promise<{ matrices: TimeSlicedMatrices, stats: DatasetStats }> => {
  
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        onProgress(5, "Reading Dataset...");
        
        // 1. Parse JSON
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

        // 2. High Performance Mode for RTX 5080
        // We can process more samples since we are using local GPU inference
        const SAMPLE_LIMIT = 50; 
        const storiesToProcess = data.slice(0, SAMPLE_LIMIT);

        onProgress(10, `Initializing Analysis (${storiesToProcess.length} samples)...`);

        // Initialize counters
        const transitionCounts: Record<number, Record<string, Record<string, number>>> = {};
        const globalEventCounts: Record<string, number> = {};
        EVENT_TYPES.forEach(t => globalEventCounts[t] = 0);

        for (let t = 0; t < TOTAL_STEPS; t++) {
            transitionCounts[t] = {};
            EVENT_TYPES.forEach(from => {
                transitionCounts[t][from] = {};
                EVENT_TYPES.forEach(to => {
                    transitionCounts[t][from][to] = 0; 
                });
            });
        }

        // Processing Loop
        for (let i = 0; i < storiesToProcess.length; i++) {
            const story = storiesToProcess[i];
            const percent = 10 + Math.floor((i / storiesToProcess.length) * 80);
            
            // Clear differentiation: Analyzing Story X/Y
            onProgress(percent, `Analyzing Story ${i + 1}/${storiesToProcess.length}`);
            
            // Allow UI update
            await new Promise(r => setTimeout(r, 10));

            const sentences = story.text.match(/[^.!?]+[.!?]+/g) || [story.text];
            const chunkSize = Math.max(1, Math.ceil(sentences.length / TOTAL_STEPS));
            
            let previousEvent = EventType.Introduction;

            for (let t = 0; t < TOTAL_STEPS - 1; t++) {
                const start = Math.min(t * chunkSize, sentences.length - 1);
                const end = Math.min((t + 1) * chunkSize, sentences.length);
                const rawChunk = sentences.slice(start, end).join(" ");
                
                if (!rawChunk.trim()) continue;

                // --- OLLAMA INFERENCE ---
                // We ask Mistral to classify the segment
                const prompt = `
Task: Narrative Structural Classification.
Story Segment: "${rawChunk.slice(0, 500)}"

Classify this segment into exactly ONE of these categories:
${EVENT_TYPES.join(', ')}

Return strictly a JSON object: { "label": "CATEGORY_NAME" }
`;
                try {
                    const resultStr = await callOllama(prompt, 0.1, { 
                        type: "object", 
                        properties: { 
                            label: { type: "string", enum: EVENT_TYPES } 
                        },
                        required: ["label"] 
                    });
                    
                    const cleanJson = resultStr.replace(/```json/g, '').replace(/```/g, '').trim();
                    const result = JSON.parse(cleanJson);
                    const predictedEvent = result.label as EventType;

                    if (EVENT_TYPES.includes(predictedEvent)) {
                        if (transitionCounts[t][previousEvent] && transitionCounts[t][previousEvent][predictedEvent] !== undefined) {
                            transitionCounts[t][previousEvent][predictedEvent]++;
                        }
                        globalEventCounts[predictedEvent]++;
                        previousEvent = predictedEvent;
                    }
                } catch (err) {
                    console.warn("Skipping chunk due to classification error:", err);
                    // Continue without crashing
                }
            }
        }

        onProgress(95, "Calculating Probabilities...");
        
        const learnedMatrices: TimeSlicedMatrices = [];

        for (let t = 0; t < TOTAL_STEPS; t++) {
            const matrix: any = {};
            EVENT_TYPES.forEach(from => {
                const rowCounts = transitionCounts[t][from];
                const total = Object.values(rowCounts).reduce((a, b) => a + b, 0);
                const normalizedRow: any = {};
                EVENT_TYPES.forEach(to => {
                    // Laplace Smoothing
                    const count = rowCounts[to];
                    const smoothTotal = total + EVENT_TYPES.length;
                    normalizedRow[to] = (count + 1) / smoothTotal;
                });
                matrix[from] = normalizedRow;
            });
            learnedMatrices.push(matrix);
        }

        onProgress(100, "Local Training Complete.");
        
        resolve({ 
            matrices: learnedMatrices, 
            stats: {
                count: storiesToProcess.length,
                distribution: globalEventCounts as Record<EventType, number>,
                mostCommonPath: [] 
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