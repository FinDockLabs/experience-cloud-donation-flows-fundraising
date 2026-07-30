import LOCALE from '@salesforce/i18n/locale';

// ISO 4217 currency code: three uppercase letters (e.g. EUR, USD, GBP).
export const ISO_CODE = /^[A-Z]{3}$/;

// Salesforce exposes the locale with underscores (e.g. "en_US"); Intl expects BCP 47 dashes.
export function currencyLocale() {
    return LOCALE ? LOCALE.replace(/_/g, '-') : 'en-US';
}

/**
 * Trim/upper-case a currency code and validate it as ISO 4217. Returns '' for anything invalid.
 * Pass logInvalid=true to log a diagnostic when a non-empty, non-ISO value is rejected (used by
 * the runtime picker to surface misconfigured allow-lists; the Flow Builder editor stays quiet).
 */
export function normalizeCurrency(code, logInvalid = false) {
    const raw = (code || '').toString().trim();
    if (!raw) {
        return '';
    }
    const upper = raw.toUpperCase();
    if (!ISO_CODE.test(upper)) {
        if (logInvalid) {
            // eslint-disable-next-line no-console
            console.error(`currencyUtils: "${code}" is not a valid ISO 4217 currency code, ignoring it.`);
        }
        return '';
    }
    return upper;
}

// Remove duplicate entries, preserving first-seen order.
export function dedupe(list) {
    return [...new Set(list)];
}

/**
 * Number of fraction digits a currency uses (e.g. EUR/USD -> 2, JPY -> 0). Falls back to 2 when
 * the code is missing or unrecognized, matching the most common minor-unit convention.
 */
export function currencyDecimals(code, locale = 'en-US') {
    if (!code) {
        return 2;
    }
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code })
            .resolvedOptions().maximumFractionDigits;
    } catch {
        return 2;
    }
}

/**
 * Narrow currency symbol and its position relative to the amount, e.g. EUR in en-US -> "€"/prefix,
 * SEK in sv-SE -> "kr"/suffix. Returns an empty prefix symbol when no code is given so callers can
 * render nothing rather than a placeholder currency.
 */
export function currencySymbolInfo(code, locale) {
    if (!code) {
        return { symbol: '', position: 'prefix' };
    }
    try {
        const parts = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).formatToParts(0);
        const currencyIdx = parts.findIndex(p => p.type === 'currency');
        const integerIdx  = parts.findIndex(p => p.type === 'integer');
        const symbol      = parts[currencyIdx] ? parts[currencyIdx].value : code;
        const position    = currencyIdx < integerIdx ? 'prefix' : 'suffix';
        return { symbol, position };
    } catch {
        return { symbol: code, position: 'prefix' };
    }
}

/**
 * Clean a raw amount string for a currency with the given number of decimals: normalizes the
 * decimal separator to ".", strips non-numeric characters, collapses extra dots, and trims the
 * fraction to the currency's precision (0 decimals drops the dot entirely). Pure string in/out —
 * callers own reading from and writing back to the DOM.
 */
export function sanitizeAmountInput(rawValue, decimals) {
    let val = (rawValue || '').toString();
    val = val.replace(',', '.');
    val = val.replace(/[^0-9.]/g, '');
    const firstDot = val.indexOf('.');
    if (firstDot !== -1) {
        val = val.substring(0, firstDot + 1) + val.substring(firstDot + 1).replace(/\./g, '');
    }
    const dotIdx = val.indexOf('.');
    if (decimals === 0 && dotIdx !== -1) {
        val = val.substring(0, dotIdx);
    } else if (decimals > 0 && dotIdx !== -1 && val.length - dotIdx - 1 > decimals) {
        val = val.substring(0, dotIdx + decimals + 1);
    }
    return val;
}

/**
 * Localized currency name via Intl.DisplayNames, following FinTech i18n standards.
 * - withCode=false (default): just the name, e.g. en "Euro" / fr "euro".
 * - withCode=true: "CODE - name" when a distinct name exists, else the bare code,
 *   e.g. fr-FR "EUR - euro", en-US "EUR - Euro".
 * Falls back to the code when the name is unavailable.
 */
export function localizedCurrencyName(code, locale, withCode = false) {
    if (!code) {
        return '';
    }
    try {
        const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
        if (!name || name.toLowerCase() === code.toLowerCase()) {
            return code;
        }
        return withCode ? `${code} - ${name}` : name;
    } catch {
        return code;
    }
}
