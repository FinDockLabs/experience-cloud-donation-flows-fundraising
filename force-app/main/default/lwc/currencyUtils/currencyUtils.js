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
