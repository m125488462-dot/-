export interface TextLine {
  id: string;
  original: string;
  translation: string;
}

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface ProcessedImage {
  id: string;
  originalImage: string; 
  generatedImage: string | null; 
  language: string;
  width: number;
  height: number;
  aspectRatio: string;
  sizeLabel: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'queued';
  errorMessage?: string;
  feedback?: string; 
  textLines: TextLine[];
}

export interface AppConfig {
  selectedLanguages: string[];
  selectedSizes: string[]; // IDs of presets
  specialInstructions: string;
  textLines: TextLine[];
  customBackgrounds: Record<string, string>; // Aspect ratio -> base64
}

export enum SupportedLanguage {
  English = 'English',
  Chinese = 'Chinese (Simplified)',
  Spanish = 'Spanish',
  French = 'French',
  German = 'German',
  Japanese = 'Japanese',
  Korean = 'Korean',
  Portuguese = 'Portuguese',
  Russian = 'Russian',
  Arabic = 'Arabic'
}