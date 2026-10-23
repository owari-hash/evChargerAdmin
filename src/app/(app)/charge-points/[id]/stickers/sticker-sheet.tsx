'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';
import { brand } from '@/lib/config';
import { connectorLetter } from '@/lib/format';
import type { Connector } from '@/lib/types';
import { Button, Card, EmptyState } from '@/components/ui/primitives';

/**
 * Print-ready QR labels, one per gun.
 *
 * The on-screen chrome is hidden at print time by `print:hidden`, so what comes
 * out of the printer is just the labels on white — no console header, no nav.
 * Each label is sized to sit on a charger, and the code is printed as text
 * underneath so support can read it over the phone when a camera will not scan.
 */
export function StickerSheet({
  stationName,
  address,
  chargePointId,
  connectors,
}: {
  stationName: string;
  address: string | null;
  chargePointId: string;
  connectors: Connector[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <Link
            href={`/charge-points/${chargePointId}`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {stationName}
          </Link>
          <h1 className="mt-1 text-lg font-semibold">QR наалт</h1>
          <p className="mt-0.5 text-sm text-[var(--color-fg-muted)]">
            Хошуу бүрийн байнгын код. Хэвлээд станцын тохирох хошуу дээр наана уу.
          </p>
        </div>
        {connectors.length > 0 ? (
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Хэвлэх
          </Button>
        ) : null}
      </div>

      {connectors.length === 0 ? (
        <Card className="print:hidden">
          <EmptyState
            title="Хэвлэх наалт алга"
            description="Энэ станц дээр кодтой холбогч бүртгэгдээгүй байна. Холбогч таб дээрээс нэмнэ үү."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
          {connectors.map((c) => (
            <Sticker
              key={c.connectorId}
              stationName={stationName}
              address={address}
              connector={c}
            />
          ))}
        </div>
      )}

      {/* White background and no page margins beyond the printer's own, so the
          labels keep their size whatever the console theme is. */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
          }
          html,
          body {
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}

function Sticker({
  stationName,
  address,
  connector,
}: {
  stationName: string;
  address: string | null;
  connector: Connector;
}) {
  const subtitle = [
    connector.label,
    connector.connectorType,
    connector.powerKw != null ? `${connector.powerKw} кВт` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="break-inside-avoid rounded-xl border-2 border-black bg-white p-4 text-black print:rounded-lg">
      <div className="flex items-start justify-between gap-3 border-b-2 border-black pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold uppercase tracking-wide">{brand.domain}</p>
          <p className="truncate text-[11px] text-neutral-700">{stationName}</p>
          {address ? <p className="truncate text-[10px] text-neutral-500">{address}</p> : null}
        </div>
        <div className="shrink-0 rounded-md bg-black px-2.5 py-1 text-center">
          <p className="text-[9px] font-semibold uppercase leading-none text-white">Хошуу</p>
          <p className="text-lg font-black leading-tight text-white">
            {connectorLetter(connector.connectorId)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath(`/console-api/qr?data=${encodeURIComponent(connector.qrUrl ?? '')}`)}
          alt={`Хошуу ${connectorLetter(connector.connectorId)}-ийн QR код`}
          className="h-28 w-28 shrink-0"
        />
        <div className="min-w-0 text-[11px] leading-snug">
          <p className="font-semibold">
            QR кодыг утасныхаа камераар уншуулж, цэнэглэлтээ эхлүүлнэ.
          </p>
          {subtitle ? <p className="mt-1 text-neutral-600">{subtitle}</p> : null}
          {/* Printed in text as well: a scratched label still gets a driver
              through support, and it is what they read out on the phone. */}
          <p className="mt-2 font-mono text-base font-bold tracking-[0.2em]">{connector.code}</p>
          <p className="truncate font-mono text-[10px] text-neutral-500">{connector.qrUrl}</p>
        </div>
      </div>
    </div>
  );
}
