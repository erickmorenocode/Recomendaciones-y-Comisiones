import { api } from './apiClient';
import { supabase } from './supabase';

export const REPORTS_BUCKET = 'recommendation-reports';
export const MAX_REPORT_MB = 20;

export const reportUrl = (positionId: string) => `/api/positions/${positionId}/report`;

export function reportFileError(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'El informe debe ser un archivo PDF';
  if (file.size > MAX_REPORT_MB * 1024 * 1024) return `El PDF no puede superar ${MAX_REPORT_MB} MB`;
  return null;
}

/** Sends the file straight to Storage, since Vercel functions reject large request bodies. */
export async function uploadReport(positionId: string, file: File) {
  if (!supabase) throw new Error('Falta configurar las claves de Supabase');
  const { path, token } = await api<{ path: string; token: string }>(reportUrl(positionId), 'POST');
  const { error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: 'application/pdf' });
  if (error) throw new Error(`No se pudo subir el PDF: ${error.message}`);
  await api(reportUrl(positionId), 'PATCH', { path });
}
