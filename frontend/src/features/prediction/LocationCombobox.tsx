import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LocationOption } from "./types";
import styles from "./LocationCombobox.module.css";

type Props = {
  label: string;
  value: string;
  options: LocationOption[];
  onChange: (value: string) => void;
};

export function LocationCombobox({ label, value, options, onChange }: Props) {
  const listId = useId();
  const host = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];
  const [search, setSearch] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-HK");
    if (!keyword || keyword === selected?.name.toLocaleLowerCase("zh-HK")) return options;
    return options.filter((option) => `${option.name} ${option.city} ${option.id}`.toLocaleLowerCase("zh-HK").includes(keyword));
  }, [options, search, selected?.name]);

  useEffect(() => {
    setSearch(selected?.name ?? "");
    setActiveIndex(0);
  }, [selected?.id, selected?.name]);

  function choose(option: LocationOption) {
    onChange(option.id);
    setSearch(option.name);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setSearch(selected?.name ?? "");
      setOpen(false);
    }
  }

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div
        className={styles.combobox}
        ref={host}
        onBlur={(event) => {
          if (!host.current?.contains(event.relatedTarget)) {
            setSearch(selected?.name ?? "");
            setOpen(false);
          }
        }}
      >
        <input
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
          autoComplete="off"
          value={search}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => { setSearch(event.target.value); setOpen(true); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" aria-label={`展开${label}列表`} onClick={() => setOpen((current) => !current)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>
        {open && (
          <div className={styles.options} id={listId} role="listbox" aria-label={`${label}固定地点`}>
            {filtered.length === 0 && <p>没有匹配地点，仅支持列表中的固定地点。</p>}
            {filtered.map((option, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${option.id}`}
                aria-selected={option.id === value}
                className={index === activeIndex ? styles.active : undefined}
                key={option.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <strong>{option.name}</strong><small>{option.city}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}
