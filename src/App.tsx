export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border h-16 flex items-center px-8 justify-between glass sticky top-0 z-50">
        <h1 className="text-lg font-semibold tracking-tight">Recomendaciones y Comisiones</h1>
      </header>

      <main className="flex-1 w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">
        <section className="lg:col-span-12 glass rounded-xl p-6">
          <p className="text-sm opacity-70">Sin contenido todavia.</p>
        </section>
      </main>

      <footer className="border-t border-border p-6 mt-12 glass" />
    </div>
  );
}
