
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Edit3, X, Save, AlertCircle, Clock, Ruler, CheckCircle2, LayoutTemplate } from 'lucide-react';
import { ProcessedImage, TextLine } from '../types';
import { Button } from './Button';

interface ResultCardProps {
  item: ProcessedImage;
  onRefine: (id: string, textLines: TextLine[], instructions: string) => void;
  onRemove: (id: string) => void;
}

const DESIGN_MESSAGES = [
  "Mapping reference composition...",
  "Applying layout paradigm...",
  "Synthesizing high-precision typography...",
  "Extending background textures...",
  "Finalizing brand-compliant rendering...",
];

export const ResultCard: React.FC<ResultCardProps> = ({ item, onRefine, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [localLines, setLocalLines] = useState<TextLine[]>(item.textLines);
  const [loadMsgIndex, setLoadMsgIndex] = useState(0);

  useEffect(() => {
    let interval: any;
    if (item.status === 'loading') {
      interval = setInterval(() => {
        setLoadMsgIndex((prev) => (prev + 1) % DESIGN_MESSAGES.length);
      }, 3000);
    } else {
      setLoadMsgIndex(0);
    }
    return () => clearInterval(interval);
  }, [item.status]);

  const handleDownload = () => {
    if (item.generatedImage) {
      const link = document.createElement('a');
      link.href = item.generatedImage;
      link.download = `poster-${item.language}-${item.width}x${item.height}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUpdateLine = (id: string, field: 'original' | 'translation', val: string) => {
    setLocalLines(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  const handleRefineSubmit = () => {
    onRefine(item.id, localLines, instruction);
    setIsEditing(false);
  };

  const getStrategyLabel = (ar: string) => {
    if (ar === '16:9' || ar === '4:3') return "Side-by-Side Split";
    if (ar === '9:16') return "Vertical Hierarchical Stack";
    return "Balanced Central Layout";
  };

  return (
    <div className={`bg-white border transition-all duration-500 rounded-none ${item.status === 'loading' ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-200'} flex flex-col h-full shadow-sm`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">{item.language}</span>
            <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 font-bold uppercase rounded-sm">Master Asset</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Ruler size={10} />
            <p className="text-[10px] font-bold uppercase tracking-tighter">
              {item.width} x {item.height} px
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-slate-200/50 rounded-full border border-slate-200">
             <LayoutTemplate size={10} className="text-slate-500" />
             <span className="text-[9px] font-black uppercase text-slate-500">{getStrategyLabel(item.aspectRatio)}</span>
          </div>
          <button onClick={() => onRemove(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-col lg:flex-row flex-grow min-h-[500px]">
        {/* Manifest Sidebar */}
        <div className="w-full lg:w-64 bg-slate-50 border-r border-slate-100 p-4 space-y-4 overflow-y-auto max-h-[500px] lg:max-h-none">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <CheckCircle2 size={10} />
            Translation Manifest
          </h4>
          {item.textLines.map((line, i) => (
            <div key={line.id} className="p-3 bg-white border border-slate-200 rounded-sm shadow-sm">
              <p className="text-[8px] text-slate-400 font-bold uppercase mb-1">Block {i+1}</p>
              <p className="text-[10px] font-black text-slate-800 leading-tight">{line.translation}</p>
            </div>
          ))}
        </div>

        {/* Image Preview Area */}
        <div className="relative flex-grow bg-slate-100 flex items-center justify-center overflow-hidden">
          {item.status === 'loading' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] block text-blue-700">{DESIGN_MESSAGES[loadMsgIndex]}</span>
                <p className="text-[9px] text-slate-400 font-bold mt-1">Refining pixel-perfect composition...</p>
              </div>
            </div>
          ) : item.status === 'queued' ? (
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Clock size={40} strokeWidth={1} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Synthesis</span>
            </div>
          ) : item.status === 'error' ? (
            <div className="text-center p-8">
              <AlertCircle className="text-red-500 w-12 h-12 mx-auto mb-4" />
              <p className="text-slate-900 font-black text-sm mb-4">Rendering Engine Error</p>
              <Button variant="primary" className="h-10 px-6" onClick={() => onRefine(item.id, item.textLines, "Retry with strict layout adherence")}>
                  Re-generate
              </Button>
            </div>
          ) : item.generatedImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img 
                src={item.generatedImage} 
                alt={item.sizeLabel} 
                className="max-w-full max-h-full object-contain shadow-2xl"
                onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                style={{ opacity: 0, transition: 'opacity 0.8s ease-out' }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-6 bg-white border-t border-slate-100">
        {isEditing ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-3">
              {localLines.map((line) => (
                <div key={line.id} className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Edit Block:</span>
                  <input 
                    type="text" 
                    value={line.translation}
                    onChange={(e) => handleUpdateLine(line.id, 'translation', e.target.value)}
                    className="w-full text-[11px] font-bold bg-slate-50 border border-slate-200 p-2.5 focus:ring-1 focus:ring-blue-500 outline-none rounded-sm"
                  />
                </div>
              ))}
            </div>

            <textarea
              className="w-full text-[11px] p-3 border border-slate-200 bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-none font-medium rounded-sm"
              rows={2}
              placeholder="Refine Art Direction (e.g. 'Align text to the bottom left corner')..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1 h-10 text-[10px] font-black uppercase" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button variant="primary" className="flex-[2] h-10 bg-blue-600 text-[10px] font-black uppercase" onClick={handleRefineSubmit} icon={<Save size={14}/>}>
                 Apply Correction
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <Button 
              variant="secondary" 
              className="flex-1 h-12 text-[10px] font-black uppercase border-slate-200" 
              onClick={() => setIsEditing(true)}
              icon={<Edit3 size={16} />}
              disabled={item.status === 'loading'}
            >
              Adjust Composition
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 h-12 bg-slate-900 text-[10px] font-black uppercase" 
              onClick={handleDownload}
              icon={<Download size={18} />}
              disabled={item.status !== 'success'}
            >
              Download Export
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
