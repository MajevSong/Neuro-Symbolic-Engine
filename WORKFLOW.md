# Neuro-Symbolic Story Engine: Technical Workflow & Methodology

This document outlines the end-to-end workflow of the Neuro-Symbolic Story Engine. The system implements a hybrid AI architecture designed to improve narrative coherence, structural adherence, and output diversity compared to standard LLM generation.

---

## 1. Initialization & Data Processing (System 1 Setup)

Before generation begins, the Symbolic Planner (System 1) must be initialized. This is done via the **Training Panel**.

### A. Input Data (`stories.json`)
The system accepts a dataset of existing narratives.
*   **Format:** JSON array of objects containing text.
*   **Preprocessing:** The engine uses a local LLM (Mistral-Small via Ollama) or Gemini to tokenize sentences and classify them into 9 distinct **Event Types** (e.g., `Inciting_Incident`, `Conflict`, `Climax`).

### B. Matrix Construction (Markov Chains)
Once classified, the system builds **Time-Sliced Transition Matrices ($T_0$ to $T_{14}$)**.
*   **Logic:** It calculates the probability $P(E_{t+1} | E_t)$ for every step $t$ in the story.
*   **Smoothing:** Laplace smoothing is applied to ensure no transition is mathematically impossible (probability 0), allowing for creative flexibility.
*   **Result:** A set of 9x9 matrices that dictate the "Rhythm" of a story at any given phase (Setup, Development, Resolution).

---

## 2. Simultaneous Execution Protocol (The Experiment)

When the user clicks **"Run Simultaneous Comparison"**, two parallel processes are launched to ensure a fair, apples-to-apples comparison.

### Track A: The Neuro-Symbolic Pipeline (Proposed Method)
This pipeline uses a **Step-by-Step** generation approach controlled by the Symbolic Planner.

1.  **State Selection:**
    *   System 1 looks at the Matrix for the current step.
    *   It selects the next `Target Event` based on weighted probabilities.
    *   *Constraint:* Self-loop penalties are applied to prevent the model from getting stuck in one state (e.g., repeating "Description" 5 times).

2.  **Look-Ahead Foreshadowing (New):**
    *   The system peeks ahead to Step $t+1$ to find the most likely future event.
    *   This "Foreshadowing Event" is passed to the LLM to smoothen transitions.

3.  **Micro-Generation (System 2):**
    *   **Prompt:** A specific, context-aware prompt is sent to the LLM.
    *   **Transparency:** The exact prompt includes the `Target Event`, the `Immediate Context` (last 3 sentences), and the `Foreshadowing Instruction`.
    *   **Output:** A short segment (~80 words).

4.  **Verification Loop (NLI):**
    *   An automated **Natural Language Inference (NLI)** check runs.
    *   *Premise:* The generated text.
    *   *Hypothesis:* "This text functions as a [Target Event]".
    *   If confidence < 0.5, the text is rejected, and the LLM is forced to retry (up to 2 times).

### Track B: The Vanilla Baseline (Control Group)
This pipeline represents the standard usage of LLMs (e.g., ChatGPT, Gemini).

1.  **Global Prompting:**
    *   A single, massive prompt is sent to the model.
    *   **Instruction:** "Write a complete 1200-word story with a clear arc."
    *   **Blind Generation:** The model does not receive step-by-step guidance or feedback during generation.
    *   **Transparency:** The full prompt is visible in the UI for comparison.

---

## 3. Evaluation Metrics

Upon completion, both stories are evaluated by an **AI Critic (System 2 as Judge)** and deterministic algorithms.

| Metric | Definition | Goal |
| :--- | :--- | :--- |
| **CSR (Constraint Satisfaction Rate)** | The percentage of steps where the generated text satisfied the verifyer on the *first try*. | **Higher is better.** Measures how well the generator follows instructions without correction. |
| **Self-BLEU** | A diversity metric measuring n-gram overlap within the text. | **Lower is better.** High scores (e.g., >0.5) indicate repetitive loops or limited vocabulary. |
| **Vocabulary (Unique N-Grams)** | The count of unique 3-word combinations. | **Higher is better.** Indicates lexical richness. |
| **Coherence Score (1-10)** | Subjective evaluation of logical consistency. | **Higher is better.** |
| **Narrative Arc (Tension)** | Visualized as a line chart. | We look for a standard dramatic curve (Rise -> Climax -> Fall). |

---

## 4. User Interface & Transparency

To ensure scientific validity, the interface provides:

*   **Matrix Visualizer:** See the internal probabilities of the Symbolic Planner in real-time.
*   **Prompt Reveal:** Click "Show System Prompt" on any Neuro-Symbolic step to see exactly what was sent to the AI.
*   **Split View:** Compare the "Chunked" Neuro story against the "Monolith" Vanilla story side-by-side.
*   **JSON Export:** Download the full experiment data (Prompts, Outputs, Metrics) for inclusion in the research paper.
