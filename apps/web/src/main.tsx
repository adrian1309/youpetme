import { startApp } from './app/start-app';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

startApp(rootElement, import.meta.env);
