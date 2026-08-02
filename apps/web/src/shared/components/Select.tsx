import * as RadixSelect from "@radix-ui/react-select";
import { directionOf } from "@commander/shared";
import { useI18n } from "@/shared/i18n/I18nProvider";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

/**
 * The project's select — Radix's, wrapped (web CONSTITUTION §8), replacing the
 * native `<select>` whose menu is drawn by the OS and cannot be themed, animated
 * or set RTL. Every option list now carries the same styling and motion.
 *
 * `dir` is passed explicitly from the current locale: Radix decides which side
 * the menu aligns to and which arrow keys advance from it, and without this it
 * would default to LTR and open on the wrong side in Arabic.
 *
 * Radix forbids an empty option value, so a "no filter / none" choice must be a
 * real option with its own sentinel — callers map it, they never pass "".
 */
export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  id,
  disabled,
  "aria-label": ariaLabel,
}: SelectProps) {
  const { locale } = useI18n();

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} dir={directionOf(locale)}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className="control select-trigger"
        disabled={disabled}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="select-caret">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="select-menu"
          position="popper"
          sideOffset={6}
          collisionPadding={8}
        >
          <RadixSelect.Viewport className="select-viewport">
            {options.map((option) => (
              <RadixSelect.Item key={option.value} value={option.value} className="select-item">
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="select-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" focusable="false">
                    <path
                      d="M3 8.5l3.5 3.5L13 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
