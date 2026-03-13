
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, Check, Download, Sparkles, Palette, Layers, Smartphone, Monitor, Square, Ruler, Type, ArrowRight, RefreshCw, AlertTriangle, Languages, XCircle, Layout } from 'lucide-react';
import { LANGUAGES, MAX_LANGUAGES, SIZE_PRESETS, MAX_TOTAL_GENERATIONS } from './constants';
import { ProcessedImage, AppConfig, TextLine, SizePreset } from './types';
import { generateAdaptedImage, extractTextLines, translateLines } from './services/geminiService';
import { ResultCard } from './components/ResultCard';
import { Button } from './components/Button';
import { downloadAllAsZip } from './utils/zipUtils';

interface LanguageTranslationSet {
  language: string;
  lines: TextLine[];
  isTranslating: boolean;
  isConfirmed: boolean;
  error?: string;
}

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(true);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [config, setConfig] = useState<AppConfig>({
    selectedLanguages: [],
    selectedSizes: ['square_hd'],
    specialInstructions: '',
    textLines: [],
    customBackgrounds: {},
  });
  
  const [languageTranslations, setLanguageTranslations] = useState<LanguageTranslationSet[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedImage[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [customSizes, setCustomSizes] = useState<SizePreset[]>([]);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  const allSizes = [...SIZE_PRESETS, ...customSizes];

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        try {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (e) {
          console.error("Error checking API key", e);
        }
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      try {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Error opening select key", e);
      }
    }
  };

  const performAutoTranslate = useCallback(async (lang: string, baseLines: TextLine[]) => {
    if (baseLines.length === 0) return;
    
    setLanguageTranslations(prev => prev.map(p => p.language === lang ? { ...p, isTranslating: true, error: undefined } : p));
    try {
      const originals = baseLines.map(l => l.original);
      const results = await translateLines(originals, lang);
      setLanguageTranslations(prev => prev.map(p => {
        if (p.language === lang) {
          return {
            ...p,
            isTranslating: false,
            lines: p.lines.map((line, i) => ({ ...line, translation: results[i] || line.original }))
          };
        }
        return p;
      }));
    } catch (err: any) {
      setLanguageTranslations(prev => prev.map(p => p.language === lang ? { ...p, isTranslating: false, error: "Auto-translate failed." } : p));
    }
  }, []);

  useEffect(() => {
    if (isExtracting || config.textLines.length === 0) return;

    setLanguageTranslations(prev => {
      const updatedSets = config.selectedLanguages.map(lang => {
        const existing = prev.find(p => p.language === lang);
        if (existing && existing.lines.length === config.textLines.length) return existing;
        
        const newSet: LanguageTranslationSet = {
          language: lang,
          lines: config.textLines.map(line => ({ ...line, translation: '' })),
          isTranslating: false,
          isConfirmed: false
        };
        performAutoTranslate(lang, config.textLines);
        return newSet;
      });
      return updatedSets;
    });
  }, [config.selectedLanguages, config.textLines, isExtracting, performAutoTranslate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalError(null);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setSourceImage(base64);
        setProcessedItems([]);
        setIsExtracting(true);
        try {
          setLanguageTranslations([]);
          const lines = await extractTextLines(base64);
          const mappedLines = lines.map((text, i) => ({ id: `line-${i}`, original: text, translation: '' }));
          setConfig(prev => ({ ...prev, textLines: mappedLines }));
        } catch (err: any) {
          setGlobalError("OCR Scan Error: " + (err.message || "Failed to analyze image."));
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const updateTranslationField = (lang: string, lineId: string, val: string) => {
    setLanguageTranslations(prev => prev.map(p => {
      if (p.language === lang) {
        return {
          ...p,
          lines: p.lines.map(l => l.id === lineId ? { ...l, translation: val } : l)
        };
      }
      return p;
    }));
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>, aspectRatio: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({
          ...prev,
          customBackgrounds: {
            ...prev.customBackgrounds,
            [aspectRatio]: reader.result as string
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const startBatchProcessing = async () => {
    if (!sourceImage || config.selectedLanguages.length === 0 || config.selectedSizes.length === 0) return;
    
    setIsProcessingAll(true);
    setGlobalError(null);
    
    const queue: ProcessedImage[] = [];
    config.selectedLanguages.forEach(lang => {
      const langSet = languageTranslations.find(s => s.language === lang);
      config.selectedSizes.forEach(sizeId => {
        const preset = allSizes.find(s => s.id === sizeId);
        if (preset && langSet) {
          queue.push({
            id: `${lang}-${sizeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalImage: sourceImage,
            generatedImage: null,
            language: lang,
            width: preset.width,
            height: preset.height,
            aspectRatio: preset.aspectRatio,
            sizeLabel: preset.label,
            status: 'queued', 
            textLines: [...langSet.lines], 
          });
        }
      });
    });

    setProcessedItems(queue);

    for (const item of queue) {
      setProcessedItems(prev => prev.map(p => p.id === item.id ? {...p, status: 'loading'} : p));
      try {
        const resultImage = await generateAdaptedImage(
          item.originalImage, 
          item.aspectRatio, 
          item.width,
          item.height,
          item.language,
          item.textLines,
          config.specialInstructions,
          config.customBackgrounds[item.aspectRatio]
        );
        setProcessedItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'success', generatedImage: resultImage } : p));
        await new Promise(r => setTimeout(r, 1000)); 
      } catch (err: any) {
        setProcessedItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'error', errorMessage: err.message || "Pipeline stalled." } : p
        ));
      }
    }
    setIsProcessingAll(false);
  };

  const handleRefine = async (id: string, updatedLines: TextLine[], instructions: string) => {
    const item = processedItems.find(p => p.id === id);
    if (!item) return;

    setProcessedItems(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'loading', textLines: updatedLines, feedback: instructions } : p
    ));

    try {
      const resultImage = await generateAdaptedImage(
        item.originalImage, 
        item.aspectRatio, 
        item.width,
        item.height,
        item.language,
        updatedLines,
        instructions || config.specialInstructions,
        config.customBackgrounds[item.aspectRatio]
      );

      setProcessedItems(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'success', generatedImage: resultImage, feedback: undefined } : p
      ));
    } catch (err: any) {
      setProcessedItems(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'error', errorMessage: err.message } : p
      ));
    }
  };

  const getSizeIcon = (aspect: string) => {
    if (aspect === '1:1') return <Square size={14} />;
    if (aspect === '9:16') return <Smartphone size={14} />;
    return <Monitor size={14} />;
  };

  const handleAddCustomSize = () => {
    const w = parseInt(customWidth);
    const h = parseInt(customHeight);
    if (!w || !h || w <= 0 || h <= 0) return;

    const SUPPORTED_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"];
    const targetRatio = w / h;
    let closestRatio = "1:1";
    let minDiff = Infinity;

    for (const ratio of SUPPORTED_ASPECT_RATIOS) {
      const [rw, rh] = ratio.split(':').map(Number);
      const currentRatio = rw / rh;
      const diff = Math.abs(currentRatio - targetRatio);
      if (diff < minDiff) {
        minDiff = diff;
        closestRatio = ratio;
      }
    }

    const newSize: SizePreset = {
      id: `custom_${w}x${h}_${Date.now()}`,
      label: `Custom (${w} x ${h} px)`,
      width: w,
      height: h,
      aspectRatio: closestRatio,
    };

    setCustomSizes(prev => [...prev, newSize]);
    setConfig(prev => ({
      ...prev,
      selectedSizes: [...prev.selectedSizes, newSize.id]
    }));
    setCustomWidth('');
    setCustomHeight('');
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">API Key Required</h2>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">
            To use the latest high-quality <b>Nano Banana 2</b> (Gemini 3.1 Flash Image) model for perfect text rendering and style matching, you need to select a paid Google Cloud API key.
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold hover:underline">Learn more about billing</a>
          </p>
          <Button onClick={handleSelectKey} className="w-full py-4 text-base font-bold bg-slate-900 hover:bg-black text-white rounded-xl transition-all shadow-lg hover:shadow-xl">
            Select API Key
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-full md:w-[540px] bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-screen overflow-y-auto sticky top-0 shadow-2xl z-30">
        <div className="p-8 border-b border-slate-100 bg-white/95 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-3">
             <div className="bg-slate-900 p-2.5 rounded-none shadow-xl">
               <Sparkles className="text-white" size={24} />
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none uppercase">Studio Engine</h1>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1.5">Precision Poster Localization</p>
             </div>
          </div>
        </div>

        {globalError && (
          <div className="m-8 p-4 bg-red-50 border-l-4 border-red-500 flex gap-3">
            <XCircle className="text-red-500 shrink-0" size={18} />
            <p className="text-[10px] text-red-600 font-bold">{globalError}</p>
          </div>
        )}

        <div className="p-8 space-y-12 flex-grow pb-48">
          <section>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-5">
              <ImageIcon size={14} className="text-slate-900" />
              1. Brand Asset
            </h2>
            <div className={`relative group border-2 border-dashed transition-all duration-500 ${sourceImage ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400 bg-slate-50'}`}>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="p-6 text-center">
                {sourceImage ? (
                  <div className="relative">
                    <img src={sourceImage} alt="Source" className="w-full h-48 object-contain bg-white p-3 border border-slate-100" />
                    {isExtracting && (
                      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center">
                         <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center text-slate-300">
                    <Upload size={30} strokeWidth={1} className="mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Import Reference Poster</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={!sourceImage ? 'opacity-40 pointer-events-none' : ''}>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5 flex items-center gap-2">
              <Ruler size={14} className="text-slate-900" />
              2. Target Dimensions
            </h2>
            <div className="grid grid-cols-1 gap-2 mb-4">
              {allSizes.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    selectedSizes: prev.selectedSizes.includes(preset.id) ? prev.selectedSizes.filter(s => s !== preset.id) : [...prev.selectedSizes, preset.id]
                  }))}
                  className={`flex items-center gap-4 px-5 py-3.5 border transition-all duration-300 ${config.selectedSizes.includes(preset.id) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}
                >
                  {getSizeIcon(preset.aspectRatio)}
                  <div className="flex flex-col text-left flex-grow">
                    <span className="text-[10px] font-black uppercase">{preset.label.split('(')[0]}</span>
                    <span className={`text-[9px] font-bold ${config.selectedSizes.includes(preset.id) ? 'text-slate-400' : 'text-slate-300'}`}>{preset.width}x{preset.height}</span>
                  </div>
                  {config.selectedSizes.includes(preset.id) && <Check size={14} strokeWidth={4} />}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-3 border border-slate-200">
              <input
                type="number"
                placeholder="Width"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-full bg-white border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-slate-400"
              />
              <span className="text-slate-400 text-[10px] font-black">X</span>
              <input
                type="number"
                placeholder="Height"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                className="w-full bg-white border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-slate-400"
              />
              <button
                onClick={handleAddCustomSize}
                disabled={!customWidth || !customHeight}
                className="bg-slate-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-wider disabled:opacity-50 hover:bg-black transition-colors"
              >
                Add
              </button>
            </div>
          </section>

          <section className={!sourceImage ? 'opacity-40 pointer-events-none' : ''}>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-5">
              <ImageIcon size={14} className="text-slate-900" />
              3. Background Reference (Optional)
            </h2>
            <div className="space-y-3">
              {Array.from(new Set(config.selectedSizes.map(id => allSizes.find(s => s.id === id)?.aspectRatio))).filter(Boolean).map(aspectRatio => (
                <div key={aspectRatio} className="flex items-center justify-between p-3 bg-white border border-slate-200">
                  <span className="text-[10px] font-black uppercase">{aspectRatio} Reference</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleBackgroundUpload(e, aspectRatio as string)} 
                    className="text-[10px]"
                  />
                  {config.customBackgrounds[aspectRatio as string] && <Check size={14} className="text-emerald-500" />}
                </div>
              ))}
              {config.selectedSizes.length === 0 && (
                <p className="text-[10px] text-slate-400">Select target dimensions first.</p>
              )}
            </div>
          </section>

          <section className={!sourceImage ? 'opacity-40 pointer-events-none' : ''}>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-5">
              <Languages size={14} className="text-slate-900" />
              4. Target Markets
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang}
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    selectedLanguages: prev.selectedLanguages.includes(lang) ? prev.selectedLanguages.filter(l => l !== lang) : (prev.selectedLanguages.length < MAX_LANGUAGES ? [...prev.selectedLanguages, lang] : prev.selectedLanguages)
                  }))}
                  className={`flex items-center justify-between px-4 py-3 border transition-all duration-300 ${config.selectedLanguages.includes(lang) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                >
                  <span className="text-[10px] font-black uppercase">{lang}</span>
                  {config.selectedLanguages.includes(lang) && <Check size={12} strokeWidth={4} />}
                </button>
              ))}
            </div>
          </section>

          <section className={!sourceImage ? 'opacity-40 pointer-events-none' : ''}>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-5">
              <Layout size={14} className="text-slate-900" />
              5. Composition Strategy
            </h2>
            <div className="space-y-3">
              <p className="text-[9px] text-slate-400 font-bold uppercase mb-2">Art Direction (e.g. "Move product to bottom right", "Extend dark blue gradient background")</p>
              <textarea 
                className="w-full text-xs font-bold p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 outline-none transition-all resize-none min-h-[100px]"
                placeholder="Specific layout or background expansion notes..."
                value={config.specialInstructions}
                onChange={(e) => setConfig(prev => ({ ...prev, specialInstructions: e.target.value }))}
              />
            </div>
          </section>

          {config.selectedLanguages.length > 0 && config.textLines.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                  <Type size={14} className="text-slate-900" />
                  6. Translation Manifest
                </h2>
              </div>

              <div className="space-y-10">
                {languageTranslations.map((langSet) => (
                  <div key={langSet.language} className="bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center px-5 py-3 bg-white border-b border-slate-200">
                      <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{langSet.language}</span>
                      {langSet.isTranslating && <RefreshCw size={12} className="animate-spin text-indigo-600" />}
                    </div>
                    
                    <div className="p-5 space-y-8">
                      {langSet.lines.map((line) => (
                        <div key={line.id} className="space-y-2">
                          <span className="text-[8px] text-slate-400 font-bold uppercase block px-1 truncate">Source: {line.original}</span>
                          <textarea 
                            value={line.translation}
                            onChange={(e) => updateTranslationField(langSet.language, line.id, e.target.value)}
                            className="w-full text-xs font-bold p-4 bg-white border border-slate-200 focus:border-indigo-500 outline-none transition-all resize-none min-h-[70px]"
                            placeholder="Confirm precise translation..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="p-8 border-t border-slate-200 bg-white sticky bottom-0 z-50">
          <Button 
            className="w-full py-7 rounded-none text-lg font-black bg-slate-900 hover:bg-black text-white shadow-2xl transition-all" 
            onClick={startBatchProcessing}
            disabled={!sourceImage || config.selectedLanguages.length === 0 || config.selectedSizes.length === 0 || isProcessingAll}
            isLoading={isProcessingAll}
          >
            {isProcessingAll ? 'Executing Composition...' : 'Generate Assets'}
          </Button>
          <div className="flex items-center justify-center gap-2 mt-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <Check size={10} className="text-emerald-500" />
            Adaptive Layout Active
          </div>
        </div>
      </div>

      <div className="flex-grow p-10 md:p-20 h-screen overflow-y-auto bg-slate-50">
        <header className="flex justify-between items-end mb-24">
          <div className="space-y-3">
             <h2 className="text-8xl font-black text-slate-900 tracking-tighter leading-none">Studio</h2>
             <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.5em] ml-2">High-Precision Asset Adaptation</p>
          </div>
          {processedItems.some(i => i.status === 'success') && (
            <Button variant="secondary" onClick={() => downloadAllAsZip(processedItems)} icon={<Download size={18} />} className="rounded-none px-12 h-16 border-2 border-slate-900 bg-white font-black hover:bg-slate-50">
              Export Package
            </Button>
          )}
        </header>

        {processedItems.length === 0 ? (
          <div className="h-[70vh] flex flex-col items-center justify-center bg-white border border-slate-200">
            <Layers size={60} strokeWidth={0.5} className="text-slate-100 mb-6" />
            <p className="text-lg font-black text-slate-900 tracking-tight uppercase">Upload Poster to Start</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 pb-48">
            {processedItems.map(item => (
              <ResultCard 
                key={item.id} 
                item={item} 
                onRefine={handleRefine} 
                onRemove={(id) => setProcessedItems(p => p.filter(x => x.id !== id))} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
