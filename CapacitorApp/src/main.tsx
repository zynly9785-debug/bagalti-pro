import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { db } from './db/sqlite-simulation.ts';

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root element');

void db.initialize().then(() => {
  createRoot(root).render(<App />);
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'تعذر تهيئة قاعدة البيانات الآمنة.';
  root.innerHTML = '';
  const panel = document.createElement('main');
  panel.dir = 'rtl';
  panel.style.cssText = 'min-height:100vh;display:grid;place-items:center;background:#0B3D2E;color:#fff;padding:24px;font-family:sans-serif;text-align:center';
  const text = document.createElement('p');
  text.textContent = `تعذر فتح قاعدة بيانات بقالتي برو الآمنة. لم نعرض التطبيق حتى لا تضيع بياناتك. أعد تشغيل التطبيق أو تواصل مع الدعم. (${message})`;
  panel.append(text);
  root.append(panel);
});
