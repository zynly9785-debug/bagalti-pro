import React, { useMemo, useState } from 'react';
import { Calculator, Delete, X } from 'lucide-react';

interface Props { isOpen: boolean; onClose: () => void; onUse: (value: number) => void; }
function evaluate(expression: string): number | null {
  const compact = expression.replace(/\s/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  if (!compact || !/^[0-9.+*/-]+$/.test(compact)) return null;
  const tokens = compact.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+*/-]/g);
  if (!tokens || tokens.join('') !== compact || tokens.length % 2 === 0) return null;
  const values: number[] = [];
  const operators: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) { const n = Number(tokens[i]); if (!Number.isFinite(n)) return null; values.push(n); }
    else operators.push(tokens[i]);
  }
  for (let i = 0; i < operators.length;) {
    if (operators[i] === '*' || operators[i] === '/') {
      const a = values[i], b = values[i + 1];
      if (operators[i] === '/' && b === 0) return null;
      values.splice(i, 2, operators[i] === '*' ? a * b : a / b);
      operators.splice(i, 1);
    } else i++;
  }
  let result = values[0];
  for (let i = 0; i < operators.length; i++) result = operators[i] === '+' ? result + values[i + 1] : result - values[i + 1];
  return Number.isFinite(result) ? result : null;
}

export const ProductCalculatorDialog: React.FC<Props> = ({ isOpen, onClose, onUse }) => {
  const [expression, setExpression] = useState('');
  const result = useMemo(() => evaluate(expression), [expression]);
  if (!isOpen) return null;
  const append = (value: string) => setExpression(current => current + value);
  const keys = ['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','+','=','C'];
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="آلة حاسبة">
    <div className="w-full max-w-xs space-y-3 rounded-2xl border border-[#C9A961] bg-[#FAF8F3] p-4 shadow-2xl">
      <header className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-[#0B3D2E]"><Calculator className="h-5 w-5"/>آلة حاسبة</h3><button type="button" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5"/></button></header>
      <input value={expression} onChange={e => setExpression(e.target.value)} inputMode="decimal" placeholder="مثال: 12000 ÷ 200" dir="ltr" className="w-full rounded-xl border bg-white p-3 text-left font-mono text-lg text-gray-900" />
      <div className="rounded-xl bg-emerald-50 p-2 text-left font-mono text-sm font-bold text-emerald-900" dir="ltr">{result === null ? '—' : result.toLocaleString('en-US', { maximumFractionDigits: 6 })}</div>
      <div className="grid grid-cols-4 gap-2">{keys.map(key => <button type="button" key={key} onClick={() => key === 'C' ? setExpression('') : key === '=' ? (result !== null && setExpression(String(result))) : append(key)} className={`rounded-xl border py-2.5 font-bold ${'+-×÷'.includes(key) || key === '=' || key === 'C' ? 'bg-emerald-100 text-[#0B3D2E]' : 'bg-white text-gray-800'}`}>{key}</button>)}<button type="button" onClick={() => setExpression(e => e.slice(0,-1))} className="col-span-2 flex items-center justify-center rounded-xl border bg-white py-2.5" aria-label="حذف آخر رقم"><Delete className="h-4 w-4"/></button></div>
      <div className="flex gap-2"><button type="button" disabled={result === null} onClick={() => { if (result !== null) { onUse(result); setExpression(''); onClose(); } }} className="flex-1 rounded-xl bg-[#0B3D2E] py-2.5 text-xs font-bold text-white disabled:opacity-40">استخدام الناتج</button><button type="button" onClick={() => { setExpression(''); onClose(); }} className="rounded-xl border px-4 py-2.5 text-xs font-bold text-gray-700">إلغاء</button></div>
    </div>
  </div>;
};
