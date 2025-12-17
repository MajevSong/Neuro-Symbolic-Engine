# Neuro-Symbolic Story Engine: Technical Workflow & Methodology

This document outlines the end-to-end workflow of the Neuro-Symbolic Story Engine. The system implements a hybrid AI architecture designed to extract structural knowledge from datasets and strictly enforce that structure during LLM generation.

---

## Phase 1: Knowledge Discovery (Sequence Mining)

Before generation begins, the system must learn the "Shape of Stories" from the provided dataset (`stories.json`). This process is known as **Narrative Archetype Discovery**.

### A. Segmentation & Classification
The engine samples stories from the dataset and processes them through the following pipeline:
1.  **Segmentation:** Each story is split into $N$ discrete temporal chunks (Target: 15 steps).
2.  **Event Classification:** A lightweight LLM classifies each chunk into one of 11 **Event Types** (e.g., `Inciting_Incident`, `Conflict`, `Climax`).
3.  **Path Extraction:** The system maps the full trajectory of every story (e.g., Story A: `Intro` $\to$ `Conflict` $\to$ `Climax`...).

### B. Archetype Clustering & Matrix Construction
1.  **Frequency Analysis:** The system aggregates identical paths to find **"Discovered Paths" (Archetypes)**.
    *   *Example:* If 40% of stories follow the pattern `Intro` $\to$ `Conflict` $\to$ `Resolution`, this becomes a selectable "Golden Path."
2.  **Matrix Construction:** Concurrently, it builds **Time-Sliced Transition Matrices ($T_0$ to $T_{14}$)**.
    *   *Logic:* It calculates the probability $P(E_{t+1} | E_t)$ for every step $t$.
    *   *Result:* A probabilistic model that knows, for instance, that a "Climax" at Step 2 is highly unlikely ($P \approx 0.01$), but at Step 12 is highly likely ($P \approx 0.8$).

---

## Phase 2: Symbolic Planning (System 1 Configuration)

The Symbolic Planner (System 1) determines the blueprint of the story before a single word of prose is written. It operates in two modes:

### Mode A: Archetype Mode (Deterministic)
*   **Input:** The user selects a mined "Golden Path" (e.g., "Twisted Thriller Arc").
*   **Behavior:** The planner **overrides** probabilistic calculations and strictly enforces the mined sequence.
*   **Use Case:** Replicating a specific, proven narrative structure found in the dataset.

### Mode B: Dynamic Markov Mode (Probabilistic)
*   **Input:** No specific path selected.
*   **Behavior:** The planner uses the Transition Matrices to calculate the next step dynamically ($E_{t+1}$) based on the current state ($E_t$) and history constraints.
*   **Use Case:** Generating novel, previously unseen structures that still adhere to the general "rhythm" of the training data.

---

## Phase 3: Neuro-Symbolic Execution (System 2 Generation)

When the protocol runs, the **Neuro-Symbolic Pipeline** executes step-by-step:

1.  **State Selection:** System 1 dictates the `Target Event` (e.g., "Climax") based on the active Mode (A or B).
2.  **Look-Ahead Foreshadowing:** System 1 checks Step $t+1$ to provide "Foreshadowing Context" to the generator.
3.  **Micro-Generation (System 2):**
    *   **Prompt:** A structured prompt is sent to the LLM.
    *   **Context Injection:** Includes the `Target Event`, `Immediate Previous Text`, and `Foreshadowing Instruction`.
    *   **Output:** A short segment (~75-90 words).
4.  **Verification Loop (NLI):**
    *   An automated **Natural Language Inference (NLI)** check runs.
    *   *Premise:* The generated text.
    *   *Hypothesis:* "This text functions as a [Target Event]".
    *   **Pass:** The segment is appended to the story.
    *   **Fail:** The segment is rejected, and the LLM regenerates with higher penalty parameters.

---

## Phase 4: Evaluation & Metrics

The output is compared against a **Vanilla Baseline** (a standard LLM generating the story in one shot).

| Metric | Definition | Research Goal |
| :--- | :--- | :--- |
| **CSR (Constraint Satisfaction Rate)** | % of steps where System 2 satisfied System 1's plan on the *first try*. | Demonstrate high controllability. |
| **Self-BLEU** | Diversity metric measuring n-gram overlap. | Demonstrate that structural constraints do not harm (and often help) vocabulary diversity. |
| **Structure Adherence** | A visual comparison of the Tension Arc. | Show that Neuro-Symbolic stories follow a dramatic curve, while Vanilla stories often "meander" or rush to the end. |

---

## UI Transparency for Researchers

To ensure scientific validity, the interface provides:
*   **Matrix Visualizer:** Displays both the *Probabilistic Heatmap* (Markov) and the *Forced Path* (Archetype) simultaneously.
*   **Prompt Inspection:** "Glass Box" design allows researchers to view the exact prompts sent to the LLM for every single step.
*   **Data Export:** One-click download of the JSON logs containing all prompts, outputs, and NLI verification scores for the appendix.