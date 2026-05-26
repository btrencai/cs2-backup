import { useEffect, useMemo, useRef, useState } from "react";

export interface AvatarSelectOption {
  id: string;
  label: string;
  meta?: string;
  avatarUrl?: string | null;
}

interface AvatarSelectProps {
  label: string;
  options: AvatarSelectOption[];
  value: string;
  onChange: (value: string) => void;
  emptyText?: string;
}

const USER_ICON_PATH =
  "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z";

function UserIcon() {
  return (
    <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={USER_ICON_PATH} />
    </svg>
  );
}

function Avatar({ option }: { option: AvatarSelectOption }) {
  const [failed, setFailed] = useState(false);

  if (option.avatarUrl && !failed) {
    return (
      <span className="avatar-select-avatar">
        <img src={option.avatarUrl} alt={option.label} draggable={false} onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span className="avatar-select-avatar fallback">
      <UserIcon />
    </span>
  );
}

export default function AvatarSelect({
  label,
  options,
  value,
  onChange,
  emptyText = "暂无可选用户",
}: AvatarSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => options.find((option) => option.id === value) || options[0],
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectOption = (option: AvatarSelectOption) => {
    onChange(option.id);
    setOpen(false);
  };

  return (
    <div className="avatar-select" ref={rootRef}>
      <label className="form-label">{label}</label>
      <button
        className="avatar-select-trigger"
        type="button"
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {selected ? (
          <>
            <Avatar option={selected} />
            <span className="avatar-select-copy">
              <span className="avatar-select-title">{selected.label}</span>
              {selected.meta && <span className="avatar-select-meta">{selected.meta}</span>}
            </span>
          </>
        ) : (
          <span className="avatar-select-empty">{emptyText}</span>
        )}
        <svg className="avatar-select-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && options.length > 0 && (
        <div className="avatar-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.id}
              className={`avatar-select-option${option.id === selected?.id ? " active" : ""}`}
              type="button"
              role="option"
              aria-selected={option.id === selected?.id}
              onClick={() => selectOption(option)}
            >
              <Avatar option={option} />
              <span className="avatar-select-copy">
                <span className="avatar-select-title">{option.label}</span>
                {option.meta && <span className="avatar-select-meta">{option.meta}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
