import { SupportedLanguage, SizePreset } from './types';

export const LANGUAGES = Object.values(SupportedLanguage);

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'story', label: 'Vertical Story (1080 x 1920 px)', width: 1080, height: 1920, aspectRatio: '9:16' },
  { id: 'ig_portrait', label: 'Social Portrait (1080 x 1350 px)', width: 1080, height: 1350, aspectRatio: '3:4' },
  { id: 'banner_hd', label: 'HD Landscape Banner (1920 x 1080 px)', width: 1920, height: 1080, aspectRatio: '16:9' },
  { id: 'fb_meta_ad', label: 'Meta Ad Standard (1200 x 628 px)', width: 1200, height: 628, aspectRatio: '16:9' },
  { id: 'square_hd', label: 'Standard Square (1080 x 1080 px)', width: 1080, height: 1080, aspectRatio: '1:1' },
  { id: 'linkedin_header', label: 'LinkedIn Header (1584 x 396 px)', width: 1584, height: 396, aspectRatio: '16:9' },
  { id: 'google_display', label: 'Google Display (728 x 90 px)', width: 728, height: 90, aspectRatio: '16:9' },
  { id: 'youtube_thumbnail', label: 'YT Thumbnail (1280 x 720 px)', width: 1280, height: 720, aspectRatio: '16:9' },
];

export const MAX_TOTAL_GENERATIONS = 15;
export const MAX_LANGUAGES = 5;