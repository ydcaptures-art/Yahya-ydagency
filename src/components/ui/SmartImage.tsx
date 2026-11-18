"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import clsx from "clsx";

/**
 * next/image with an elegant champagne placeholder. If an image fails to load
 * (e.g. a removed URL), the placeholder remains instead of a broken icon.
 */
export function SmartImage({ className, wrapperClassName, alt, ...props }: ImageProps & { wrapperClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={clsx(
        "img-placeholder overflow-hidden",
        !/\b(absolute|fixed)\b/.test(wrapperClassName ?? "") && "relative",
        wrapperClassName,
      )}
    >
      {!failed && props.src ? (
        <Image
          {...props}
          alt={alt}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className={clsx("object-cover transition-opacity duration-700", loaded ? "opacity-100" : "opacity-0", className)}
        />
      ) : null}
    </div>
  );
}
