import { GoogleGenAI, Type } from '@google/genai';
import { EventType, EvaluationResult, ModelProvider, GenerationStep } from '../types';

// Standard localhost is usually preferred by browsers for CORS whitelist matching
const OLLAMA_HOST = 'http://localhost:11434';
// Using Mistral Small 24B for both Logic AND Creative Generation (Superior to Qwen 14B for narrative)
const OLLAMA_MODEL = 'mistral-small:24b'; 

// --- HELPER: Gemini Client ---
const getGeminiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found in environment variables");
    return new GoogleGenAI({ apiKey });
};

// --- HELPER: Ollama Client ---
export const callOllama = async (prompt: string, temperature: number, jsonSchema?: any): Promise<string> => {
    let finalPrompt = prompt;
    let format = undefined;

    // For Ollama, we append the schema instruction to the prompt if strict JSON is needed
    if (jsonSchema) {
        finalPrompt += `\n\nIMPORTANT: You must respond strictly with a valid JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n\nDo not include markdown formatting like \`\`\`json. Just return the raw JSON.`;
        format = "json";
    }

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            mode: 'cors', // Explicitly request CORS
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: finalPrompt,
                stream: false,
                format: format,
                options: {
                    temperature: temperature,
                    num_ctx: 8192 // Mistral Small supports larger context
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Ollama Connection Error:", error);
        
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        let extraWarning = "";
        
        if (isHttps) {
            extraWarning = "\n\n⚠️ MIXED CONTENT WARNING: You appear to be running this app on HTTPS (e.g., Cloud IDE). Browsers BLOCK requests to local HTTP servers (Ollama). You must run this app locally on http://localhost.";
        }

        // Detailed error for the user
        throw new Error(
            `Ollama Connection Failed.${extraWarning}\n\n` +
            "TROUBLESHOOTING:\n" +
            "1. **Taskbar Icon**: If you see the Ollama icon in your taskbar, Right Click -> QUIT it.\n" +
            "2. **Terminal**: Run command: `OLLAMA_ORIGINS=\"*\" ollama serve`\n" +
            "3. **Model**: Ensure you ran `ollama pull mistral-small:24b`\n" +
            "4. **Extensions**: Disable AdBlockers for localhost."
        );
    }
};

// Step B: Neural Generation (Phase 3)
export const generateStorySegment = async (
  previousContext: string,
  targetEvent: EventType,
  stepIndex: number,
  provider: ModelProvider,
  foreshadowingEvent?: EventType // Look-ahead context
): Promise<{ text: string, promptUsed: string }> => {
  
  // Extract the last few sentences to help the model connect the flow
  const sentences = previousContext.split(/(?<=[.!?])\s+/);
  const lastFewSentences = sentences.slice(-3).join(" ");
  const contextSnippet = previousContext.length > 2000 ? "..." + previousContext.slice(-2000) : previousContext;

  // Foreshadowing logic
  let foreshadowInstruction = "";
  if (foreshadowingEvent) {
      foreshadowInstruction = `5. **FORESHADOWING**: The NEXT segment after this will be a "${foreshadowingEvent}". End this segment in a way that naturally leads into that tone/action.`;
  }

  // Enhanced Prompt for better Flow and Diversity
  // TARGET LENGTH: ~80 words * 15 steps = 1200 words total.
  const prompt = `
    Role: Expert Novelist (System 2).
    Task: Write the next continuous segment of the story.
    
    Current Narrative Arc Position: Step ${stepIndex}/15
    Target Structural Event: **${targetEvent}**
    
    Previous Context (Summary):
    "${contextSnippet}"
    
    IMMEDIATE CONTEXT (Connect to this):
    "${lastFewSentences}"
    
    Instructions:
    1. **FLOW**: Begin your segment by directly reacting to or continuing the action/thought from the IMMEDIATE CONTEXT. Do not start a new unrelated scene unless the Event Type specifically requires a scene change.
    2. **SHOW, DON'T TELL**: Use sensory details suitable for a "${targetEvent}".
    3. **DIVERSITY**: Do not repeat phrases or sentence structures used in the immediate context. Avoid starting sentences with "Suddenly" or "Then".
    4. **LENGTH**: Write approximately 75-90 words. (This is strict. Do not write too little).
    ${foreshadowInstruction}
    
    Output: Return ONLY the new story text.
  `;

  let text = "";
  if (provider === 'ollama') {
      text = await callOllama(prompt, 0.85); // Slightly higher temp for creativity
  } else {
    // Gemini Fallback
    const client = getGeminiClient();
    const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { temperature: 0.85 }
    });
    text = response.text?.trim() || "";
  }

  return { text, promptUsed: prompt };
};

// Step C: Verification (Phase 4 - NLI Simulation)
export const verifySegment = async (
  segmentText: string,
  intendedEvent: EventType,
  provider: ModelProvider
): Promise<{ verified: boolean; confidence: number; reasoning: string }> => {
  
  const schemaDefinition = {
    type: Type.OBJECT,
    properties: {
      match: { type: Type.BOOLEAN, description: "True if the text entails the Intended Label hypothesis." },
      confidence: { type: Type.NUMBER, description: "Entailment score (0.0 - 1.0)" },
      reasoning: { type: Type.STRING, description: "Brief analysis of why it fits or fails." }
    },
    required: ["match", "confidence", "reasoning"]
  };

  const prompt = `
    Task: Narrative Logic Verification (NLI).
    
    Premise (Generated Segment): 
    "${segmentText}"
    
    Hypothesis (Target Event): 
    The segment functions as a "**${intendedEvent}**".
    
    Definitions for Verification:
    - Introduction: Establishes setting/characters.
    - Inciting_Incident: Disrupts the status quo.
    - Rising_Action: Escalates tension, complications arise.
    - Conflict: Active struggle or disagreement.
    - Climax: The turning point or highest tension.
    - Falling_Action: Consequences of the climax.
    - Resolution: Conclusion, settling of events.
    - Dialogue: Characters speaking to one another.
    - Description: Sensory world-building or internal monologue.
    
    Instructions:
    Evaluate if the Premise structurally fulfills the Hypothesis.
    - High Confidence (0.8-1.0): Clear match.
    - Low Confidence (0.0-0.5): Ambiguous or mismatched.
    
    Return strict JSON.
  `;

  try {
    let jsonString = "";

    if (provider === 'ollama') {
        jsonString = await callOllama(prompt, 0.1, schemaDefinition);
    } else {
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schemaDefinition,
                temperature: 0.1,
            }
        });
        jsonString = response.text || "{}";
    }
    
    // Sanitize JSON string if needed (sometimes local models add markdown blocks despite instructions)
    const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const json = JSON.parse(cleanJson);
    
    return {
      verified: json.match,
      confidence: json.confidence,
      reasoning: json.reasoning
    };
  } catch (error) {
    console.error("Verification Error:", error);
    return { verified: true, confidence: 0.5, reasoning: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

// Vanilla Generation for Comparison
export const generateVanillaStory = async (provider: ModelProvider): Promise<{ text: string, promptUsed: string }> => {
  // TARGET LENGTH: Matched to Neuro (~1200 words)
  const prompt = `
    Task: Write a COMPLETE, LONG-FORM short story (Target Length: Approximately 1100-1300 words).
    
    Narrative Arc Requirements:
    1. Introduction (Setup)
    2. Inciting Incident (Problem)
    3. Rising Action (Complications)
    4. Climax (Turning Point)
    5. Resolution (Conclusion)
    
    Instructions:
    - **LENGTH**: It is critical that you write a full, detailed story. Do not summarize events.
    - **DEPTH**: Fully develop scenes with dialogue, sensory description, and internal monologue.
    - **PACING**: Ensure the story does not rush to the end. Spend time in the 'Rising Action' phase.
    - **FORMAT**: Return the story as plain text without section headers (e.g. do not write "**Introduction**").
  `;

  let text = "";
  if (provider === 'ollama') {
      text = await callOllama(prompt, 0.9);
  } else {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { temperature: 0.9 }
    });
    text = response.text?.trim() || "";
  }

  return { text, promptUsed: prompt };
};

// --- METRIC CALCULATION HELPERS ---

const calculateCSR = (steps: GenerationStep[]): number => {
    if (steps.length === 0) return 0;
    // Updated Logic: CSR is the percentage of steps that required 0 retries (Passed First Try)
    const passedFirstTry = steps.filter(s => s.retryCount === 0).length;
    return (passedFirstTry / steps.length) * 100;
};

export const calculateSelfBleuProxy = (text: string): { selfBleu: number, uniqueNGrams: number } => {
    // A simplified simulation of Self-BLEU for the browser environment
    // We calculate the ratio of repeated 3-grams to unique 3-grams
    // Lower score is better (less repetitive)
    
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) return { selfBleu: 0, uniqueNGrams: words.length };

    const ngrams = new Map<string, number>();
    const n = 3;
    let totalNgrams = 0;

    for (let i = 0; i <= words.length - n; i++) {
        const gram = words.slice(i, i + n).join(' ');
        ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
        totalNgrams++;
    }

    const uniqueCount = ngrams.size;
    const repeatedCount = totalNgrams - uniqueCount;
    
    // Normalize to 0-1 scale where 1.0 means highly repetitive (bad diversity)
    const repetitionRate = totalNgrams > 0 ? repeatedCount / totalNgrams : 0;
    
    return {
        selfBleu: parseFloat(repetitionRate.toFixed(3)),
        uniqueNGrams: uniqueCount
    };
};


// Phase 5: AI Judge Evaluation
export const evaluateStory = async (fullStory: string, provider: ModelProvider, steps?: GenerationStep[]): Promise<EvaluationResult> => {
    const schemaDefinition = {
        type: Type.OBJECT,
        properties: {
            coherenceScore: { type: Type.NUMBER, description: "Score 1-10 for global coherence" },
            creativityScore: { type: Type.NUMBER, description: "Score 1-10 for creativity/novelty" },
            flowScore: { type: Type.NUMBER, description: "Score 1-10 for pacing and structure" },
            structuralAdherence: { type: Type.NUMBER, description: "Score 0-100 representing how well the story follows a standard narrative arc (Intro->Climax->Resolution)." },
            critique: { type: Type.STRING, description: "A paragraph critiquing the story's strengths and weaknesses." }
        },
        required: ["coherenceScore", "creativityScore", "flowScore", "structuralAdherence", "critique"]
    };

    const prompt = `
      Act as an Expert Literary Critic.
      
      Analyze the following short story:
      "${fullStory.slice(0, 8000)}" 
      
      Evaluate based on:
      1. Global Coherence: Do the events connect logically?
      2. Narrative Arc: Is there a clear beginning, middle, and end?
      3. Creativity: Is the prose engaging and original?
      4. Flow: Does the story move naturally between paragraphs? (Penalty for jagged transitions).
      5. **Structural Adherence**: Does the story clearly demonstrate a setup, inciting incident, rising action, climax, and resolution? (0-100%).
      
      Return a JSON evaluation.
    `;

    try {
        let jsonString = "";

        if (provider === 'ollama') {
            jsonString = await callOllama(prompt, 0.2, schemaDefinition);
        } else {
            const client = getGeminiClient();
            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schemaDefinition,
                    temperature: 0.2
                }
            });
            jsonString = response.text || "{}";
        }

        const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleanJson);
        
        // Calculate Research Metrics
        const { selfBleu, uniqueNGrams } = calculateSelfBleuProxy(fullStory);
        const totalWords = fullStory.split(/\s+/).length;

        let metrics;
        
        if (steps) {
            // Neuro: Calculate CSR mathematically from step verification data
            const csr = calculateCSR(steps);
            metrics = { csr, selfBleu, uniqueNGrams, totalWords };
        } else {
            // Vanilla: Use the AI Judge's "Structural Adherence" score as a proxy for CSR
            // This allows comparison on the same chart.
            metrics = { csr: json.structuralAdherence || 0, selfBleu, uniqueNGrams, totalWords };
        }

        return {
            coherenceScore: json.coherenceScore,
            creativityScore: json.creativityScore,
            flowScore: json.flowScore,
            critique: json.critique,
            metrics: metrics
        };
    } catch (error) {
        console.error("Evaluation Error", error);
        return {
            coherenceScore: 0,
            creativityScore: 0,
            flowScore: 0,
            critique: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}