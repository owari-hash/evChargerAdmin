'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { apiUploadForm, errorMessage } from '@/lib/client';
import { Button, Checkbox, ErrorNote, Field, Input, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import type { Announcement } from '@/lib/types';

export function AnnouncementModal({
  announcement,
  onClose,
  onSaved,
}: {
  announcement?: Announcement | null;
  onClose: () => void;
  onSaved?: (saved: Announcement) => void;
}) {
  const isNew = !announcement;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState(announcement?.title ?? '');
  const [body, setBody] = React.useState(announcement?.body ?? '');
  const [isActive, setIsActive] = React.useState(announcement?.isActive ?? true);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(announcement?.imageUrl ?? null);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setRemoveImage(false);
    if (file) setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setPreview(null);
    setRemoveImage(true);
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError('Гарчиг болон агуулгыг бөглөнө үү');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('title', title.trim());
      form.set('body', body.trim());
      form.set('isActive', String(isActive));
      if (imageFile) form.set('image', imageFile);
      if (removeImage) form.set('removeImage', 'true');

      const saved = isNew
        ? await apiUploadForm<Announcement>('POST', 'announcements', form)
        : await apiUploadForm<Announcement>('PATCH', `announcements/${announcement.id}`, form);

      toast.success(isNew ? 'Мэдээ нийтлэгдлээ' : 'Мэдээ шинэчлэгдлээ');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Шинэ мэдээ' : 'Мэдээ засах'}
      description="Нэвтэрсэн бүх жолоочид kiosk/апп дээр цонх хэлбэрээр нэг удаа харагдана."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {isNew ? 'Нийтлэх' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Field label="Гарчиг">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Жишээ: Шинэ станц нээгдлээ" />
        </Field>

        <Field label="Агуулга">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        <Field label="Зураг" hint="Заавал биш. jpg, png, webp, gif — хамгийн ихдээ 5MB.">
          <div className="space-y-2">
            {preview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-side preview of a user-picked file / already-uploaded image; not worth remotePatterns config. */}
                <img src={preview} alt="" className="h-28 w-auto rounded-lg border border-[var(--color-border)] object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-danger)] text-xs text-white"
                  aria-label="Зураг хасах"
                >
                  ×
                </button>
              </div>
            ) : null}
            <Input type="file" accept="image/*" onChange={pickImage} />
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Идэвхтэй (жолоочдод харуулах)
        </label>
      </div>
    </Modal>
  );
}
