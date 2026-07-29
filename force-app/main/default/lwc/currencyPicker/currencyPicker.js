import { api, track, LightningElement } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import LOCALE from '@salesforce/i18n/locale';
import USER_CURRENCY from '@salesforce/i18n/currency';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';
import { labels } from './currencyPickerLabels';

const ISO_CODE = /^[A-Z]{3}$/;

export default class CurrencyPicker extends LightningElement {
    @api allowedCurrencies = '';
    @api defaultCurrency = '';

    @api
    get value() {
        return this._value;
    }
    set value(val) {
        const code = normalize(val);
        if (code && code !== this._value) {
            this._value = code;
            if (this._currencies.length && !this._currencies.includes(code)) {
                this._currencies = dedupe([...this._currencies, code]);
            }
        }
    }

    @track _value = '';

    labels = labels;
    _currencies = [];

    get options() {
        return this._currencies.map((code) => ({
            label: getLocalizedCurrencyLabel(code, this._locale),
            value: code
        }));
    }

    get showPicker() {
        return this._currencies.length > 1;
    }

    get selectedCurrencyAssistiveText() {
        const label = getLocalizedCurrencyLabel(this._value, this._locale);
        return `${this.labels.ec_label_currency}: ${label}`;
    }

    get _locale() {
        return LOCALE ? LOCALE.replace(/_/g, '-') : 'en-US';
    }

    connectedCallback() {
        const explicit = dedupe((this.allowedCurrencies || '').split(',').map(normalize).filter(Boolean));
        if (explicit.length) {
            this._applyCurrencies(explicit);
            return;
        }
        this._applyCurrencies(this._fallbackSingle());
        this._autoDetect();
    }

    _autoDetect() {
        getActiveCurrencies()
            .then((currencies) => {
                const codes = dedupe((currencies || []).map(normalize).filter(Boolean));
                if (codes.length > 1) {
                    this._applyCurrencies(codes);
                }
            })
            .catch(() => {
                /* keep the fallback */
            });
    }

    _applyCurrencies(list) {
        this._currencies = list.length ? list : this._fallbackSingle();
        this._value = this._resolveInitial();
        this._emit();
    }

    _fallbackSingle() {
        const single = normalize(this.defaultCurrency) || normalize(USER_CURRENCY);
        return single ? [single] : [];
    }

    _resolveInitial() {
        const preferred = normalize(this.defaultCurrency);
        if (preferred && this._currencies.includes(preferred)) {
            return preferred;
        }
        return this._currencies[0] || preferred || '';
    }

    _emit() {
        this.dispatchEvent(new CustomEvent('currencychange', { detail: { currency: this._value } }));
        this.dispatchEvent(new FlowAttributeChangeEvent('value', this._value));
    }

    handleChange(event) {
        this._value = event.detail.value;
        this._emit();
    }
}

function normalize(code) {
    const upper = (code || '').toString().trim().toUpperCase();
    return ISO_CODE.test(upper) ? upper : '';
}

function dedupe(list) {
    return [...new Set(list)];
}

/**
 * Returns localized currency display string according to FinTech i18n standards.
 * E.g., fr-FR: "EUR - euro", en-US: "EUR - Euro"
 */
function getLocalizedCurrencyLabel(code, locale) {
    if (!code) return '';
    try {
        const displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
        const name = displayNames.of(code);
        return name && name.toLowerCase() !== code.toLowerCase() ? `${code} - ${name}` : code;
    } catch {
        return code;
    }
}
