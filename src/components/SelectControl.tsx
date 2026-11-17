'use client';

import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

type SelectOption<T extends string> = { value: T; label: string };

export default function SelectControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const valueId = useId();
  const searchRef = useRef({ text: '', time: 0 });
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutsidePointer);
    const frame = requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointer);
      cancelAnimationFrame(frame);
    };
  }, [open, selectedIndex]);

  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Tab') {
      // Return to the trigger before the browser chooses the adjacent tab stop.
      triggerRef.current?.focus();
      setOpen(false);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing) return;
      event.preventDefault();
      const now = event.timeStamp;
      const letter = event.key.toLocaleLowerCase();
      const previous = now - searchRef.current.time < 700 ? searchRef.current.text : '';
      const text = previous === letter ? letter : previous + letter;
      searchRef.current = { text, time: now };
      for (let offset = text.length === 1 ? 1 : 0; offset < options.length + 1; offset++) {
        const candidate = (index + offset) % options.length;
        if (options[candidate].label.toLocaleLowerCase().startsWith(text)) {
          optionRefs.current[candidate]?.focus();
          break;
        }
      }
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="ui-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="ui-select-trigger"
        aria-label={ariaLabel}
        aria-describedby={valueId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled || options.length === 0}
        onClick={() => { searchRef.current = { text: '', time: 0 }; setOpen((current) => !current); }}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key) && !open) {
            event.preventDefault();
            searchRef.current = { text: '', time: 0 };
            setOpen(true);
          }
        }}
      >
        <span id={valueId}>{options[selectedIndex]?.label}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="ui-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.2 2.8 2.8 6.2-6.2" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
