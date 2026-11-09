import Image from 'next/image';
import { useState } from 'react';
import logo from '@/Logo.png';
import { Manual } from './components/Manual';
import { TradersTab } from './components/traders/TradersTab';
import { cn } from './lib/cn';

const TABS = [
  { key: 'traders', label: 'Traders' },
  { key: 'manual', label: 'Manual' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('traders');

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-50">
        <header className="border-b border-border h-16 flex items-center gap-4 px-4 sm:px-8 glass">
          <Image src={logo} alt="Emporium Quality Funds" priority className="h-11 w-auto shrink-0" />
          <h1 className="text-lg font-semibold tracking-tight truncate">Recomendaciones y Comisiones</h1>
        </header>
        <nav className="flex gap-1 border-b border-border px-4 sm:px-8 glass" aria-label="Secciones">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={cn(
                'px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest border-b-2 transition-all -mb-px',
                activeTab === tab.key ? 'border-accent text-accent' : 'border-transparent text-ink/60 hover:text-ink/80',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 w-full p-4 sm:p-6 max-w-[1600px] mx-auto">
        {activeTab === 'traders' ? <TradersTab /> : <Manual />}
      </main>

      <footer className="border-t border-border p-6 mt-12 glass" />
    </div>
  );
}
