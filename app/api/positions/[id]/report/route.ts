import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ApiError, db, jsonBody, route } from '@/src/lib/api';
import { loadPosition, savePosition } from '@/src/lib/positions';
import { REPORTS_BUCKET } from '@/src/lib/reports';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const SIGNED_URL_SECONDS = 300;

const storage = () => db().storage.from(REPORTS_BUCKET);

function storageFailure(message: string): never {
  console.error(message);
  throw new ApiError(502, 'Error al acceder al almacenamiento de informes');
}

// Opens the report: redirects to a short-lived link so the bucket stays private.
export const GET = route<Context>(async (_req, { params }) => {
  const { report_path: path } = await loadPosition((await params).id);
  if (!path) throw new ApiError(404, 'Esta compra no tiene informe');
  const { data, error } = await storage().createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) storageFailure(error.message);
  return NextResponse.redirect(data.signedUrl);
});

// Step 1 of an upload: authorizes the browser to send one file to Storage.
export const POST = route<Context>(async (_req, { params }) => {
  const { id } = await params;
  const position = await loadPosition(id);
  if (position.report_path) throw new ApiError(409, 'Esta compra ya tiene informe');
  const { data, error } = await storage().createSignedUploadUrl(`${id}/${randomUUID()}.pdf`);
  if (error) storageFailure(error.message);
  return { path: data.path, token: data.token };
});

// Step 2 of an upload: links the stored file to the position.
export const PATCH = route<Context>(async (req, { params }) => {
  const { id } = await params;
  const position = await loadPosition(id);
  if (position.report_path) throw new ApiError(409, 'Esta compra ya tiene informe');

  const { path } = await jsonBody(req);
  if (typeof path !== 'string' || !new RegExp(`^${id}/[0-9a-f-]{36}\\.pdf$`, 'i').test(path)) {
    throw new ApiError(400, 'Ruta de informe no válida');
  }
  const { data: exists, error } = await storage().exists(path);
  if (error) storageFailure(error.message);
  if (!exists) throw new ApiError(400, 'El PDF no llegó al almacenamiento');
  await savePosition(id, { report_path: path });
});
