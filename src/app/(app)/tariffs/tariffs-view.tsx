'use client';

import * as React from 'react';
import {
  Sun,
  TrendingUp,
  Moon,
  Clock,
  RotateCcw,
  Save,
  Info,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Percent,
  Sliders,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { Button, Card, CardBody, Input } from '@/components/ui/primitives';

export type TariffCategoryKey = 'other' | 'budget' | 'mobile' | 'mining';

export interface CategoryInfo {
  key: TariffCategoryKey;
  name: string;
  badge: string;
  description: string;
  dayRate: number;
  peakRate: number;
  nightRate: number;
  flatRate: number;
}

export const TARIFF_CATEGORIES: Record<TariffCategoryKey, CategoryInfo> = {
  other: {
    key: 'other',
    name: 'Бусад үйлдвэр, ААН байгууллага',
    badge: 'Үндсэн',
    description: 'Цэнэглэх станцуудад ихэвчлэн мөрдөгддөг ерөнхий ААН ангилал',
    dayRate: 278,
    peakRate: 417,
    nightRate: 168,
    flatRate: 278,
  },
  budget: {
    key: 'budget',
    name: 'Төсвийн байгууллага',
    badge: 'Төрийн',
    description: 'Төрийн болон орон нутгийн төсөвт байгууллагын эзэмшлийн байршил',
    dayRate: 292,
    peakRate: 437,
    nightRate: 176,
    flatRate: 292,
  },
  mobile: {
    key: 'mobile',
    name: 'Үүрэн холбооны үйлчилгээ эрхлэгч',
    badge: 'Холбоо',
    description: 'Үүрэн холбоо, интернэт үйлчилгээ үзүүлэгч компаниудын ангилал',
    dayRate: 289,
    peakRate: 459,
    nightRate: 168,
    flatRate: 289,
  },
  mining: {
    key: 'mining',
    name: 'Уул уурхай, банк болон тусгай ангилал',
    badge: 'Тусгай',
    description: 'Уул уурхайн олборлолт, банк санхүү, тусгай дэглэмтэй хэрэглэгчид',
    dayRate: 328,
    peakRate: 547,
    nightRate: 184,
    flatRate: 328,
  },
};

const DRAFT_STORAGE_KEY = 'eplug-tariff-draft-v1';

function formatMnt(amount: number): string {
  return (
    new Intl.NumberFormat('mn-MN', {
      maximumFractionDigits: 2,
    }).format(amount) + ' ₮'
  );
}

export function TariffsView() {
  const [category, setCategory] = React.useState<TariffCategoryKey>('other');
  const [isThreeRate, setIsThreeRate] = React.useState(true);

  // Inputs
  const [dayKwh, setDayKwh] = React.useState('100');
  const [peakKwh, setPeakKwh] = React.useState('30');
  const [nightKwh, setNightKwh] = React.useState('70');
  const [flatKwh, setFlatKwh] = React.useState('200');

  const [includeVat, setIncludeVat] = React.useState(true);
  const [markupPerKwh, setMarkupPerKwh] = React.useState('0');
  const [fixedFee, setFixedFee] = React.useState('0');

  const [savedNote, setSavedNote] = React.useState('100 / 30 / 70 кВт·ц нь туршилтын анхны хэрэглээ.');
  const [showSettings, setShowSettings] = React.useState(true);
  const [showMarkup, setShowMarkup] = React.useState(false);
  const [showBreakdown, setShowBreakdown] = React.useState(true);

  // Restore saved draft if available
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && TARIFF_CATEGORIES[parsed.category as TariffCategoryKey]) {
        setCategory(parsed.category);
        setIsThreeRate(!!parsed.three);
        setIncludeVat(!!parsed.vat);
        if (Array.isArray(parsed.values) && parsed.values.length >= 5) {
          setDayKwh(parsed.values[0] || '100');
          setPeakKwh(parsed.values[1] || '30');
          setNightKwh(parsed.values[2] || '70');
          setMarkupPerKwh(parsed.values[3] || '0');
          setFixedFee(parsed.values[4] || '0');
        }
        setSavedNote('Өмнө хадгалсан тооцоог амжилттай сэргээв.');
      }
    } catch {
      // LocalStorage access issues ignored
    }
  }, []);

  const cat = TARIFF_CATEGORIES[category];

  // Rates based on category
  const currentRates = React.useMemo(() => {
    return [cat.dayRate, cat.peakRate, cat.nightRate];
  }, [cat]);

  // Calculation
  const calculation = React.useMemo(() => {
    const q = isThreeRate
      ? [Math.max(0, Number(dayKwh) || 0), Math.max(0, Number(peakKwh) || 0), Math.max(0, Number(nightKwh) || 0)]
      : [Math.max(0, Number(flatKwh) || 0), 0, 0];

    const r = isThreeRate ? currentRates : [cat.flatRate, 0, 0];

    const energy = q.reduce((a, b) => a + b, 0);
    const base = isThreeRate
      ? q.reduce((a, b, i) => a + b * r[i], 0)
      : (Number(flatKwh) || 0) * cat.flatRate;

    const markup = Math.max(0, Number(markupPerKwh) || 0);
    const fee = Math.max(0, Number(fixedFee) || 0);
    const service = energy * markup + fee;

    const tax = includeVat ? Math.round((base + service) * 10) / 100 : 0;
    const total = Math.round((base + service + tax) * 100) / 100;
    const average = energy > 0 ? total / energy : 0;

    return {
      q,
      r,
      energy,
      base,
      service,
      tax,
      total,
      average,
    };
  }, [isThreeRate, dayKwh, peakKwh, nightKwh, flatKwh, currentRates, cat, markupPerKwh, fixedFee, includeVat]);

  function handleSaveDraft() {
    try {
      const payload = {
        category,
        three: isThreeRate,
        vat: includeVat,
        values: [dayKwh, peakKwh, nightKwh, markupPerKwh, fixedFee],
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      setSavedNote('Тооцоо энэ браузерт найдвартай хадгалагдлаа.');
      toast.success('Тооцоог хадгаллаа');
    } catch {
      toast.error('Энэ браузерт хадгалах боломжгүй байна.');
    }
  }

  function handleReset() {
    setCategory('other');
    setIsThreeRate(true);
    setDayKwh('100');
    setPeakKwh('30');
    setNightKwh('70');
    setFlatKwh('200');
    setIncludeVat(true);
    setMarkupPerKwh('0');
    setFixedFee('0');
    setSavedNote('100 / 30 / 70 кВт·ц нь туршилтын анхны хэрэглээ.');
    toast.info('Тооцоолуур анхны утга руу шилжлээ');
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 pt-2">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-brand)]">
            <Zap className="h-3.5 w-3.5" />
            <span>ЭХЗХ-ны 2026 оны №350 тогтоол</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
            Хэрэглээгээ оруул. Төлбөрөө хар.
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Өдөр, оргил, шөнө — албан ёсны гурван тарифт тооцоолуур ба үнийн санал.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Дахин тооцоолох
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveDraft} className="gap-1.5 text-xs">
            <Save className="h-3.5 w-3.5" />
            Тооцоог хадгалах
          </Button>
        </div>
      </div>


      {/* 3 Main Rate Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* Day Rate */}
        <Card className="relative overflow-hidden border-[var(--color-border)] transition-all hover:border-[var(--color-border-strong)]">
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Өдрийн тариф
                </span>
                <p className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">06:00 — 17:00 (11 цаг)</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Sun className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-[var(--color-fg)] sm:text-4xl">
                {cat.dayRate}
              </span>
              <span className="text-sm font-medium text-[var(--color-fg-muted)]">₮ / кВт·ц</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Өдрийн ердийн ажлын цагийн хэрэглээ</span>
            </div>
          </CardBody>
        </Card>

        {/* Peak Rate */}
        <Card className="relative overflow-hidden border-orange-500/30 bg-orange-500/5 transition-all hover:border-orange-500/50 dark:bg-orange-950/20">
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Оргил ачаалал
                </span>
                <p className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">17:00 — 22:00 (5 цаг)</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400 sm:text-4xl">
                {cat.peakRate}
              </span>
              <span className="text-sm font-medium text-orange-600/80 dark:text-orange-400/80">₮ / кВт·ц</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span>Эрчим хүчний системийн оргил ачааллын цаг</span>
            </div>
          </CardBody>
        </Card>

        {/* Night Rate */}
        <Card className="relative overflow-hidden border-emerald-500/30 bg-emerald-500/5 transition-all hover:border-emerald-500/50 dark:bg-emerald-950/20">
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Шөнийн тариф
                </span>
                <p className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">22:00 — 06:00 (8 цаг)</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Moon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-4xl">
                {cat.nightRate}
              </span>
              <span className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80">₮ / кВт·ц</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Хамгийн хямд, шөнийн цэнэглэлтийн таатай үе</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="text-right text-xs text-[var(--color-fg-subtle)]">
        ₮ / кВт·ц · НӨАТ-гүй · Сэргээгдэх эрчим хүчийг дэмжих тариф (13.48₮) нэгж үнэд багтсан
      </div>

      {/* Main Grid: Calculator Left, Total Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Inputs */}
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardBody className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-[var(--color-fg)]">
                  Хэр их цахилгаан хэрэглэсэн бэ?
                </h2>
                {/* Meter Type Segmented Tabs */}
                <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsThreeRate(true)}
                    className={cn(
                      'rounded-md px-3 py-1 font-medium transition cursor-pointer',
                      isThreeRate
                        ? 'bg-[var(--color-surface)] text-[var(--color-brand)] shadow-xs'
                        : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                    )}
                  >
                    3 тарифт тоолуур
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsThreeRate(false)}
                    className={cn(
                      'rounded-md px-3 py-1 font-medium transition cursor-pointer',
                      !isThreeRate
                        ? 'bg-[var(--color-surface)] text-[var(--color-brand)] shadow-xs'
                        : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                    )}
                  >
                    Энгийн тоолуур
                  </button>
                </div>
              </div>

              <p className="text-xs text-[var(--color-fg-subtle)]">
                Тоолуураар хэмжсэн бодит хэрэглээг кВт·ц-ээр оруулна уу:
              </p>

              {/* Fields */}
              {isThreeRate ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-fg-muted)]">
                      Өдрийн хэрэглээ
                    </label>
                    <div className="mt-1 relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dayKwh}
                        onChange={(e) => setDayKwh(e.target.value)}
                        className="pr-12 text-base font-bold tnum"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fg-subtle)]">
                        кВт·ц
                      </span>
                    </div>
                    <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                      {cat.dayRate}₮ / кВт·ц
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-fg-muted)]">
                      Оргил хэрэглээ
                    </label>
                    <div className="mt-1 relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={peakKwh}
                        onChange={(e) => setPeakKwh(e.target.value)}
                        className="pr-12 text-base font-bold tnum"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fg-subtle)]">
                        кВт·ц
                      </span>
                    </div>
                    <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                      {cat.peakRate}₮ / кВт·ц
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-fg-muted)]">
                      Шөнийн хэрэглээ
                    </label>
                    <div className="mt-1 relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={nightKwh}
                        onChange={(e) => setNightKwh(e.target.value)}
                        className="pr-12 text-base font-bold tnum"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fg-subtle)]">
                        кВт·ц
                      </span>
                    </div>
                    <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                      {cat.nightRate}₮ / кВт·ц
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-fg-muted)]">
                    Нийт цахилгааны хэрэглээ (Энгийн нэг тарифт)
                  </label>
                  <div className="mt-1 relative">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={flatKwh}
                      onChange={(e) => setFlatKwh(e.target.value)}
                      className="pr-12 text-base font-bold tnum"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-fg-subtle)]">
                      кВт·ц
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                    Энгийн тоолуурын нэгж тариф: {cat.flatRate}₮ / кВт·ц
                  </span>
                </div>
              )}

              {/* VAT Checkbox */}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                <input
                  id="vat-check"
                  type="checkbox"
                  checked={includeVat}
                  onChange={(e) => setIncludeVat(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[var(--color-border)] accent-[var(--color-brand)] cursor-pointer"
                />
                <label htmlFor="vat-check" className="text-xs font-medium text-[var(--color-fg)] cursor-pointer">
                  НӨАТ 10% тооцох (Байгууллагын нэхэмжлэх, И-Баримт олголт)
                </label>
              </div>

              {/* Service Markup Collapsible */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3.5">
                <button
                  type="button"
                  onClick={() => setShowMarkup(!showMarkup)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-[var(--color-fg)] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                    <span>Eplug үйлчилгээний нэмэгдэл (Маржиналь тохиргоо)</span>
                  </span>
                  <span className="text-[11px] text-[var(--color-fg-subtle)]">
                    {showMarkup ? 'Хураах ▲' : 'Тохируулах ▼'}
                  </span>
                </button>

                {showMarkup && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-[11px] text-[var(--color-fg-subtle)] leading-relaxed">
                      Энэхүү нэмэгдэл нь төрөөс баталсан цахилгааны тариф биш бөгөөд станцын операторын хэрэглэгчээс
                      авах үйлчилгээний хураамж, үнийн саналыг урьдчилан загварчлахад зориулагдсан.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--color-fg-muted)]">
                          Нэмэгдэл ₮ / кВт·ц
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={markupPerKwh}
                          onChange={(e) => setMarkupPerKwh(e.target.value)}
                          placeholder="0"
                          className="mt-1 text-sm font-semibold tnum"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--color-fg-muted)]">
                          Нэг удаагийн хураамж ₮
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={fixedFee}
                          onChange={(e) => setFixedFee(e.target.value)}
                          placeholder="0"
                          className="mt-1 text-sm font-semibold tnum"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Breakdown Table Collapsible */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-[var(--color-fg)] cursor-pointer"
                >
                  <span>Тооцооны задаргаа харах</span>
                  <span className="text-[11px] text-[var(--color-fg-subtle)]">
                    {showBreakdown ? 'Хураах ▲' : 'Дэлгэх ▼'}
                  </span>
                </button>

                {showBreakdown && (
                  <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--color-surface-2)] text-[11px] font-semibold text-[var(--color-fg-muted)]">
                        <tr>
                          <th className="px-3.5 py-2.5">Тариф</th>
                          <th className="px-3 py-2.5 text-right">кВт·ц</th>
                          <th className="px-3 py-2.5 text-right">Нэгж үнэ</th>
                          <th className="px-3.5 py-2.5 text-right">Дүн</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {isThreeRate ? (
                          <>
                            <tr>
                              <td className="px-3.5 py-2.5 font-medium text-[var(--color-fg)]">
                                Өдрийн (06:00–17:00)
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg)]">
                                {calculation.q[0]}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg-muted)]">
                                {cat.dayRate} ₮
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-[var(--color-fg)]">
                                {formatMnt(calculation.q[0] * cat.dayRate)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3.5 py-2.5 font-medium text-orange-600 dark:text-orange-400">
                                Оргил (17:00–22:00)
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg)]">
                                {calculation.q[1]}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg-muted)]">
                                {cat.peakRate} ₮
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-[var(--color-fg)]">
                                {formatMnt(calculation.q[1] * cat.peakRate)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3.5 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                                Шөнийн (22:00–06:00)
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg)]">
                                {calculation.q[2]}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg-muted)]">
                                {cat.nightRate} ₮
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-[var(--color-fg)]">
                                {formatMnt(calculation.q[2] * cat.nightRate)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td className="px-3.5 py-2.5 font-medium text-[var(--color-fg)]">
                              Энгийн нэг тарифт
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg)]">
                              {calculation.energy}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--color-fg-muted)]">
                              {cat.flatRate} ₮
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-[var(--color-fg)]">
                              {formatMnt(calculation.base)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Total Panel */}
        <div className="lg:col-span-5">
          <Card>
            <CardBody className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h2 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-fg-muted)]">
                  Нийт төлбөр
                </h2>
                <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--color-brand)] border border-[var(--color-border)]">
                  УРЬДЧИЛСАН
                </span>
              </div>

              {/* Huge Total */}
              <div className="py-2">
                <div className="text-4xl font-extrabold tracking-tight text-[var(--color-fg)] sm:text-5xl font-mono">
                  {formatMnt(calculation.total)}
                </div>
                <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
                  Нийт {calculation.energy.toLocaleString('mn-MN')} кВт·ц хэрэглээ ·{' '}
                  {includeVat ? 'НӨАТ 10% орсон' : 'НӨАТ-гүй'}
                </p>
              </div>

              {/* Summary lines */}
              <div className="space-y-2.5 border-t border-[var(--color-border)] pt-4 text-xs">
                <div className="flex justify-between text-[var(--color-fg-muted)]">
                  <span>Цахилгааны төлбөр</span>
                  <span className="font-mono font-semibold text-[var(--color-fg)]">
                    {formatMnt(calculation.base)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--color-fg-muted)]">
                  <span>Үйлчилгээний нэмэгдэл</span>
                  <span className="font-mono font-semibold text-[var(--color-fg)]">
                    {formatMnt(calculation.service)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--color-fg-muted)]">
                  <span>НӨАТ {includeVat ? '(10%)' : '(тооцоогүй)'}</span>
                  <span className="font-mono font-semibold text-[var(--color-fg)]">
                    {formatMnt(calculation.tax)}
                  </span>
                </div>

                {/* Average rate */}
                <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3 flex justify-between">
                  <span className="font-medium text-[var(--color-fg-muted)]">Дундаж өртөг / кВт·ц</span>
                  <span className="font-mono font-bold text-[var(--color-fg)]">
                    {formatMnt(calculation.average)}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-5 space-y-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveDraft}
                  className="w-full justify-center text-xs font-semibold py-2.5"
                >
                  Тооцоог хадгалах
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleReset}
                  className="w-full justify-center text-xs font-medium py-2.5"
                >
                  Дахин тооцоолох
                </Button>
              </div>

              <p className="mt-3 text-center text-[10px] text-[var(--color-fg-subtle)]">
                {savedNote}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 24-Hour Timeline Bar */}
      <Card>
        <CardBody className="p-5 sm:p-6 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-brand)]" />
              <span>24 цагийн тарифын хуваарь</span>
            </h2>
            <span className="text-xs text-[var(--color-fg-muted)]">
              Хугацааг тоолуурын бодит цагаар тооцно
            </span>
          </div>

          <div className="mt-3 flex h-9 w-full overflow-hidden rounded-lg border border-[var(--color-border)] text-xs font-medium text-white shadow-xs">
            <div
              style={{ width: '25%' }}
              className="flex items-center justify-center bg-emerald-700 text-emerald-100"
              title="Шөнийн тариф: 00:00–06:00 (6 цаг)"
            >
              Шөнийн (00:00–06:00)
            </div>
            <div
              style={{ width: '45.833%' }}
              className="flex items-center justify-center bg-amber-500 text-amber-950 font-semibold"
              title="Өдрийн тариф: 06:00–17:00 (11 цаг)"
            >
              Өдрийн (06:00–17:00)
            </div>
            <div
              style={{ width: '20.833%' }}
              className="flex items-center justify-center bg-orange-600 text-white font-semibold"
              title="Оргил ачаалал: 17:00–22:00 (5 цаг)"
            >
              Оргил (17:00–22:00)
            </div>
            <div
              style={{ width: '8.334%' }}
              className="flex items-center justify-center bg-emerald-700 text-emerald-100"
              title="Шөнийн тариф: 22:00–24:00 (2 цаг)"
            >
              Шөнө
            </div>
          </div>

          <div className="relative h-5 text-[10px] text-[var(--color-fg-subtle)] font-mono">
            <span>00:00</span>
            <span className="absolute left-[25%] -translate-x-1/2">06:00</span>
            <span className="absolute left-[70.833%] -translate-x-1/2">17:00</span>
            <span className="absolute left-[91.666%] -translate-x-1/2">22:00</span>
            <span className="float-right">24:00</span>
          </div>
        </CardBody>
      </Card>

      {/* Legal & Regulatory Basis */}
      <Card>
        <CardBody className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">
              Тарифын үндэслэл ба тооцооллын дүрэм
            </h2>
            <span className="inline-flex items-center rounded-md bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-brand)]">
              2026 · №350 тогтоол
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]">
                1
              </span>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[var(--color-fg)]">Батлагдсан тариф</h3>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
                  ЭХЗХ-ны 2026.05.29-ний №350 тогтоолын нэгдүгээр хавсралт.{' '}
                  <a
                    href="https://legalinfo.mn/mn/detail?lawId=17437335868692&showType=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[var(--color-brand)] hover:underline"
                  >
                    Тарифын хүснэгт <ExternalLink className="ml-0.5 h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]">
                2
              </span>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[var(--color-fg)]">Тариф дамнасан хэрэглээ</h3>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
                  06:00, 17:00, 22:00 заагт тоолуурын хэрэглээг цагаар нь хувааж тооцно. Цэнэглэлтийн нийт кВт·ц-ийг
                  хугацаагаар тэнцүү хуваахгүй; тухайн цагийн тоолуурын хэмжилтийг ашиглана.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]">
                3
              </span>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[var(--color-fg)]">Үйлчилгээний үнэ ба өртөг</h3>
                <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
                  Энэхүү загвар нь цахилгааны эрчим хүчний хууль ёсны өртөг болон сонгосон үйлчилгээний нэмэгдлийг
                  тооцно. Станцын эзэмшигч уг тооцоог ашиглан станцынхаа үнийн бодлогыг тохируулах боломжтой.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            📌 <strong>Санамж:</strong> Станцын гэрээнд «Бусад үйлдвэр, ААН байгууллага» ангилал үйлчилдэг бол
            сонгосон тарифыг хэрэглэнэ. Айл өрхийн шөнийн тэглэх хөнгөлөлтийг нийтийн цэнэглэх станцад автоматаар
            хэрэглэхгүй.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
