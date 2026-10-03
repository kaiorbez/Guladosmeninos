"use client";

import Link from "next/link";
import { useRef } from "react";

export type OrderFilterValues = { aba: string; q: string; hora: string; dia: string; pgto: string; canal: string };

/** Filtros das encomendas: mudar uma opção já aplica (sem precisar clicar em Buscar). */
export function OrderFilters({
  values,
  hours,
  channels,
  today,
  tomorrow,
}: {
  values: OrderFilterValues;
  hours: string[];
  channels: readonly (readonly [string, string])[];
  today: string;
  tomorrow: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const active = Boolean(values.q || values.hora || values.dia || values.pgto || values.canal);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(values.dia) && values.dia !== today && values.dia !== tomorrow;

  const select = (name: keyof OrderFilterValues, label: string, options: [string, string][]) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-cacau-500">{label}</span>
      <select name={name} defaultValue={values[name]} onChange={submit} className={`input w-auto py-1.5 text-sm ${values[name] ? "border-dourado-500" : ""}`}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );

  return (
    <form ref={form} action="/painel/encomendas" className="card mb-5 flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="aba" value={values.aba} />
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-cacau-500">Cliente, produto ou celular</span>
        <input name="q" defaultValue={values.q} placeholder="Ex.: Maria, empadão, 7130..." className={`input py-1.5 text-sm ${values.q ? "border-dourado-500" : ""}`} />
      </label>
      {select("dia", "Dia", [
        ["", "Todos os dias"],
        [today, "Hoje"],
        [tomorrow, "Amanhã"],
        ...(isDate ? ([[values.dia, values.dia.split("-").reverse().join("/")]] as [string, string][]) : []),
      ])}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-cacau-500">Outra data</span>
        <input
          type="date"
          defaultValue={isDate ? values.dia : ""}
          onChange={(e) => {
            const dia = form.current?.elements.namedItem("dia") as HTMLSelectElement | null;
            if (dia && e.target.value) {
              if (![...dia.options].some((o) => o.value === e.target.value)) dia.add(new Option(e.target.value, e.target.value));
              dia.value = e.target.value;
              submit();
            }
          }}
          className="input w-auto py-1.5 text-sm"
        />
      </label>
      {select("hora", "Horário", [["", "Todos os horários"], ...hours.map((h): [string, string] => [h, `${h}h`]), ["sem", "Sem horário"]])}
      {select("pgto", "Pagamento", [["", "Todos"], ["falta", "Falta receber"], ["pago", "Pago"]])}
      {select("canal", "Canal", [["", "Todos"], ...channels.map(([v, l]): [string, string] => [v, l])])}
      <button className="btn-ghost py-1.5">Buscar</button>
      {active && (
        <Link href={`/painel/encomendas?aba=${values.aba}`} className="pb-2 text-sm text-cacau-500 hover:text-cacau-900 hover:underline">
          Limpar filtros
        </Link>
      )}
    </form>
  );
}
