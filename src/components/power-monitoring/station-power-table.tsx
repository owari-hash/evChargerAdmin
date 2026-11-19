'use client';

import * as React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers,
  Search,
  Settings,
  Share2,
  Sliders,
  Zap,
} from 'lucide-react';
import { formatNumber } from '@/lib/format';
import type { StationPowerItem } from '@/lib/types';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { cn } from '@/lib/cn';

export function StationPowerTable({
  stations,
  isLoading,
  onSelectStation,
  onConfigureStation,
}: {
  stations: StationPowerItem[];
  isLoading: boolean;
  onSelectStation: (st: StationPowerItem) => void;
  onConfigureStation: (st: StationPowerItem) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ONLINE' | 'CHARGING' | 'HIGH_UTIL' | 'ALERTS'>('ALL');
  const [sortField, setSortField] = React.useState<'utilization' | 'power' | 'name'>('power');
  const [sortAsc, setSortAsc] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = stations.slice();

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.cpId.toLowerCase().includes(q));
    }

    if (statusFilter === 'ONLINE') {
      list = list.filter((s) => s.isOnline);
    } else if (statusFilter === 'CHARGING') {
      list = list.filter((s) => s.activePilesCount > 0);
    } else if (statusFilter === 'HIGH_UTIL') {
      list = list.filter((s) => s.utilizationPct >= 80);
    } else if (statusFilter === 'ALERTS') {
      list = list.filter((s) => s.activeAlertsCount > 0);
    }

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'utilization') {
        diff = a.utilizationPct - b.utilizationPct;
      } else if (sortField === 'power') {
        diff = a.totalOutputPowerKw - b.totalOutputPowerKw;
      } else {
        diff = a.name.localeCompare(b.name);
      }
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [stations, search, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: 'utilization' | 'power' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <Card className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-fg-muted)]" />
          <Input
            className="pl-9 w-full"
            placeholder="Станцын нэр эсвэл ID-аар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={statusFilter === 'ALL' ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter('ALL')}
          >
            Бүгд ({stations.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'ONLINE' ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter('ONLINE')}
          >
            Онлайн ({stations.filter((s) => s.isOnline).length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'CHARGING' ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter('CHARGING')}
          >
            Цэнэглэж буй ({stations.filter((s) => s.activePilesCount > 0).length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'HIGH_UTIL' ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter('HIGH_UTIL')}
          >
            Ачаалал өндөр (&gt;80%)
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'ALERTS' ? 'primary' : 'ghost'}
            onClick={() => setStatusFilter('ALERTS')}
          >
            Анхааруулгатай ({stations.filter((s) => s.activeAlertsCount > 0).length})
          </Button>
        </div>
      </div>

      {/* Main Station Power Table */}
      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-fg)]"
                >
                  Станц
                  <ArrowUpDown className="size-3" />
                </button>
              </TH>
              <TH>Төлөв</TH>
              <TH align="right" className="text-right">Хүчин чадал</TH>
              <TH align="right" className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('power')}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-fg)] justify-end"
                >
                  Одоогийн гарц
                  <ArrowUpDown className="size-3" />
                </button>
              </TH>
              <TH align="right" className="text-right">Сул нөөц / Хэтрэлт</TH>
              <TH align="center" className="text-center">Буунууд</TH>
              <TH className="w-44">
                <button
                  type="button"
                  onClick={() => toggleSort('utilization')}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-fg)]"
                >
                  Ачаалал
                  <ArrowUpDown className="size-3" />
                </button>
              </TH>
              <TH>Хуваарилалт</TH>
              <TH>Үр ашиг</TH>
              <TH align="center" className="text-center">Анхааруулга</TH>
              <TH align="right" className="text-right w-24">Үйлдэл</TH>
            </tr>
          </THead>
          <TBody>
            {isLoading && stations.length === 0 ? (
              <TableLoading colSpan={11} />
            ) : filtered.length === 0 ? (
              <TableEmpty colSpan={11}>Тохирох цэнэглэх станц олдсонгүй.</TableEmpty>
            ) : (
              filtered.map((st) => {
                const isOverloaded = st.overloadKw > 0;
                const isNearMax = st.utilizationPct >= 80;

                // Color bar for utilization
                const barColor = isOverloaded
                  ? 'bg-rose-500'
                  : st.utilizationPct >= 95
                  ? 'bg-orange-500'
                  : st.utilizationPct >= 80
                  ? 'bg-amber-500'
                  : st.utilizationPct >= 50
                  ? 'bg-sky-500'
                  : 'bg-emerald-500';

                return (
                  <TR
                    key={st.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]/60',
                      isOverloaded && 'bg-rose-500/5 hover:bg-rose-500/10 border-l-4 border-l-rose-500',
                    )}
                    onClick={() => onSelectStation(st)}
                  >
                    {/* Station Name & ID */}
                    <TD>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-[var(--color-fg)] block">
                          {st.name}
                        </span>
                        <span className="font-mono text-xs text-[var(--color-fg-muted)] block">
                          {st.cpId}
                        </span>
                      </div>
                    </TD>

                    {/* Status Badge */}
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            st.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400',
                          )}
                        />
                        <span className="text-xs font-medium">
                          {st.isOnline ? 'Онлайн' : 'Офлайн'}
                        </span>
                        {st.telemetryFreshness === 'STALE' && (
                          <span className="text-[10px] text-amber-500 font-mono">(Хүлээгдэж буй)</span>
                        )}
                      </div>
                    </TD>

                    {/* Rated Capacity */}
                    <TD align="right" className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {st.configuredGridLimitKw} кВт
                    </TD>

                    {/* Actual Output */}
                    <TD align="right" className="font-mono font-bold text-sm text-[var(--color-fg)]">
                      {formatNumber(st.totalOutputPowerKw, 1)} кВт
                    </TD>

                    {/* Available Capacity / Overload */}
                    <TD align="right" className="font-mono text-xs">
                      {isOverloaded ? (
                        <span className="text-rose-500 font-bold">
                          +{formatNumber(st.overloadKw, 1)} кВт хэтэрсэн
                        </span>
                      ) : (
                        <span className="text-emerald-500 font-medium">
                          {formatNumber(st.availablePowerKw, 1)} кВт сул
                        </span>
                      )}
                    </TD>

                    {/* Active Piles */}
                    <TD align="center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-mono font-semibold">
                        <span className={st.activePilesCount > 0 ? 'text-brand' : 'text-[var(--color-fg-muted)]'}>
                          {st.activePilesCount}
                        </span>
                        <span className="text-[var(--color-fg-subtle)]">/</span>
                        <span>{st.totalPilesCount}</span>
                      </span>
                    </TD>

                    {/* Utilization Bar */}
                    <TD>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="font-semibold">{st.utilizationPct}%</span>
                          <span className="text-[10px] text-[var(--color-fg-muted)]">
                            {formatNumber(st.totalOutputPowerKw, 0)}/{st.configuredGridLimitKw}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', barColor)}
                            style={{ width: `${Math.min(100, Math.max(0, st.utilizationPct))}%` }}
                          />
                        </div>
                      </div>
                    </TD>

                    {/* Power Sharing Status */}
                    <TD>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border',
                          st.powerSharingStatus === 'DYNAMIC_SHARING' || st.powerSharingStatus === 'EQUAL_SHARING'
                            ? 'bg-brand/10 text-brand border-brand/20'
                            : st.powerSharingStatus === 'OVERLOAD'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border-transparent',
                        )}
                      >
                        {st.powerSharingStatus === 'EQUAL_SHARING'
                          ? 'Тэгш хуваарилалт'
                          : st.powerSharingStatus === 'DYNAMIC_SHARING'
                          ? 'Динамик'
                          : st.powerSharingStatus === 'SINGLE_PILE'
                          ? '1 буу'
                          : st.powerSharingStatus === 'OVERLOAD'
                          ? 'Хэтрэлттэй'
                          : 'Сул'}
                      </span>
                    </TD>

                    {/* Efficiency / Loss */}
                    <TD>
                      {st.efficiency.inputMeterAvailable && st.efficiency.outputEfficiencyPct !== null ? (
                        <span className="text-xs font-mono font-semibold text-emerald-500">
                          {st.efficiency.outputEfficiencyPct}% ({formatNumber(st.efficiency.powerDifferenceKw ?? 0, 1)} кВт)
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--color-fg-subtle)]" title="Оролтын тоолуур холбогдоогүй">
                          Тоолуургүй
                        </span>
                      )}
                    </TD>

                    {/* Active Alerts Count */}
                    <TD align="center">
                      {st.activeAlertsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-500 border border-rose-500/20">
                          <AlertTriangle className="size-3" />
                          {st.activeAlertsCount}
                        </span>
                      ) : (
                        <span className="text-[var(--color-fg-subtle)] text-xs font-mono">—</span>
                      )}
                    </TD>

                    {/* Action buttons */}
                    <TD align="right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Чадлын тохиргоо засах"
                          onClick={() => onConfigureStation(st)}
                        >
                          <Settings className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Дэлгэрэнгүй харах"
                          onClick={() => onSelectStation(st)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </Card>
  );
}
