import Image, { type ImageProps } from "next/image";

import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

type EvolvedLogoImageProps = Omit<ImageProps, "src" | "alt"> & {
  alt?: string;
};

/**
 * Evolved Hair Clinics logo — always loaded via static import (never `/evolved-logo.png` string paths).
 */
export function EvolvedLogoImage({
  alt = "Evolved Hair Clinics Logo",
  width = 180,
  height = 40,
  priority = true,
  className,
  ...rest
}: EvolvedLogoImageProps) {
  return (
    <Image
      src={PUBLIC_IMAGES.evolvedLogo}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      {...rest}
    />
  );
}
