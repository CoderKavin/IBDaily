/**
 * Input - Clean text input with subtle styling
 * Character count shown subtly when approaching limit
 */

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  label?: string;
}

export default function Input({
  value,
  onChange,
  placeholder,
  maxLength = 140,
  required = false,
  label,
}: InputProps) {
  const charCount = value.length;
  const nearLimit = maxLength && charCount > maxLength * 0.7;
  const atLimit = maxLength && charCount >= maxLength;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          required={required}
          className="
            w-full px-4 py-3
            text-sm text-neutral-900 dark:text-white
            placeholder:text-neutral-400 dark:placeholder:text-neutral-500
            bg-neutral-50 dark:bg-neutral-800
            border border-neutral-200 dark:border-neutral-700
            rounded-lg
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-1
            focus:border-transparent
          "
        />
        {nearLimit && (
          <span
            className={`
              absolute right-3 top-1/2 -translate-y-1/2
              text-xs tabular-nums
              ${atLimit ? "text-amber-600 dark:text-amber-400" : "text-neutral-400"}
            `}
          >
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
