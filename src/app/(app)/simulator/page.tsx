import type { Metadata } from 'next';
import { SimulatorView } from './simulator-view';

export const metadata: Metadata = { title: 'OCPP Симулятор' };
export const dynamic = 'force-dynamic';

export default function SimulatorPage() {
  return <SimulatorView />;
}
