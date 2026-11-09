import { CircleDollarSign, FileText, LoaderCircle, Pencil, Trash2, Undo2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiClientError, errorMessage } from '../../lib/apiClient';
import type { CutResult } from '../../lib/commissions';
import { cn } from '../../lib/cn';
import { reportFileError, reportUrl, uploadReport } from '../../lib/reports';
import type { Movement, PositionView, TraderDetail } from '../../lib/types';
import { AnalystRatingsHover } from './AnalystRatingsHover';
import { NewPositionForm } from './NewPositionForm';
import {
  Alert,
  Card,
  Field,
  inputClass,
  money,
  primaryButton,
  quantity,
  rowAction,
  secondaryButton,
  SignedMoney,
  TableFrame,
  Td,
  Th,
} from './ui';

type Panel = { mode: 'sell' | 'edit'; position: PositionView };

const ACTION_LABELS: Record<string, string> = {
  compra_registrada: 'Compra registrada',
  compra_editada: 'Compra editada',
  compra_eliminada: 'Compra eliminada',
  venta_registrada: 'Venta registrada',
  venta_editada: 'Venta editada',
  venta_revertida: 'Venta revertida',
  perfil_editado: 'Perfil editado',
  ciclo_editado: 'Inicio de ciclo editado',
};

const FIELD_LABELS: Record<string, string> = {
  buy_price: 'Precio de compra',
  shares: 'Acciones',
  buy_date: 'Fecha de compra',
  sell_price: 'Precio de venta',
  sell_date: 'Fecha de venta',
  name: 'Nombre',
  cycle_start: 'Inicio de ciclo',
};

const COMMISSION_ROWS: Array<{ label: string; key: keyof CutResult; strong?: boolean }> = [
  { label: 'Total recomendado (base)', key: 'baseCapital' },
  { label: 'Umbral de pérdida (10%)', key: 'threshold' },
  { label: 'Resultado realizado acumulado', key: 'realizedCum' },
  { label: 'Resultado de posiciones abiertas', key: 'openResult' },
  { label: 'Resultado neto a mercado', key: 'marketResult', strong: true },
  { label: 'Resultado realizado en el semestre', key: 'semesterRealized' },
  { label: 'Ganancia pendiente de cortes anteriores', key: 'pendingBefore' },
  { label: 'Participación del operador (20%)', key: 'participation', strong: true },
  { label: 'Ganancia que queda pendiente', key: 'pendingAfter' },
  { label: 'Descuento definitivo acumulado', key: 'discountCum' },
  { label: 'Retención vigente', key: 'retention' },
  { label: 'Saldo del corte', key: 'cutBalance' },
  { label: 'Consolidado: a cobrar (+) o a deber (−)', key: 'net', strong: true },
];

const dateTime = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'medium' });

function describeMovement(movement: Movement): string {
  const { before, after } = movement;
  if (!after) return '';
  if (!before) return `${quantity(Number(after.shares))} acciones a ${after.buy_price} el ${after.buy_date}`;
  const changes = Object.keys(FIELD_LABELS)
    .filter((field) => field in after && before[field] !== after[field])
    .map((field) => `${FIELD_LABELS[field]}: ${before[field] ?? 'sin valor'} → ${after[field] ?? 'sin valor'}`);
  if (after.report_path && before.report_path !== after.report_path) changes.push('Informe PDF adjuntado');
  return changes.join(' · ');
}

function ReportCell({ position, run }: { position: PositionView; run: (action: () => Promise<unknown>) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);

  if (position.hasReport) {
    return (
      <a className={rowAction} href={reportUrl(position.id)} target="_blank" rel="noopener noreferrer" title="Ver PDF" aria-label="Ver PDF">
        <FileText size={16} />
      </a>
    );
  }
  if (uploading) {
    return (
      <span className={rowAction} role="status" title="Subiendo PDF" aria-label="Subiendo PDF">
        <LoaderCircle size={16} className="animate-spin" />
      </span>
    );
  }

  async function upload(file: File) {
    setUploading(true);
    await run(async () => {
      const problem = reportFileError(file);
      if (problem) throw new Error(problem);
      await uploadReport(position.id, file);
    });
    setUploading(false);
  }

  return (
    <label className={cn(rowAction, 'cursor-pointer focus-within:text-accent')} title="Subir PDF">
      <Upload size={16} />
      <input
        className="sr-only"
        aria-label="Subir PDF"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
    </label>
  );
}

function PositionPanel({
  panel,
  onCancel,
  onSubmit,
}: {
  panel: Panel;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const { mode, position } = panel;
  const editing = mode === 'edit';
  const [values, setValues] = useState({
    buyPrice: String(position.buyPrice),
    shares: String(position.shares),
    buyDate: position.buyDate,
    sellPrice: position.sellPrice != null ? String(position.sellPrice) : position.marketPrice != null ? String(position.marketPrice) : '',
    sellDate: position.sellDate ?? '',
  });
  const showSale = !editing || position.sellDate !== null;
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-accent/40 p-4 space-y-3">
      <p className="text-xs">
        {editing ? 'Editar' : 'Registrar venta de'} <span className="font-mono text-accent">{position.ticker}</span> {position.companyName}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {editing && (
          <>
            <Field label="Precio de compra (USD)">
              <input className={inputClass} type="number" min="0" step="any" value={values.buyPrice} onChange={(e) => set('buyPrice', e.target.value)} required />
            </Field>
            <Field label="Número de acciones">
              <input className={inputClass} type="number" min="0" step="any" value={values.shares} onChange={(e) => set('shares', e.target.value)} required />
            </Field>
            <Field label="Fecha de compra">
              <input className={inputClass} type="date" value={values.buyDate} onChange={(e) => set('buyDate', e.target.value)} required />
            </Field>
          </>
        )}
        {showSale && (
          <>
            <Field label="Precio de venta (USD)">
              <input className={inputClass} type="number" min="0" step="any" value={values.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} required />
            </Field>
            <Field label="Fecha de venta">
              <input className={inputClass} type="date" value={values.sellDate} onChange={(e) => set('sellDate', e.target.value)} required />
            </Field>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" className={primaryButton}>Guardar</button>
        <button type="button" className={secondaryButton} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export function TraderProfile({
  traderId,
  onChanged,
  onSessionExpired,
}: {
  traderId: number;
  onChanged: () => void;
  onSessionExpired: () => void;
}) {
  const [detail, setDetail] = useState<TraderDetail | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [name, setName] = useState('');

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiClientError && e.status === 401) onSessionExpired();
      else setError(errorMessage(e));
    },
    [onSessionExpired],
  );

  const load = useCallback(async () => {
    try {
      const [nextDetail, history] = await Promise.all([
        api<TraderDetail>(`/api/traders/${traderId}`),
        api<{ movements: Movement[] }>(`/api/traders/${traderId}/movements`),
      ]);
      setDetail(nextDetail);
      setName(nextDetail.name);
      setMovements(history.movements);
    } catch (e) {
      handleError(e);
    }
  }, [traderId, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAfterChange() {
    await load();
    onChanged();
  }

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      setPanel(null);
      await refreshAfterChange();
    } catch (e) {
      handleError(e);
    }
  }

  if (!detail) {
    return error ? <Alert>{error}</Alert> : <p className="text-sm text-ink/60 p-6">Cargando perfil...</p>;
  }

  const lastCut = detail.commissions?.cuts.at(-1);
  const saveName = () => run(() => api(`/api/traders/${traderId}`, 'PATCH', { name }));

  const stats = [
    { label: 'Total recomendado (USD)', value: <>{money(detail.totalRecommended)}</> },
    { label: 'Umbral de pérdida, 10% (USD)', value: <>{money(detail.totalRecommended * 0.1)}</> },
    { label: 'Resultado neto a mercado (USD)', value: lastCut ? <SignedMoney value={lastCut.marketResult} /> : 'Sin calcular' },
    { label: 'Consolidado a cobrar o deber (USD)', value: lastCut ? <SignedMoney value={lastCut.net} /> : 'Sin calcular' },
  ];

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 max-w-sm">
          <Field label={`Perfil ${detail.id} de 11`}>
            <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <button type="button" className={secondaryButton} disabled={name.trim() === detail.name} onClick={saveName}>
          Guardar nombre
        </button>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <dd className="text-xl font-mono">{stat.value}</dd>
            <dt className="text-xs text-ink/60 mt-1">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <NewPositionForm traderId={traderId} onSaved={refreshAfterChange} />

      <Card title="Posiciones">
        {detail.positions.length === 0 ? (
          <p className="text-sm text-ink/60">Este perfil aún no tiene compras registradas.</p>
        ) : (
          <TableFrame>
            <thead>
              <tr className="border-b border-border">
                <Th>Empresa</Th>
                <Th>Compra</Th>
                <Th right>Acciones</Th>
                <Th right>Precio compra</Th>
                <Th right>Total (USD)</Th>
                <Th right>Mercado / venta</Th>
                <Th right>Resultado (USD)</Th>
                <Th>Estado</Th>
                <Th>Informe</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {detail.positions.map((position) => (
                <tr key={position.id} className="border-b border-border/50 last:border-b-0">
                  <Td>
                    <span className="font-mono text-accent">{position.ticker}</span>
                    <AnalystRatingsHover symbol={position.ticker}>{position.companyName}</AnalystRatingsHover>
                  </Td>
                  <Td className="whitespace-nowrap font-mono">{position.buyDate}</Td>
                  <Td right>{quantity(position.shares)}</Td>
                  <Td right>{money(position.buyPrice)}</Td>
                  <Td right>{money(position.total)}</Td>
                  <Td right>
                    {position.sellPrice != null
                      ? money(position.sellPrice)
                      : position.marketPrice != null
                        ? money(position.marketPrice)
                        : 'Sin precio'}
                  </Td>
                  <Td right>{position.result != null ? <SignedMoney value={position.result} /> : 'Sin precio'}</Td>
                  <Td className="whitespace-nowrap">
                    {position.sellDate ? `Vendida ${position.sellDate}` : 'Abierta'}
                    {!position.inCycle && <span className="block text-danger">Fuera del ciclo</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <ReportCell position={position} run={run} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      {position.sellDate === null ? (
                        <button type="button" className={rowAction} title="Vender" aria-label="Vender" onClick={() => setPanel({ mode: 'sell', position })}>
                          <CircleDollarSign size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={rowAction}
                          title="Revertir venta"
                          aria-label="Revertir venta"
                          onClick={() => run(() => api(`/api/positions/${position.id}`, 'PATCH', { action: 'unsell' }))}
                        >
                          <Undo2 size={16} />
                        </button>
                      )}
                      <button type="button" className={rowAction} title="Editar" aria-label="Editar" onClick={() => setPanel({ mode: 'edit', position })}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className={rowAction}
                        title="Eliminar"
                        aria-label="Eliminar"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la compra de ${position.ticker}? Quedará registrada en el histórico.`)) {
                            void run(() => api(`/api/positions/${position.id}`, 'DELETE'));
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {panel && (
          <PositionPanel
            key={`${panel.mode}-${panel.position.id}`}
            panel={panel}
            onCancel={() => setPanel(null)}
            onSubmit={(values) =>
              run(() => api(`/api/positions/${panel.position.id}`, 'PATCH', { action: panel.mode, ...values }))
            }
          />
        )}
      </Card>

      <Card title="Comisiones">
        {!detail.commissions ? (
          <p className="text-sm text-ink/60">Define la fecha de inicio del ciclo para calcular comisiones.</p>
        ) : (
          <>
            {detail.commissions.incomplete && (
              <p role="alert" className="text-xs text-danger">
                {detail.commissions.incomplete.label} no se pudo calcular: Yahoo Finance no devolvió precio para{' '}
                {detail.commissions.incomplete.missing.join(', ')}.
              </p>
            )}
            {detail.commissions.cuts.length === 0 && !detail.commissions.incomplete ? (
              <p className="text-sm text-ink/60">El ciclo aún no ha comenzado.</p>
            ) : (
              detail.commissions.cuts.length > 0 && (
                <TableFrame>
                  <thead>
                    <tr className="border-b border-border">
                      <Th>Concepto (USD)</Th>
                      {detail.commissions.cuts.map((cut) => (
                        <Th key={cut.label} right>
                          {cut.label}
                          <span className="block text-ink/60 normal-case tracking-normal">{cut.date}</span>
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMMISSION_ROWS.map((row) => (
                      <tr key={row.key} className={cn('border-b border-border/50 last:border-b-0', row.strong && 'font-semibold')}>
                        <Td>{row.label}</Td>
                        {detail.commissions!.cuts.map((cut) => (
                          <Td key={cut.label} right>
                            {row.key === 'baseCapital' || row.key === 'threshold' ? (
                              money(cut[row.key])
                            ) : (
                              <SignedMoney value={cut[row.key] as number} />
                            )}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </TableFrame>
              )
            )}
            <p className="text-xs text-ink/60">
              Los cortes usan el precio de cierre de su fecha. La proyección usa el precio actual de Yahoo Finance y cambia con el mercado.
            </p>
          </>
        )}
      </Card>

      <Card title={`Histórico de movimientos (${movements.length})`}>
        {movements.length === 0 ? (
          <p className="text-sm text-ink/60">Sin movimientos registrados.</p>
        ) : (
          <TableFrame>
            <thead>
              <tr className="border-b border-border">
                <Th>Fecha y hora</Th>
                <Th>Movimiento</Th>
                <Th>Empresa</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b border-border/50 last:border-b-0">
                  <Td className="whitespace-nowrap font-mono">{dateTime.format(new Date(movement.created_at))}</Td>
                  <Td className="whitespace-nowrap">{ACTION_LABELS[movement.action] ?? movement.action}</Td>
                  <Td className="font-mono text-accent">{movement.ticker}</Td>
                  <Td>{describeMovement(movement)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>
    </div>
  );
}
