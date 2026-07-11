import { useState } from "react";

const MAX_ROWS = 6;
const MAX_COLS = 8;

export function TablePicker({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  return (
    <span className="table-picker">
      <button title="Inserir tabela" onClick={() => setOpen((v) => !v)}>
        ⊞ Tabela
      </button>
      {open && (
        <div className="table-picker-popover" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
          <div className="table-picker-grid">
            {Array.from({ length: MAX_ROWS }, (_, ri) => {
              const r = ri + 1;
              return (
                <div key={r} className="table-picker-row">
                  {Array.from({ length: MAX_COLS }, (_, ci) => {
                    const c = ci + 1;
                    const on = r <= hover.r && c <= hover.c;
                    return (
                      <div
                        key={c}
                        className={on ? "table-picker-cell on" : "table-picker-cell"}
                        onMouseEnter={() => setHover({ r, c })}
                        onClick={() => {
                          onInsert(r, c);
                          setOpen(false);
                          setHover({ r: 0, c: 0 });
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="table-picker-label">
            {hover.r > 0 ? `${hover.c} x ${hover.r}` : "Passe o mouse na grade"}
          </div>
        </div>
      )}
    </span>
  );
}
