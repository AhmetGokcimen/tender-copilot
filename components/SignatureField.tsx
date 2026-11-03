'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './Icon';

const MAX_W = 600;
const MAX_H = 220;
const MAX_BYTES = 250_000;

/** Reads an image file, shrinks it, and turns near-white paper into transparency. */
async function toSignaturePng(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    if (lum > 235) img.data[i + 3] = 0;
    else if (lum > 190) img.data[i + 3] = Math.round(((235 - lum) / 45) * img.data[i + 3]);
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  if (url.length > MAX_BYTES) throw new Error('size');
  return url;
}

/**
 * The signature image placed on the bid documents' signature block. It is a
 * picture for the page only: submitting in SEAP still needs the company's
 * qualified electronic signature on the file.
 */
export function SignatureField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (png: string | null) => void;
}) {
  const t = useTranslations('signature');
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onChange(await toSignaturePng(file));
    } catch {
      setError(t('error'));
    }
  };

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex min-h-[88px] items-center justify-center rounded-lg border border-dashed border-line-strong bg-sunk/40 p-space-sm">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={t('alt')} className="max-h-20 max-w-full" />
        ) : (
          <span className="text-[13.5px] text-muted">{t('none')}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-space-sm">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex h-9 items-center gap-1 rounded-pill border border-line-strong px-space-sm text-[13.5px] text-ink hover:bg-sunk"
        >
          <Icon name="upload" size="sm" />
          {value ? t('replace') : t('upload')}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-[13.5px] text-muted hover:text-ink">
            {t('remove')}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-[12.5px] leading-[18px] text-muted">{t('note')}</p>
      {error && (
        <p role="alert" className="text-[12.5px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
