'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Apple, Save, Smartphone, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatRelative } from '@/lib/format';
import type {
  AppPlatform,
  AppRelease,
  AppReleaseInput,
  AppReleasePreview,
} from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ErrorNote,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

const PLATFORM_LABELS: Record<AppPlatform, string> = {
  android: 'Android — Google Play',
  ios: 'iOS — App Store',
};

const STORE_HINTS: Record<AppPlatform, string> = {
  android: 'https://play.google.com/store/apps/details?id=mn.eplug.app',
  ios: 'https://apps.apple.com/mn/app/eplug/id0000000000',
};

export function AppVersionsView({ canEdit }: { canEdit: boolean }) {
  const key = apiUrl('app-releases');
  const { data, error, isLoading, mutate } = useSWR<{ data: AppRelease[] }>(key, fetcher);

  if (error) return <ErrorNote>{errorMessage(error)}</ErrorNote>;

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {(data?.data ?? []).map((release) => (
            <PlatformCard
              key={release.platform}
              release={release}
              canEdit={canEdit}
              onSaved={() => void mutate()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  release,
  canEdit,
  onSaved,
}: {
  release: AppRelease;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const platform = release.platform;
  const configured = release.configured !== false;

  const [form, setForm] = React.useState<AppReleaseInput>({
    latestVersion: release.latestVersion ?? '',
    latestBuild: release.latestBuild ?? null,
    minSupportedVersion: release.minSupportedVersion ?? '',
    minSupportedBuild: release.minSupportedBuild ?? null,
    storeUrl: release.storeUrl ?? '',
    releaseNotesMn: release.releaseNotesMn ?? '',
    releaseNotesEn: release.releaseNotesEn ?? '',
    isActive: release.isActive ?? true,
  });
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof AppReleaseInput>(name: K, value: AppReleaseInput[K]) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /** Blank means "not set", which is different from 0. */
  const num = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  async function save() {
    setSaving(true);
    setFields({});
    try {
      await api.put(`app-releases/${platform}`, {
        ...form,
        minSupportedVersion: form.minSupportedVersion || null,
        releaseNotesMn: form.releaseNotesMn || null,
        releaseNotesEn: form.releaseNotesEn || null,
      });
      toast.success(`${PLATFORM_LABELS[platform]} хадгалагдлаа`);
      onSaved();
    } catch (err) {
      const details = (err as { details?: { fieldErrors?: Record<string, string[]> } }).details;
      const fieldErrors = details?.fieldErrors;
      if (fieldErrors) {
        setFields(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? '']),
          ),
        );
      }
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const Icon = platform === 'ios' ? Apple : Smartphone;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 text-[var(--color-fg-muted)]" />
            {PLATFORM_LABELS[platform]}
          </span>
        }
        actions={
          !configured ? (
            <Badge tone="idle">Тохируулаагүй</Badge>
          ) : form.isActive ? (
            <Badge tone="ok">Идэвхтэй</Badge>
          ) : (
            <Badge tone="warn">Унтраасан</Badge>
          )
        }
      />

      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Сүүлийн хувилбар"
            hint="Дэлгүүрт байгаа хувилбар, ж: 1.0.14"
            error={fields.latestVersion}
            htmlFor={`${platform}-latest-version`}
          >
            <Input
              id={`${platform}-latest-version`}
              value={form.latestVersion}
              onChange={(e) => set('latestVersion', e.target.value)}
              placeholder="1.0.14"
              inputMode="decimal"
              disabled={!canEdit}
            />
          </Field>

          <Field
            label="Сүүлийн билд"
            hint="Android: versionCode · iOS: CFBundleVersion"
            error={fields.latestBuild}
            htmlFor={`${platform}-latest-build`}
          >
            <Input
              id={`${platform}-latest-build`}
              value={form.latestBuild ?? ''}
              onChange={(e) => set('latestBuild', num(e.target.value))}
              placeholder="70"
              inputMode="numeric"
              disabled={!canEdit}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)]/40 p-3">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--color-warn)]">
            <TriangleAlert className="h-3.5 w-3.5" />
            Заавал шинэчлэх босго
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Хамгийн бага хувилбар"
              hint="Хоосон бол хэзээ ч албадахгүй"
              error={fields.minSupportedVersion}
              htmlFor={`${platform}-min-version`}
            >
              <Input
                id={`${platform}-min-version`}
                value={form.minSupportedVersion ?? ''}
                onChange={(e) => set('minSupportedVersion', e.target.value)}
                placeholder="1.0.12"
                inputMode="decimal"
                disabled={!canEdit}
              />
            </Field>

            <Field
              label="Хамгийн бага билд"
              hint="Билд илгээсэн апп дээр энэ нь давуу эрхтэй"
              error={fields.minSupportedBuild}
              htmlFor={`${platform}-min-build`}
            >
              <Input
                id={`${platform}-min-build`}
                value={form.minSupportedBuild ?? ''}
                onChange={(e) => set('minSupportedBuild', num(e.target.value))}
                placeholder="65"
                inputMode="numeric"
                disabled={!canEdit}
              />
            </Field>
          </div>
        </div>

        <Field
          label="Дэлгүүрийн холбоос"
          hint={STORE_HINTS[platform]}
          error={fields.storeUrl}
          htmlFor={`${platform}-store-url`}
        >
          <Input
            id={`${platform}-store-url`}
            value={form.storeUrl}
            onChange={(e) => set('storeUrl', e.target.value)}
            placeholder={STORE_HINTS[platform]}
            inputMode="url"
            disabled={!canEdit}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Шинэчлэлтийн тайлбар (MN)" htmlFor={`${platform}-notes-mn`}>
            <Textarea
              id={`${platform}-notes-mn`}
              value={form.releaseNotesMn ?? ''}
              onChange={(e) => set('releaseNotesMn', e.target.value)}
              placeholder="Хэтэвчний алдаа засагдсан, газрын зураг хурдассан."
              rows={3}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Шинэчлэлтийн тайлбар (EN)" htmlFor={`${platform}-notes-en`}>
            <Textarea
              id={`${platform}-notes-en`}
              value={form.releaseNotesEn ?? ''}
              onChange={(e) => set('releaseNotesEn', e.target.value)}
              placeholder="Wallet fixes and a faster map."
              rows={3}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            disabled={!canEdit}
          />
          <span>
            <span className="font-medium">Шалгалтыг идэвхжүүлэх</span>
            <span className="block text-xs text-[var(--color-fg-muted)]">
              Унтраавал аппад “шинэчлэлт алга” гэж хариулна. Буруу тохиргоог апп шинэчлэхгүйгээр
              зогсоох арга.
            </span>
          </span>
        </label>

        <PreviewBox platform={platform} />

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <span className="text-xs text-[var(--color-fg-subtle)]">
            {release.updatedAt
              ? `Сүүлд ${formatRelative(release.updatedAt)}${release.updatedBy ? ` · ${release.updatedBy}` : ''}`
              : 'Хараахан хадгалаагүй'}
          </span>
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!canEdit}>
            <Save className="h-3.5 w-3.5" />
            Хадгалах
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Answers "what would a driver on this build actually see?" against the saved
 * settings — the cheap way to check a force threshold before support calls do it.
 */
function PreviewBox({ platform }: { platform: AppPlatform }) {
  const [version, setVersion] = React.useState('1.0.13');
  const [build, setBuild] = React.useState('68');

  const key =
    version.trim().length > 0
      ? apiUrl(`app-releases/${platform}/preview`, { version, build: build || undefined })
      : null;
  const { data, isLoading } = useSWR<AppReleasePreview>(key, fetcher, {
    keepPreviousData: true,
  });

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <p className="mb-2.5 text-xs font-semibold text-[var(--color-fg-muted)]">
        Туршиж үзэх — энэ хувилбартай жолооч юу харах вэ?
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Хувилбар" className="w-28" htmlFor={`${platform}-test-version`}>
          <Input
            id={`${platform}-test-version`}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Билд" className="w-24" htmlFor={`${platform}-test-build`}>
          <Input
            id={`${platform}-test-build`}
            value={build}
            onChange={(e) => setBuild(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <div className="pb-2">
          {isLoading && !data ? (
            <Badge tone="idle">Шалгаж байна…</Badge>
          ) : !data?.configured ? (
            <Badge tone="idle">Тохируулаагүй</Badge>
          ) : data.forceUpdate ? (
            <Badge tone="danger">Заавал шинэчилнэ — апп нээгдэхгүй</Badge>
          ) : data.updateAvailable ? (
            <Badge tone="warn">Санал болгоно — алгасаж болно</Badge>
          ) : (
            <Badge tone="ok">Шинэчлэх шаардлагагүй</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
