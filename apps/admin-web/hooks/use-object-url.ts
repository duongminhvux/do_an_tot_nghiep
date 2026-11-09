"use client";
import { useEffect, useState } from "react";
/** One URL per File lifecycle, including replacement and unmount. */
export function useObjectUrl(file: File | null) {
  const [value, setValue] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) {
      setValue(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setValue({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return value?.file === file ? value?.url : null;
}
