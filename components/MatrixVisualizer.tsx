import React, { useState } from 'react';
import { EventType, TransitionMatrix } from '../types';
import { EVENT_TYPES } from '../constants';
import { Download, Info, HelpCircle, ArrowRight, BookOpen } from 'lucide-react';

interface MatrixVisualizerProps {
  matrix: TransitionMatrix;
  stepIndex: number;
  highlightFrom?: EventType;
  highlightTo?: EventType;
}

const MatrixVisualizer: React.FC<MatrixVisualizerProps> = ({ matrix, stepIndex, highlightFrom, highlightTo }) => {
  const [showInfo, setShowInfo] = useState(false);

  // Determine color intensity based on probability
  const getColor = (prob: number, isHighlighted: boolean) => {
    // Green base color
    const intensity = Math.min(255, Math.floor(prob * 255 * 3)); // Boost visibility of low probs
    const bg = `rgba(16, 185, 129, ${prob})`; // Tailwind emerald-500 equivalent
    
    if (isHighlighted) {
      return `rgba(245, 158, 11, 0.9)`; // Amber-500 for selected path
    }
    return bg;
  };

  const downloadSystem1Doc = () => {
      const content = `# System 1: Sembolik Planlayıcı (Markov Zincirleri) Analizi

## 1. Modülün Amacı
Bu modül, hikayenin "ne anlatacağını" belirleyen mantıksal katmandır. Büyük Dil Modellerinin (LLM) en büyük sorunu olan "uzun vadeli tutarlılık kaybını" (loss of coherence) önlemek için tasarlanmıştır.

## 2. Matematiksel Model
Sistem, hikayeyi $T=0$ anından $T=14$ anına kadar ayrık zaman dilimlerine (Time Slices) böler. Her adımda bir **Markov Zinciri** çalıştırır.

### Formül
Bir sonraki olayın seçilme olasılığı şu koşullu olasılık ile hesaplanır:

$$ P(E_{t+1} | E_t, M_t) $$

Burada:
*   $E_t$: Şu anki olay türü (Örn: Inciting Incident)
*   $E_{t+1}$: Bir sonraki aday olay türü
*   $M_t$: Hikayenin o anki evresine (Giriş, Gelişme, Sonuç) uygun geçiş matrisi.

## 3. Matris Okuma Kılavuzu
Görselleştiricideki 9x9 ızgara şu anlama gelir:
*   **SATIRLAR (Y-Ekseni):** "Neredeyiz?" (Mevcut Durum)
*   **SÜTUNLAR (X-Ekseni):** "Nereye Gidebiliriz?" (Gelecek Durum)
*   **HÜCRE RENGİ:** Geçiş olasılığının gücü. Koyu yeşil, yüksek olasılık demektir.
*   **TURUNCU HÜCRE:** Algoritmanın o an seçtiği gerçek yol.

## 4. Kısıtlamalar (Constraints)
*   **Self-Loop Penalty:** Sistemin aynı olayda (Örn: Sürekli "Dialogue") takılıp kalmasını önlemek için $P(E_x | E_x)$ olasılığı yapay olarak düşürülür.
*   **Zaman Dilimleme (Time Slicing):** Hikaye ilerledikçe matris değişir. Örneğin, "Introduction" olayı $T=10$'dan sonra matematiksel olarak imkansız hale getirilir.

---
PAPER ID: #8821 | Neuro-Symbolic Story Engine
`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `System1_Logic_Reference_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col">
      
      {/* Header Bar */}
      <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded">
                <BookOpen size={14} />
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-200">System 1: Symbolic Planner</h3>
                  <div className="text-[10px] text-slate-400 font-mono">Markov State Transition (T={stepIndex})</div>
              </div>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="text-slate-400 hover:text-white transition-colors"
                title="Nasıl Okunur?"
              >
                  <HelpCircle size={16} />
              </button>
              <button 
                onClick={downloadSystem1Doc}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] px-2 py-1 rounded border border-slate-600 transition-colors"
                title="Teknik Dokümanı İndir"
              >
                  <Download size={12} />
                  Doc
              </button>
          </div>
      </div>

      {/* Explanation Banner */}
      {showInfo && (
          <div className="bg-slate-800/80 p-3 text-[11px] text-slate-300 border-b border-slate-700 space-y-2">
              <p><strong className="text-indigo-400">SATIRLAR (Soldaki):</strong> Mevcut Olay Türü.</p>
              <p><strong className="text-emerald-400">SÜTUNLAR (Üstteki):</strong> Bir Sonraki Olası Olay.</p>
              <p>Hücrelerin koyuluğu, o geçişin matematiksel olasılığını gösterir. <span className="text-amber-400 font-bold">Turuncu</span> hücre, motorun o adımda seçtiği yoldur.</p>
          </div>
      )}

      {/* Visualization Container */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[500px]"> {/* Ensure generic width for small screens */}
            
            {/* Legend / Axis Labels */}
            <div className="flex justify-between items-end mb-2 px-1">
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    Current State (Row) <ArrowRight size={10} /> Next State (Column)
                </span>
                <span className="text-[10px] text-emerald-500/80 italic">
                    Probability Heatmap P(Next|Current)
                </span>
            </div>

            {/* Header Row */}
            <div className="flex mb-1">
            <div className="w-24 shrink-0"></div>
            {EVENT_TYPES.map(type => (
                <div key={type} className="flex-1 text-[9px] uppercase tracking-wider text-center text-slate-500 rotate-0 truncate px-0.5" title={type}>
                {type.substring(0, 4)}
                </div>
            ))}
            </div>

            {/* Matrix Rows */}
            {EVENT_TYPES.map((fromType) => (
            <div key={fromType} className="flex items-center mb-1 hover:bg-slate-800/50 rounded transition-colors">
                <div className={`w-24 shrink-0 text-[10px] font-mono text-right pr-3 truncate ${fromType === highlightFrom ? 'text-amber-400 font-bold' : 'text-slate-400'}`} title={fromType}>
                {fromType.length > 12 ? fromType.substring(0, 10) + '..' : fromType}
                </div>
                
                {EVENT_TYPES.map((toType) => {
                const prob = matrix[fromType][toType] || 0;
                const isSelected = fromType === highlightFrom && toType === highlightTo;
                
                return (
                    <div key={toType} className="flex-1 h-7 mx-0.5 relative group">
                    <div 
                        className={`w-full h-full rounded-[2px] transition-all duration-300 flex items-center justify-center text-[9px] cursor-help ${isSelected ? 'ring-1 ring-amber-400 z-10 scale-105' : ''}`}
                        style={{ backgroundColor: getColor(prob, isSelected) }}
                        title={`P(${toType} | ${fromType}) = ${(prob * 100).toFixed(1)}%`}
                    >
                        <span className={`opacity-0 group-hover:opacity-100 font-bold ${prob > 0.5 ? 'text-slate-900' : 'text-slate-100'}`}>
                        {prob.toFixed(2)}
                        </span>
                    </div>
                    </div>
                );
                })}
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default MatrixVisualizer;