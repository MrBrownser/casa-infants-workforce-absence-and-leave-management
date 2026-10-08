'use client';

import Image, { type ImageLoaderProps } from 'next/image';

/**
 * FASI's plasticine house (see DESIGN.md → Illustration), cut out from its
 * background with its soft cast shadow kept. Used as the wordmark mark, on the
 * landing page and in empty states.
 *
 * The pre-built WebP sizes live in `public/brand/`; the loader picks the
 * smallest one that covers the requested width, so nothing is re-encoded.
 * The untouched originals are in `public/brand/fasi-source/`.
 */
const SIZES = [256, 512, 835] as const;

function houseLoader({ width }: ImageLoaderProps) {
  const size = SIZES.find((s) => s >= width) ?? SIZES[SIZES.length - 1];
  return `/brand/casa-plastelina-${size}.webp`;
}

export function HouseMark({ className }: Readonly<{ className?: string }>) {
  return (
    <Image
      loader={houseLoader}
      src="casa-plastelina"
      alt=""
      width={835}
      height={893}
      sizes="(min-width: 768px) 320px, 70vw"
      className={`object-contain ${className ?? ''}`}
    />
  );
}
