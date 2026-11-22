import { Analytics } from '@vercel/analytics/react';
import { SimulationCanvas } from './components/SimulationCanvas';

export default function App() {
  return (
    <>
      <SimulationCanvas />
      <Analytics />
    </>
  );
}
