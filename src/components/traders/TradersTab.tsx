import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiClientError, errorMessage } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import type { TradersResponse } from '../../lib/types';
import { TraderProfile } from './TraderProfile';
import { Alert, Field, inputClass, money, primaryButton, secondaryButton } from './ui';

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth', 'POST', { password });
      onLoggedIn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass rounded-xl p-6 space-y-4 max-w-sm mx-auto mt-12">
      <h2 className="text-lg font-semibold tracking-tight">Acceso a perfiles</h2>
      <Field label="Clave compartida">
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
      </Field>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" className={`${primaryButton} w-full`} disabled={busy}>
        {busy ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}

export function TradersTab() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<TradersResponse | null>(null);
  const [selectedId, setSelectedId] = useState(1);
  const [cycleStart, setCycleStart] = useState('');
  const [error, setError] = useState('');
  const [profileVersion, setProfileVersion] = useState(0);

  const expireSession = useCallback(() => {
    setAuthenticated(false);
    setData(null);
  }, []);

  useEffect(() => {
    api<{ authenticated: boolean }>('/api/auth')
      .then((session) => setAuthenticated(session.authenticated))
      .catch((e) => {
        setAuthenticated(false);
        setError(errorMessage(e));
      });
  }, []);

  const loadTraders = useCallback(async () => {
    try {
      const response = await api<TradersResponse>('/api/traders');
      setData(response);
      setCycleStart(response.cycleStart ?? '');
      setError('');
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) expireSession();
      else setError(errorMessage(e));
    }
  }, [expireSession]);

  useEffect(() => {
    if (authenticated) void loadTraders();
  }, [authenticated, loadTraders]);

  async function saveCycle() {
    try {
      await api('/api/settings', 'PATCH', { cycleStart });
      await loadTraders();
      setProfileVersion((version) => version + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function logout() {
    await api('/api/auth', 'DELETE').catch(() => undefined);
    expireSession();
  }

  if (authenticated === null) return <p className="text-sm text-ink/60 p-6">Cargando...</p>;
  if (!authenticated) {
    return (
      <>
        {error && <Alert>{error}</Alert>}
        <LoginForm onLoggedIn={() => setAuthenticated(true)} />
      </>
    );
  }
  if (!data) {
    return error ? <Alert>{error}</Alert> : <p className="text-sm text-ink/60 p-6">Cargando perfiles...</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 xl:col-span-2 space-y-4">
        <nav className="glass rounded-xl p-3" aria-label="Perfiles de traders">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink/60 mb-2 px-1">Perfiles</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {data.traders.map((trader) => (
              <li key={trader.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(trader.id)}
                  aria-current={selectedId === trader.id ? 'true' : undefined}
                  className={cn(
                    'w-full text-left rounded-lg px-2 py-1.5 transition-colors border',
                    selectedId === trader.id ? 'border-accent' : 'border-transparent hover:bg-accent/5',
                  )}
                >
                  <span className="block text-xs truncate">{trader.name}</span>
                  <span className="block text-[10px] font-mono text-ink/60">USD {money(trader.totalRecommended)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="glass rounded-xl p-3 space-y-2">
          <Field label="Inicio de ciclo (común)">
            <input className={inputClass} type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
          </Field>
          <button
            type="button"
            className={`${secondaryButton} w-full`}
            disabled={!cycleStart || cycleStart === (data.cycleStart ?? '')}
            onClick={saveCycle}
          >
            Guardar fecha
          </button>
          <button type="button" className={`${secondaryButton} w-full`} onClick={logout}>
            Salir
          </button>
        </div>
      </aside>

      <div className="lg:col-span-9 xl:col-span-10 min-w-0 space-y-4">
        {error && <Alert>{error}</Alert>}
        <TraderProfile
          key={`${selectedId}-${profileVersion}`}
          traderId={selectedId}
          onChanged={loadTraders}
          onSessionExpired={expireSession}
        />
      </div>
    </div>
  );
}
