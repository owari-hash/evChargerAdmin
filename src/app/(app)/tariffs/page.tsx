import type { Metadata } from 'next';
import { TariffsView } from './tariffs-view';

export const metadata: Metadata = {
  title: 'Цахилгааны тариф',
  description: 'ЭХЗХ-ны баталсан цахилгааны тариф, 3 тарифт тооцоолуур ба үнийн санал',
};

export default function TariffsPage() {
  return <TariffsView />;
}
