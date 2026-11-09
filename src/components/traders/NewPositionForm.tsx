import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../lib/apiClient';
import { MAX_REPORT_MB, reportFileError, uploadReport } from '../../lib/reports';
import type { CompanyOption } from '../../lib/types';
import { Card, Field, inputClass, money, primaryButton } from './ui';

export function NewPositionForm({ traderId, onSaved }: { traderId: number; onSaved: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [shares, setShares] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [report, setReport] = useState<File | null>(null);
  const [reportInputKey, setReportInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const latestSearch = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const searchId = ++latestSearch.current;
    if (!term || company) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { results } = await api<{ results: CompanyOption[] }>(`/api/market/search?q=${encodeURIComponent(term)}`);
        if (searchId === latestSearch.current) setOptions(results);
      } catch (e) {
        if (searchId === latestSearch.current) setError(errorMessage(e));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, company]);

  const total = Number(buyPrice) * Number(shares);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!company) {
      setError('Selecciona una empresa de la lista');
      return;
    }
    const reportError = report && reportFileError(report);
    if (reportError) {
      setError(reportError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api<{ id: string }>(`/api/traders/${traderId}/positions`, 'POST', {
        ticker: company.symbol,
        buyPrice,
        shares,
        buyDate,
      });
      setQuery('');
      setCompany(null);
      setBuyPrice('');
      setShares('');
      setBuyDate('');
      setReport(null);
      setReportInputKey((key) => key + 1);
      if (report) {
        try {
          await uploadReport(created.id, report);
        } catch (e) {
          setError(`La compra se registró, pero falta el informe. ${errorMessage(e)}. Usa "Subir PDF" en la tabla.`);
        }
      }
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Registrar compra">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
        <div className="relative sm:col-span-2 xl:col-span-4">
          <Field label="Empresa (Yahoo Finance)">
            <input
              className={inputClass}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCompany(null);
              }}
              placeholder="Nombre o símbolo"
              autoComplete="off"
              required
            />
          </Field>
          {options.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
              {options.map((option) => (
                <li key={option.symbol}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/5 transition-colors"
                    onClick={() => {
                      setCompany(option);
                      setQuery(`${option.symbol} · ${option.name}`);
                    }}
                  >
                    <span className="font-mono text-accent">{option.symbol}</span> {option.name}
                    {option.exchange && <span className="text-ink/60"> · {option.exchange}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="xl:col-span-2">
          <Field label="Precio de compra (USD)">
            <input className={inputClass} type="number" min="0" step="any" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} required />
          </Field>
        </div>
        <div className="xl:col-span-3">
          <Field label="Número de acciones">
            <input className={inputClass} type="number" min="0" step="any" value={shares} onChange={(e) => setShares(e.target.value)} required />
          </Field>
        </div>
        <div className="xl:col-span-3">
          <Field label="Fecha de compra">
            <input className={inputClass} type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} required />
          </Field>
        </div>
        <div className="sm:col-span-2 xl:col-span-10">
          <Field label={`Informe de la recomendación (PDF, opcional, máximo ${MAX_REPORT_MB} MB)`}>
            <input
              key={reportInputKey}
              className={`${inputClass} text-xs file:mr-3 file:rounded file:border-0 file:bg-accent/10 file:px-2 file:py-0.5 file:text-xs file:text-accent`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setReport(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2 xl:col-span-2">
          <button type="submit" className={`${primaryButton} w-full`} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
      <p className="text-xs text-ink/70">
        Total recomendado de esta compra: <span className="font-mono text-ink">USD {money(Number.isFinite(total) ? total : 0)}</span>
      </p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </Card>
  );
}
