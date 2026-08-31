import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

const LENGTH = 6;

/**
 * Six single-character boxes that behave like one field.
 *
 * Accessibility notes: each box is a labelled input rather than a styled
 * div, backspace steps to the previous box, arrow keys move between them,
 * and pasting a code from an SMS fills the whole row instead of dropping
 * five characters.
 */
export function OtpInput({ value, onChange, onComplete, disabled = false }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, '').slice(0, LENGTH).split('');

  const commit = (next: string) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  };

  const setDigit = (index: number, digit: string) => {
    const chars = value.replace(/\D/g, '').slice(0, LENGTH).split('');
    chars[index] = digit;
    const next = chars.join('').slice(0, LENGTH);
    commit(next);

    if (digit && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const chars = value.replace(/\D/g, '').split('');
      if (chars[index]) {
        chars[index] = '';
        commit(chars.join(''));
      } else if (index > 0) {
        chars[index - 1] = '';
        commit(chars.join(''));
        refs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    commit(pasted);
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="otp-row" role="group" aria-label="6-digit verification code">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          // Lets the browser / OS offer the SMS code on the first box.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          className={`otp-box ${digits[i] ? 'otp-box--filled' : ''}`}
          value={digits[i] ?? ''}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
