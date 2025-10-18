import { useEffect, useRef, useState } from "react";

export function useIsInputFocused() {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);
    const textarea = ref.current;
    if (textarea) {
      textarea.addEventListener("focus", handleFocus);
      textarea.addEventListener("blur", handleBlur);
    }
    return () => {
      if (textarea) {
        textarea.removeEventListener("focus", handleFocus);
        textarea.removeEventListener("blur", handleBlur);
      }
    };
  }, []);

  return { ref, isFocused };
}
