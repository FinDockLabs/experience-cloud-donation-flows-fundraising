import { createElement } from 'lwc';
import AmountAndFrequency, {
    toPlainNumberString,
    sanitizeLocaleAmountInput
} from 'c/amountAndFrequency';

// Round-trip: whatever Intl.NumberFormat produces for a locale (grouping + decimal separators)
// must parse back to the plain "1234.56" form. Using Intl to build the input keeps the test
// robust across ICU versions instead of hard-coding separator characters.
function formatted(value, locale) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

describe('toPlainNumberString — locale-aware amount parsing', () => {
    const locales = ['en-US', 'de-DE', 'fr-FR', 'nl-NL'];
    const values = [1234.56, 25.5, 1000000, 0.99];

    locales.forEach((locale) => {
        values.forEach((value) => {
            it(`round-trips ${value} for ${locale}`, () => {
                expect(toPlainNumberString(formatted(value, locale), locale)).toBe(String(value));
            });
        });
    });

    it('fr/de decimal comma without grouping', () => {
        expect(toPlainNumberString('25,50', 'fr-FR')).toBe('25.50');
        expect(toPlainNumberString('0,99', 'de-DE')).toBe('0.99');
    });

    it('en-US thousands comma and dot decimal', () => {
        expect(toPlainNumberString('1,234.56', 'en-US')).toBe('1234.56');
    });

    // In comma-decimal locales (de/nl) "." is unambiguously the grouping separator — the field only
    // ever carries the locale form the user sees, so a "." is never a stray decimal point to guess
    // at. (Previously the component wrote the dot-decimal internal value back into the field, which
    // forced a fragile "is this dot a decimal?" heuristic that broke on the 3rd fraction digit.)
    it('treats "." as grouping in de/nl regardless of trailing digit count', () => {
        expect(toPlainNumberString('1.234', 'de-DE')).toBe('1234');
        expect(toPlainNumberString('1.234.567', 'de-DE')).toBe('1234567');
        expect(toPlainNumberString('25.5', 'de-DE')).toBe('255');
        expect(toPlainNumberString('0.99', 'nl-NL')).toBe('099');
    });

    it('prefers the explicit decimal comma over dot-grouping in de/nl', () => {
        // Once the real decimal char is present, the dot is unambiguously grouping.
        expect(toPlainNumberString('1.234,56', 'de-DE')).toBe('1234.56');
        expect(toPlainNumberString('25,50', 'de-DE')).toBe('25.50');
    });

    it('keeps only the first decimal point and strips junk characters', () => {
        expect(toPlainNumberString('12.3.4', 'en-US')).toBe('12.34');
        expect(toPlainNumberString('ab12x.5', 'en-US')).toBe('12.5');
    });

    it('handles empty and nullish input', () => {
        expect(toPlainNumberString('', 'en-US')).toBe('');
        expect(toPlainNumberString(null, 'en-US')).toBe('');
        expect(toPlainNumberString(undefined, 'en-US')).toBe('');
    });
});

describe('sanitizeLocaleAmountInput — keystroke-level input filtering', () => {
    it('keeps digits and a single locale decimal separator', () => {
        expect(sanitizeLocaleAmountInput('25,50', ',', 2)).toBe('25,50');
        expect(sanitizeLocaleAmountInput('25.50', '.', 2)).toBe('25.50');
    });

    it('drops grouping separators while typing (re-applied on blur)', () => {
        expect(sanitizeLocaleAmountInput('1.234,56', ',', 2)).toBe('1234,56');
        expect(sanitizeLocaleAmountInput('1,234.56', '.', 2)).toBe('1234.56');
    });

    // The reported bug: comma-decimal locale, currency allows 2 decimals, user types a 3rd fraction
    // digit. The extra digit must be rejected — the decimal separator must NOT disappear and the
    // amount must NOT collapse to a 100x-larger integer.
    it('rejects a 3rd fraction digit instead of dropping the decimal separator', () => {
        expect(sanitizeLocaleAmountInput('25,505', ',', 2)).toBe('25,50');
        expect(sanitizeLocaleAmountInput('25,5', ',', 2)).toBe('25,5');
        expect(sanitizeLocaleAmountInput('25,51', ',', 2)).toBe('25,51');
    });

    it('ignores a second decimal separator (digits after it still count as fraction)', () => {
        // The 2nd "," is dropped; "5" and "0" are the two allowed fraction digits.
        expect(sanitizeLocaleAmountInput('25,5,0', ',', 2)).toBe('25,50');
        // A 3rd fraction digit after a dropped 2nd separator is still rejected.
        expect(sanitizeLocaleAmountInput('25,5,05', ',', 2)).toBe('25,50');
    });

    it('strips the decimal separator entirely for zero-decimal currencies', () => {
        expect(sanitizeLocaleAmountInput('1234,56', ',', 0)).toBe('1234');
        expect(sanitizeLocaleAmountInput('1234.56', '.', 0)).toBe('1234');
    });

    it('drops letters and stray symbols', () => {
        expect(sanitizeLocaleAmountInput('ab12x,5€', ',', 2)).toBe('12,5');
    });

    it('preserves high-precision integers without a Number round-trip', () => {
        expect(sanitizeLocaleAmountInput('12345678901234567890', ',', 2))
            .toBe('12345678901234567890');
    });

    it('handles empty and nullish input', () => {
        expect(sanitizeLocaleAmountInput('', ',', 2)).toBe('');
        expect(sanitizeLocaleAmountInput(null, ',', 2)).toBe('');
        expect(sanitizeLocaleAmountInput(undefined, ',', 2)).toBe('');
    });
});

describe('amount formatting before a currency is set', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows preset amounts without a currency symbol and formats them as plain numbers', () => {
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.presetAmountsOneTime = '25,50,100';
        // currencyCode intentionally left unset (empty) — mimics the first render before
        // currencyPicker resolves. No hardcoded fallback currency should leak into the labels.
        document.body.appendChild(element);

        const labels = Array.from(
            element.shadowRoot.querySelectorAll('label')
        ).map((el) => el.textContent);

        // No currency symbol/code, and no stray leading space from a missing symbol.
        labels.forEach((text) => {
            expect(text).not.toMatch(/[€$£]|EUR|USD/);
            expect(text).toBe(text.trim());
        });
    });

    it('rejects a non-ISO currencyCode instead of rendering the raw text as the currency', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.presetAmountsOneTime = '25,50,100';
        // A misconfigured Flow variable — a label, not an ISO 4217 code.
        element.defaultCurrency = 'Some currency';
        document.body.appendChild(element);

        // Invalid code normalizes to '' and is not emitted as the selected currency.
        expect(element.selectedCurrency).toBe('');

        // The raw text must not leak into the currency adornment or the preset labels — with no
        // valid code the adornment renders empty (no symbol) rather than echoing the input.
        const adornment = element.shadowRoot.querySelector('.currency-adornment');
        expect((adornment?.textContent || '').trim()).toBe('');
        Array.from(element.shadowRoot.querySelectorAll('label')).forEach((el) => {
            expect(el.textContent).not.toMatch(/Some currency/i);
        });

        consoleError.mockRestore();
    });
});

function enterCustomAmount(element, raw) {
    const input = element.shadowRoot.querySelector('.custom-amount-input-native');
    input.value = raw;
    input.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }));
    return input;
}

describe('amount is emitted as an exact string, not a float round-trip', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('preserves high-precision digits that Number() would corrupt', async () => {
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.defaultCurrency = 'EUR';
        document.body.appendChild(element);
        await Promise.resolve();

        // Number("12345678901234567890") -> 12345678901234567000: a silently altered charge.
        // An integer amount isn't touched by the decimal-trim path, so it reaches the getter as-is.
        const exact = '12345678901234567890';
        enterCustomAmount(element, exact);
        await Promise.resolve();

        expect(element.amountOneTime).toBe(exact);
        expect(element.amountOneTime).not.toBe(String(Number(exact)));
    });

    it('emits the exact typed decimal amount', async () => {
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.defaultCurrency = 'EUR';
        document.body.appendChild(element);
        await Promise.resolve();

        enterCustomAmount(element, '20.50');
        await Promise.resolve();

        expect(element.amountOneTime).toBe('20.50');
    });
});

describe('restored amounts are trimmed to the currency decimals', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        try { sessionStorage.clear(); } catch { /* unavailable */ }
    });

    it('trims a sessionStorage value carrying more decimals than the currency allows', async () => {
        // Simulate a value saved under a 3-decimal currency, restored under a 2-decimal one.
        const state = JSON.stringify({ frequency: 'oneTime', selectedPreset: null, customAmount: '999.999' });
        // Cover both the real key and the fallback key used when pathname is unavailable.
        try { sessionStorage.setItem(`af-state-${window.location.pathname}`, state); } catch { /* ignore */ }
        try { sessionStorage.setItem('af-state', state); } catch { /* ignore */ }

        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.defaultCurrency = 'EUR'; // 2 decimals
        document.body.appendChild(element);
        await Promise.resolve();

        // Restored "999.999" must be trimmed to "999.99" — never emit more precision than allowed.
        expect(element.amountOneTime).toBe('999.99');
    });
});

describe('aria-describedby references the error node only while it exists', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('omits the error id when there is no error and includes it once an error shows', async () => {
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.defaultCurrency = 'EUR';
        element.minAmount = 5;
        document.body.appendChild(element);
        await Promise.resolve();

        const input = enterCustomAmount(element, '10');
        await Promise.resolve();

        // No error: describedby must not point at a non-existent error node.
        let describedBy = input.getAttribute('aria-describedby');
        expect(element.shadowRoot.querySelector('.amount-error')).toBeNull();
        expect(describedBy).not.toMatch(/custom-amount-error/);

        // Trigger a validation error (below min).
        enterCustomAmount(element, '1');
        await Promise.resolve();

        const errorEl = element.shadowRoot.querySelector('.amount-error');
        expect(errorEl).not.toBeNull();
        describedBy = input.getAttribute('aria-describedby');
        // Every IDREF in describedby must resolve to a real element.
        describedBy.split(/\s+/).forEach((id) => {
            expect(element.shadowRoot.querySelector(`[id="${id}"]`)).not.toBeNull();
        });
        expect(describedBy).toContain(errorEl.id);
    });
});
