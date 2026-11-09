import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

// Source: doc "Propuesta: Esquema de Comisiones por Recomendaciones y Control de Perdidas".
// Reference text only: this tab calculates nothing.

const INDEX = [
  { id: 'objetivo', label: '1. Objetivo y alcance' },
  { id: 'umbral', label: '2. Umbral de pérdida' },
  { id: 'participacion', label: '3. Participación y corresponsabilidad' },
  { id: 'ejemplo', label: '4. Ejemplo con cortes semestrales' },
  { id: 'escenario', label: '5. Venta de ganadoras' },
  { id: 'disposiciones', label: '6. Disposiciones finales' },
  { id: 'riesgo', label: '7. Riesgo y faltas' },
  { id: 'aprobacion', label: 'Aprobación' },
];

const KEY_RULES = [
  { value: '20%', label: 'Participación del operador en ganancias y pérdidas' },
  { value: '10%', label: 'Umbral de pérdida sobre el capital original del ciclo' },
  { value: '6 meses', label: 'Fechas de corte: mes 6 y mes 12 de cada ciclo' },
  { value: 'USD 200,000', label: 'Monto máximo recomendado por operador' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="glass rounded-xl p-4 sm:p-6 scroll-mt-32 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-mono uppercase tracking-widest text-accent pt-2">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink/80 max-w-[75ch]">{children}</p>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink/60 max-w-[75ch]">{children}</p>;
}

function amountTone(cell: string) {
  if (/^−\d/.test(cell)) return 'text-danger';
  if (/^\+\d/.test(cell)) return 'text-accent';
  return undefined;
}

function Table({
  headers,
  rows,
  numeric = [],
  emphasizeLast = false,
}: {
  headers: string[];
  rows: string[][];
  numeric?: number[];
  emphasizeLast?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header, col) => (
              <th
                key={col}
                scope="col"
                className={cn(
                  'px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink/60 font-normal align-bottom min-w-20',
                  numeric.includes(col) ? 'text-right' : 'text-left',
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={r}
              className={cn(
                'border-b border-border/50 last:border-b-0',
                emphasizeLast && r === rows.length - 1 && 'font-semibold',
              )}
            >
              {row.map((cell, col) => (
                <td
                  key={col}
                  className={cn(
                    'px-3 py-2 align-top leading-relaxed',
                    numeric.includes(col) && 'text-right font-mono whitespace-nowrap',
                    numeric.includes(col) && amountTone(cell),
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COMPANY_HEADERS = (month: number, accumulated: boolean) => [
  'Empresa',
  `Variación al mes ${month}`,
  'Estado',
  accumulated ? 'Resultado acumulado (USD)' : 'Resultado (USD)',
];

export function Manual() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 xl:col-span-2">
        <nav className="glass rounded-xl p-4 lg:sticky lg:top-32" aria-label="Índice del manual">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink/50 mb-3">Índice</p>
          <ul className="space-y-2">
            {INDEX.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-xs text-ink/70 hover:text-accent transition-colors">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article className="lg:col-span-9 xl:col-span-10 space-y-6 min-w-0">
        <header className="space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent">
              Propuesta pendiente de aprobación · 6 de octubre de 2026
            </p>
            <h2 className="text-2xl font-semibold tracking-tight mt-1">
              Manual del esquema de comisiones por recomendaciones y control de pérdidas
            </h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {KEY_RULES.map((rule) => (
              <div key={rule.label} className="glass rounded-xl p-4">
                <dd className="text-xl font-mono text-accent">{rule.value}</dd>
                <dt className="text-xs text-ink/60 mt-1">{rule.label}</dt>
              </div>
            ))}
          </dl>
        </header>

        <Section id="objetivo" title="1. Objetivo y alcance">
          <P>
            El operador se remunera únicamente con el 20% de las ganancias netas del portafolio que recomienda, sin
            comisión fija ni tope. En sentido inverso, cuando la pérdida del portafolio alcanza el umbral del 10% medido
            a precio de mercado, asume el 20% de esa pérdida: se retiene mientras no se realiza y se descuenta en
            definitiva cuando se realiza. Las posiciones se mantienen o se venden a criterio del operador, sin plazo
            máximo, salvo los cierres obligatorios de la sección 7.
          </P>
          <P>
            Aplica a todo operador que recomiende empresas para inversión. El cálculo se realiza por operador, sobre el
            portafolio formado por sus propias recomendaciones.
          </P>
        </Section>

        <Section id="umbral" title="2. Umbral de pérdida máxima del portafolio: 10%, medido a precio de mercado">
          <P>
            El umbral es el 10% del capital original recomendado por el operador en el ciclo de 12 meses. Se mide a
            precio de mercado: cuentan tanto las posiciones vendidas como las abiertas.
          </P>
          <P>Ejemplo: 10 empresas recomendadas que suman USD 100,000 tienen un umbral de USD 10,000.</P>
          <P>Se usan dos medidas de pérdida, con funciones distintas:</P>
          <Table
            headers={['Medida', 'Qué incluye', 'Para qué sirve']}
            rows={[
              [
                'Pérdida neta a mercado',
                'Resultado de todas las posiciones del ciclo, vendidas y abiertas, valoradas al precio de cierre de la fecha de corte; las ganancias compensan las pérdidas',
                'Determina si se alcanzó el umbral y activa la retención de comisiones',
              ],
              [
                'Pérdida neta realizada',
                'Resultado solo de las posiciones ya vendidas en el ciclo; las ganancias realizadas compensan las pérdidas realizadas',
                'Determina el descuento definitivo al operador',
              ],
            ]}
          />
          <P>La base del umbral es fija: no se reduce cuando se venden posiciones dentro del ciclo.</P>
          <P>
            Fechas de corte: cada 6 meses, al mes 6 y al mes 12 de cada ciclo. En cada corte se miden ambas pérdidas, se
            aplican retenciones y descuentos, y se pagan las participaciones.
          </P>
        </Section>

        <Section id="participacion" title="3. Participación y corresponsabilidad del operador: 20% de ganancias y pérdidas">
          <Subheading>Pérdidas: retención y descuento definitivo</Subheading>
          <P>
            Cuando la pérdida neta a mercado alcanza el umbral, el 20% de esa pérdida queda a cargo del operador. La
            parte que ya está realizada se descuenta en definitiva; la parte que sigue abierta solo se retiene hasta que
            la posición se cierre.
          </P>
          <Table
            headers={[
              'Resultado realizado (USD)',
              'Resultado de posiciones abiertas (USD)',
              'Resultado a mercado (USD)',
              'Retención (USD)',
              'Descuento definitivo (USD)',
              'Total afectado (USD)',
              'Lectura',
            ]}
            numeric={[0, 1, 2, 3, 4, 5]}
            rows={[
              ['−8,000', '0', '−8,000', '0', '0', '0', 'No alcanza el umbral'],
              ['−4,000', '−8,000', '−12,000', '2,400', '0', '2,400', 'Solo las pérdidas abiertas llevan al umbral: todo se retiene'],
              ['−10,000', '−2,000', '−12,000', '400', '2,000', '2,400', 'Lo realizado ya alcanza el umbral: 2,000 en firme y 400 retenidos por lo abierto'],
              ['−15,000', '0', '−15,000', '0', '3,000', '3,000', 'Todo está realizado'],
              ['−12,000', '−13,000', '−25,000', '2,600', '2,400', '5,000', '2,400 en firme por lo realizado y 2,600 retenidos por lo abierto'],
              ['−11,000', '+3,000', '−8,000', '0', '2,200', '2,200', 'Las ganancias abiertas no compensan lo realizado'],
            ]}
          />
          <Note>
            Base: portafolio de USD 100,000, umbral de USD 10,000. Resultado a mercado = realizado + abiertas. En la
            última fila, ganancias abiertas de USD 3,000 bajan la pérdida a mercado, pero no compensan pérdidas ya
            realizadas: el descuento definitivo se aplica igual.
          </Note>
          <P>
            La retención se recalcula en cada fecha de corte. Si la pérdida abierta se realiza, pasa a descuento
            definitivo; si la posición se recupera, se libera al operador.
          </P>
          <P>
            Las posiciones abiertas al cierre del ciclo pasan al siguiente ciclo y su retención se mantiene hasta que se
            vendan o se recuperen.
          </P>
          <P>El operador no aporta efectivo: el saldo a su cargo se compensa con sus participaciones pendientes o futuras.</P>

          <Subheading>Ganancias: participación del 20%</Subheading>
          <P>
            Cuando el portafolio tiene ganancia, el operador recibe el 20% de esa ganancia. Es su única remuneración: no
            hay comisión fija ni tope. Cada corte semestral es un ejercicio independiente: se paga el 20% de la ganancia
            realizada en ese semestre, sin restar lo pagado en cortes anteriores. El pago nunca supera el 20% de la
            ganancia a mercado del portafolio al corte, para que pérdidas abiertas no queden ocultas detrás de ventas
            ganadoras.
          </P>
          <Table
            headers={[
              'Ganancia realizada elegible (USD)',
              'Resultado de posiciones abiertas (USD)',
              'Ganancia neta a mercado (USD)',
              'Participación del operador (USD)',
              'Lectura',
            ]}
            numeric={[0, 1, 2, 3]}
            rows={[
              ['+6,000', '+3,000', '+9,000', '1,200', 'Se paga el 20% de lo realizado'],
              ['+8,000', '−5,000', '+3,000', '600', 'Las pérdidas abiertas limitan el pago al 20% de 3,000; los 5,000 no pagados quedan pendientes'],
              ['+8,000', '−12,000', '−4,000', '0', 'El portafolio está en pérdida; los 8,000 quedan pendientes'],
              ['−2,000', '+7,000', '+5,000', '0', 'La ganancia aún no está realizada'],
            ]}
          />
          <P>
            La ganancia realizada que no se paga por el tope a mercado no se pierde: queda pendiente y se suma a la
            elegible del siguiente corte.
          </P>
          <P>Ejemplo con cortes semestrales (capital USD 100,000):</P>
          <Table
            headers={['Concepto (USD)', 'Corte 1 (mes 6)', 'Corte 2 (mes 12)']}
            numeric={[1, 2]}
            emphasizeLast
            rows={[
              ['Ganancia realizada en el semestre', '6,000', '8,000'],
              ['Ganancia realizada pendiente de cortes anteriores', '0', '0'],
              ['Ganancia a mercado del portafolio al corte', '9,000', '14,000'],
              ['Pago al operador en el corte (20%)', '1,200', '1,600'],
            ]}
          />
          <P>
            En el año el operador recibe USD 2,800: USD 1,200 por la ganancia realizada en el primer semestre y USD 1,600
            por la del segundo. Lo pagado en el corte 1 no se resta en el corte 2.
          </P>
          <P>
            La participación pagada en un corte es definitiva: no se descuenta en cortes posteriores aunque el portafolio
            luego pierda. Esas pérdidas siguen las reglas de la parte de pérdidas.
          </P>
          <P>Entre una pérdida de 0% y el umbral del 10% no hay participación ni descuento.</P>
        </Section>

        <Section id="ejemplo" title="4. Ejemplo de portafolio con pérdida y cortes semestrales">
          <P>
            En este ciclo el operador no recibe participación y termina con un saldo retenido a su cargo de USD 2,420. La
            pérdida a mercado supera el umbral en ambos cortes, pero la realizada no lo alcanza, así que no hay descuento
            definitivo todavía.
          </P>
          <Note>
            Supuestos del ejemplo: empresas ficticias compradas al inicio del ciclo con USD 10,000 cada una (USD 100,000
            en total).
          </Note>

          <Subheading>Corte 1 (mes 6)</Subheading>
          <Table
            headers={COMPANY_HEADERS(6, false)}
            numeric={[1]}
            emphasizeLast
            rows={[
              ['Empresa A', '−42%', 'Vendida', '−4,200 realizada'],
              ['Empresa B', '−36%', 'Vendida', '−3,600 realizada'],
              ['Empresa C', '−12%', 'Abierta', '−1,200 abierta'],
              ['Empresa D', '−18%', 'Abierta', '−1,800 abierta'],
              ['Empresa E', '−10%', 'Abierta', '−1,000 abierta'],
              ['Empresa F', '−8%', 'Abierta', '−800 abierta'],
              ['Empresa G', '−5%', 'Abierta', '−500 abierta'],
              ['Empresa H', '+3%', 'Abierta', '+300 abierta'],
              ['Empresa I', '+5%', 'Abierta', '+500 abierta'],
              ['Empresa J', '+12%', 'Abierta', '+1,200 abierta'],
              ['Total', '', '', '−11,100 (−7,800 realizada; −3,300 abierta)'],
            ]}
          />

          <Subheading>Corte 2 (mes 12)</Subheading>
          <Table
            headers={COMPANY_HEADERS(12, true)}
            numeric={[1]}
            emphasizeLast
            rows={[
              ['Empresa A', '-', 'Vendida en el corte 1', '−4,200 realizada'],
              ['Empresa B', '-', 'Vendida en el corte 1', '−3,600 realizada'],
              ['Empresa C', '−22%', 'Vendida', '−2,200 realizada'],
              ['Empresa D', '−18%', 'Abierta', '−1,800 abierta'],
              ['Empresa E', '−10%', 'Abierta', '−1,000 abierta'],
              ['Empresa F', '−8%', 'Abierta', '−800 abierta'],
              ['Empresa G', '−5%', 'Abierta', '−500 abierta'],
              ['Empresa H', '+3%', 'Vendida', '+300 realizada'],
              ['Empresa I', '+5%', 'Vendida', '+500 realizada'],
              ['Empresa J', '+12%', 'Vendida', '+1,200 realizada'],
              ['Total', '', '', '−12,100 (−8,000 realizada; −4,100 abierta)'],
            ]}
          />

          <Subheading>Liquidación del operador</Subheading>
          <Table
            headers={['Paso', 'Liquidación del operador (USD)', 'Corte 1 (mes 6)', 'Corte 2 (mes 12)']}
            emphasizeLast
            rows={[
              ['1', 'Pérdidas realizadas acumuladas', 'A −4,200 + B −3,600 = −7,800', '−7,800 del corte 1 + C −2,200 = −10,000'],
              ['2', 'Ganancias realizadas acumuladas', '0', 'H +300 + I +500 + J +1,200 = +2,000'],
              ['3', 'Resultado neto realizado acumulado (1 + 2)', '−7,800', '−10,000 + 2,000 = −8,000'],
              ['4', 'Resultado de posiciones abiertas', 'C −1,200 + D −1,800 + E −1,000 + F −800 + G −500 + H +300 + I +500 + J +1,200 = −3,300', 'D −1,800 + E −1,000 + F −800 + G −500 = −4,100'],
              ['5', 'Resultado neto a mercado (3 + 4)', '−7,800 − 3,300 = −11,100', '−8,000 − 4,100 = −12,100'],
              ['6', 'Umbral (10% × 100,000)', '10,000', '10,000'],
              ['7', '¿Pérdida a mercado ≥ umbral?', '11,100 ≥ 10,000: Sí', '12,100 ≥ 10,000: Sí'],
              ['8', '¿Pérdida realizada ≥ umbral?', '7,800 < 10,000: No', '8,000 < 10,000: No'],
              ['9', 'Participación en ganancias', 'Resultado realizado en el semestre −7,800: sin ganancia → 0', 'Resultado realizado en el semestre −2,200 + 2,000 = −200: sin ganancia → 0'],
              ['10', 'Descuento definitivo (20% × pérdida realizada, solo si paso 8 = Sí)', '0', '0'],
              ['11', 'Afectación total (20% × pérdida a mercado, si paso 7 = Sí)', '20% × 11,100 = 2,220', '20% × 12,100 = 2,420'],
              ['12', 'Retención (11 − 10)', '2,220 − 0 = 2,220', '2,420 − 0 = 2,420'],
              ['13', 'Saldo del operador (9 − 10 − 12)', '0 − 0 − 2,220 = −2,220 a su cargo', '0 − 0 − 2,420 = −2,420 a su cargo'],
              ['14', 'Total consolidado de los dos cortes: a cobrar (+) o a deber (−)', 'Participaciones: 0 + 0 = 0 · Descuentos definitivos: 0 + 0 = 0 · Retención vigente al cierre: 2,420 (reemplaza a la de 2,220)', '0 − 0 − 2,420 = −2,420 a deber'],
            ]}
          />
          <P>
            La retención de cada corte reemplaza a la del corte anterior, no se suma: en el corte 2 el saldo retenido pasa
            de 2,220 a 2,420.
          </P>
          <P>
            El saldo se compensa con participaciones futuras del operador; no paga en efectivo. Al pasar al siguiente
            ciclo con D, E, F y G abiertas: si se venden con esa pérdida, la realizada llega a USD 12,100 y los USD 2,420
            se convierten en descuento definitivo; si se recuperan, la retención se libera.
          </P>

          <Subheading>Corte 2 alternativo (mes 12): el portafolio se recupera y el saldo es positivo</Subheading>
          <P>
            Desde el mismo corte 1, el operador mantiene las posiciones abiertas y el mercado se recupera en el segundo
            semestre. Vende H y J con ganancia y el resto queda abierto con ganancia.
          </P>
          <Table
            headers={COMPANY_HEADERS(12, true)}
            numeric={[1]}
            emphasizeLast
            rows={[
              ['Empresa A', '-', 'Vendida en el corte 1', '−4,200 realizada'],
              ['Empresa B', '-', 'Vendida en el corte 1', '−3,600 realizada'],
              ['Empresa C', '+10%', 'Abierta', '+1,000 abierta'],
              ['Empresa D', '+12%', 'Abierta', '+1,200 abierta'],
              ['Empresa E', '+15%', 'Abierta', '+1,500 abierta'],
              ['Empresa F', '+8%', 'Abierta', '+800 abierta'],
              ['Empresa G', '+10%', 'Abierta', '+1,000 abierta'],
              ['Empresa H', '+25%', 'Vendida', '+2,500 realizada'],
              ['Empresa I', '+35%', 'Abierta', '+3,500 abierta'],
              ['Empresa J', '+15%', 'Vendida', '+1,500 realizada'],
              ['Total', '', '', '+5,200 (−3,800 realizada; +9,000 abierta)'],
            ]}
          />
          <Table
            headers={['Paso', 'Liquidación del operador (USD)', 'Corte 1 (mes 6)', 'Corte 2 alternativo (mes 12)']}
            emphasizeLast
            rows={[
              ['1', 'Pérdidas realizadas acumuladas', 'A −4,200 + B −3,600 = −7,800', '−7,800 del corte 1 (sin nuevas pérdidas realizadas)'],
              ['2', 'Ganancias realizadas acumuladas', '0', 'H +2,500 + J +1,500 = +4,000'],
              ['3', 'Resultado neto realizado acumulado (1 + 2)', '−7,800', '−7,800 + 4,000 = −3,800'],
              ['4', 'Resultado de posiciones abiertas', '−3,300 (detalle en la tabla del corte 1)', 'C +1,000 + D +1,200 + E +1,500 + F +800 + G +1,000 + I +3,500 = +9,000'],
              ['5', 'Resultado neto a mercado (3 + 4)', '−7,800 − 3,300 = −11,100', '−3,800 + 9,000 = +5,200'],
              ['6', 'Umbral (10% × 100,000)', '10,000', '10,000'],
              ['7', '¿Pérdida a mercado ≥ umbral?', '11,100 ≥ 10,000: Sí', 'Hay ganancia de 5,200: No'],
              ['8', '¿Pérdida realizada ≥ umbral?', '7,800 < 10,000: No', '3,800 < 10,000: No'],
              ['9', 'Participación en ganancias', 'Sin ganancia → 0', 'Ganancia realizada en el semestre 4,000; tope a mercado 5,200 → 20% × min(4,000; 5,200) = 800'],
              ['10', 'Descuento definitivo (solo si paso 8 = Sí)', '0', '0'],
              ['11', 'Afectación total (20% × pérdida a mercado, si paso 7 = Sí)', '20% × 11,100 = 2,220', '0'],
              ['12', 'Retención (11 − 10)', '2,220', '0 (se liberan los 2,220 del corte 1)'],
              ['13', 'Saldo del operador (9 − 10 − 12)', '−2,220 a su cargo', '800 − 0 − 0 = +800 a su favor'],
              ['14', 'Total consolidado de los dos cortes: a cobrar (+) o a deber (−)', 'Participaciones: 0 + 800 = 800 · Descuentos definitivos: 0 + 0 = 0 · Retención vigente al cierre: 0 (los 2,220 del corte 1 se liberaron)', '800 − 0 − 0 = +800 a cobrar'],
            ]}
          />
          <P>
            Al volver el portafolio a ganancia, la retención del corte 1 se libera completa y el operador cobra USD 800:
            el 20% de los USD 4,000 realizados en el semestre, que no superan la ganancia a mercado de USD 5,200.
          </P>
        </Section>

        <Section id="escenario" title="5. Escenario: se venden las ganadoras y quedan abiertas las perdedoras">
          <P>
            Al medir el umbral a precio de mercado, vender primero las ganadoras y dejar abiertas las perdedoras ya no
            evita la corresponsabilidad: las pérdidas abiertas cuentan desde el primer corte y activan la retención. El
            descuento definitivo llega solo cuando esas pérdidas se realizan.
          </P>
          <P>
            Mismo portafolio de la sección 4. En el corte 1 el operador vendió solo H, I y J con ganancia (USD 2,000
            realizados) y mantiene abiertas las otras siete con USD 13,100 de pérdida:
          </P>
          <Table
            headers={[
              'Corte',
              'Resultado neto realizado (USD)',
              'Resultado neto a mercado (USD)',
              'Participación (USD)',
              'Retención (USD)',
              'Descuento definitivo (USD)',
              'Resultado para el operador (USD)',
            ]}
            numeric={[1, 2, 3, 4, 5]}
            rows={[
              ['Corte 1 (mes 6): solo H, I y J vendidas', '+2,000', '−11,100', '0', '2,220', '0', 'Saldo a cargo de 2,220; la ganancia realizada de 2,000 queda pendiente'],
              ['Corte 2a (mes 12): las siete perdedoras se venden con pérdida', '−12,100', '−12,100', '0', '0', '2,420', 'Saldo a cargo de 2,420 (definitivo)'],
              ['Corte 2b (mes 12): las siete perdedoras se recuperan y se venden sin pérdida', '+2,000', '+2,000', '400', '0 (se libera)', '0', 'Recibe 400 (20% de la ganancia pendiente del corte 1)'],
            ]}
          />
          <P>
            Si solo contara lo realizado, en el corte 1 el operador recibiría USD 400 de participación (20% de 2,000) y no
            asumiría nada, aunque el portafolio pierde USD 11,100 a mercado.
          </P>
        </Section>

        <Section id="disposiciones" title="6. Disposiciones finales">
          <Subheading>Orden de aplicación en cada corte</Subheading>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed text-ink/80 max-w-[75ch]">
            <li>Calcular el resultado neto a mercado y el realizado del ciclo.</li>
            <li>Si hay ganancia, calcular la participación del 20%.</li>
            <li>Si la pérdida realizada alcanzó el umbral, aplicar el descuento definitivo del 20%.</li>
            <li>Si la pérdida a mercado alcanzó el umbral, retener la diferencia hasta el 20% de esa pérdida.</li>
            <li>Pagar la participación neta o registrar el saldo a cargo del operador.</li>
          </ol>
          <P>
            Registro: cada participación, retención y descuento se documenta con fecha, precio de entrada, precio de
            salida o de mercado y cálculo, y se entrega al operador.
          </P>
          <P>Revisión: el umbral global y los porcentajes de participación y corresponsabilidad se revisan una vez al año.</P>
          <Subheading>Puntos abiertos para decidir</Subheading>
          <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-ink/80 max-w-[75ch]">
            <li>¿El umbral del 10% se mide por operador o sobre el portafolio total de todos los operadores?</li>
            <li>¿El saldo de descuento no cubierto se arrastra indefinidamente o tiene un límite de tiempo?</li>
          </ul>
        </Section>

        <Section id="riesgo" title="7. Políticas de riesgo y régimen de faltas">
          <P>
            Cada operador puede recomendar hasta USD 200,000, sin que una sola posición supere el 20% de ese total. Las
            pérdidas activan cierres obligatorios y faltas de tres niveles, que van del llamado de atención a la
            desvinculación.
          </P>
          <Subheading>Límites de asignación</Subheading>
          <P>
            Monto máximo por operador: USD 200,000 en recomendaciones. Con ese monto, el umbral de corresponsabilidad de
            la sección 2 es de USD 20,000.
          </P>
          <P>
            Concentración máxima por posición: ninguna posición puede representar más del 20% del total recomendado al
            momento de la compra (hasta USD 40,000 con el monto máximo).
          </P>
          <Subheading>Cierres obligatorios y faltas</Subheading>
          <Table
            headers={['#', 'Evento', 'Cuándo se mide', 'Acción sobre las posiciones', 'Falta', 'Sanción']}
            rows={[
              ['3', 'Una posición pierde más del 20% de su valor de compra', 'Precio de cierre diario', 'Se cierra solo esa posición', 'Primer grado', 'Llamado de atención'],
              ['3a', 'Se repite el evento 3 en otra posición dentro del mismo ciclo', 'Precio de cierre diario', 'Se cierra solo esa posición', 'Segundo grado', 'Bloqueo de recomendaciones'],
              ['4', 'La pérdida a mercado del portafolio supera el 40% del total recomendado', 'Precio de cierre diario', 'Se cierran todas las posiciones', 'Segundo grado', 'Bloqueo de recomendaciones'],
              ['5', 'En una fecha de corte todas las posiciones están en pérdida', 'Fecha de corte', 'Se cierran todas las posiciones', 'Tercer grado', 'Desvinculación'],
            ]}
          />
          <P>Con el monto máximo de USD 200,000, el evento 4 se activa con una pérdida a mercado mayor a USD 80,000.</P>
          <P>
            Todo cierre obligatorio convierte las pérdidas abiertas en realizadas. La corresponsabilidad del 20% de la
            sección 3 se aplica sobre ese resultado.
          </P>
          <P>Las faltas son acumulativas: una falta de primer grado repetida sube a segundo grado.</P>
          <P>Durante un bloqueo, el operador no puede abrir nuevas recomendaciones.</P>
        </Section>

        <Section id="aprobacion" title="Aprobación">
          <P>Este esquema es una propuesta operativa; antes de implementarlo conviene revisarlo con asesoría legal y de cumplimiento.</P>
          <Table
            headers={['Aprobación', 'Nombre', 'Firma', 'Fecha']}
            rows={[
              ['Elaborado por', 'Ing. Erick David Moreno Ludeña', '', ''],
              ['Revisado por', '', '', ''],
              ['Aprobado por', '', '', ''],
            ]}
          />
        </Section>
      </article>
    </div>
  );
}
