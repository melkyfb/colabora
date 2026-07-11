import { useEffect, useRef, useState } from "react";

export function ColorSwatchPicker({
  label,
  title,
  colors,
  activeColor,
  onPick,
  onClear,
}: {
  label: string;
  title: string;
  colors: string[];
  activeColor: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <span className="color-picker" ref={rootRef}>
      <button
        title={title}
        onClick={() => setOpen((v) => !v)}
        style={activeColor ? { borderColor: activeColor } : undefined}
      >
        {label}
      </button>
      {open && (
        <div className="color-picker-popover">
          <div className="color-picker-swatches">
            {colors.map((c) => (
              <div
                key={c}
                className="color-picker-swatch"
                style={{ background: c }}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <button
            className="color-picker-clear"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Remover cor
          </button>
        </div>
      )}
    </span>
  );
}
