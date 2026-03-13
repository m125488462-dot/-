import JSZip from 'jszip';
import { ProcessedImage } from '../types';

export const downloadAllAsZip = async (items: ProcessedImage[]) => {
  const zip = new JSZip();
  const folder = zip.folder("translated_images");

  if (!folder) return;

  const successfulItems = items.filter(item => item.status === 'success' && item.generatedImage);

  if (successfulItems.length === 0) return;

  for (const item of successfulItems) {
    if (item.generatedImage) {
      const base64Data = item.generatedImage.split(',')[1];
      folder.file(`${item.language}_${item.width}x${item.height}.png`, base64Data, { base64: true });
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  
  // Trigger download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = "adapted_images.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
