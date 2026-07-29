import { LightningElement, api } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import { currencyLocale, localizedCurrencyName } from 'c/currencyUtils';
import { labels } from './amountAndFrequencyLabels';

const DEFAULT_AMOUNTS_ONE_TIME  = '25,50,100,250,500,1000';
const DEFAULT_AMOUNTS_RECURRING = '5,10,25,60,125,250';
const DEFAULT_FREQ_1_VALUE      = 'oneTime';
const DEFAULT_FREQ_2_VALUE      = 'recurring';

// Module-level counter ensures unique DOM IDs when multiple instances are on the same page.
let _nextInstanceId = 0;

export default class AmountAndFrequency extends LightningElement {
    _instanceId = ++_nextInstanceId;
    _frequency = DEFAULT_FREQ_1_VALUE;
    _selectedPresetOneTime   = null;
    _selectedPresetRecurring = null;
    _customAmount = '';
    _validationError         = '';
    _currencyCode            = '';

    labels = labels;

    @api freq1Value = DEFAULT_FREQ_1_VALUE;
    @api freq2Value = DEFAULT_FREQ_2_VALUE;
    @api showFrequencyToggle   = false;

    @api presetAmountsOneTime   = DEFAULT_AMOUNTS_ONE_TIME;
    @api presetAmountsRecurring = DEFAULT_AMOUNTS_RECURRING;

    @api minAmount       = 1;
    @api maxAmount       = 0;
    @api defaultFrequency = '';

    // Value written to the recurring record's Frequency field (e.g. Monthly, Weekly).
    @api recurringFrequency = 'Monthly';

    @api
    get currencyCode() {
        return this._currencyCode;
    }
    set currencyCode(value) {
        const next = (value || '').toUpperCase();
        if (this._currencyCode === next) return;

        const oldCurrency = this._currencyCode;
        this._currencyCode = next;

        // Clear custom amount if it has more decimal places than the new currency allows.
        // Rounding or truncating silently would change the payment amount without user awareness.
        if (oldCurrency && this._customAmount !== '') {
            const dotIdx = this._customAmount.indexOf('.');
            const decimals = this._currencyDecimals;

            if (decimals === 0 && dotIdx !== -1) {
                this._customAmount = '';
            } else if (dotIdx !== -1 && this._customAmount.length - dotIdx - 1 > decimals) {
                this._customAmount = '';
            } else {
                this._validateAmount(Number(this._customAmount));
            }
        }

        this._dispatchChange();
    }

    @api
    get frequency() {
        return this._frequency;
    }
    set frequency(value) {
        if (value) this._frequency = value;
    }

    get _amount() {
        if (this._customAmount !== '') {
            const n = Number(this._customAmount);
            return isNaN(n) ? null : n;
        }
        return this._selectedPreset;
    }

    @api
    get amountOneTime() {
        if (this._frequency !== 'oneTime') return null;
        const amt = this._amount;
        return amt !== null ? String(amt) : null;
    }

    @api
    get amountRecurring() {
        if (this._frequency !== 'recurring') return null;
        const amt = this._amount;
        return amt !== null ? String(amt) : null;
    }

    @api
    get isAmountSelected() {
        return this._amount !== null && this._amount > 0;
    }

    // Routes preset read/write to the bucket that matches the active frequency.
    get _selectedPreset() {
        return this._frequency === this.freq2Value
            ? this._selectedPresetRecurring
            : this._selectedPresetOneTime;
    }
    set _selectedPreset(val) {
        if (this._frequency === this.freq2Value) {
            this._selectedPresetRecurring = val;
        } else {
            this._selectedPresetOneTime = val;
        }
    }

    get _locale() {
        return currencyLocale();
    }

    get frequencyGroupName(){
        return `frequency-${this._instanceId}`;
    }

    get presetName() {
        return `preset-${this._instanceId}`;
    }

    get frequencyOnceId() {
        return `freq-1-${this._instanceId}`;
    }

    get frequencyMonthlyId() {
        return `freq-2-${this._instanceId}`;
    }

    get customAmountId() {
        return `custom-amount-${this._instanceId}`;
    }

    get customAmountErrorId() {
        return `custom-amount-error-${this._instanceId}`;
    }

    get currencyDescriptionId() {
        return `currency-desc-${this._instanceId}`;
    }

    get customAmountDescribedBy() {
        return `${this.currencyDescriptionId} ${this.customAmountErrorId}`;
    }

    // Localized currency name for assistive text, e.g. "Euro" (en) / "euro" (fr).
    get _currencyName() {
        return localizedCurrencyName(this.currencyCode, this._locale);
    }

    // e.g. "Amount in Euro" — read out when the amount input gains focus, since the visual currency symbol is decorative
    get currencyAssistiveText() {
        const name = this._currencyName;
        return name ? this.labels.ec_label_amount_in_currency.replace('{0}', name) : '';
    }

    get isFreq1Selected() {
        return this._frequency === this.freq1Value;
    }

    get isFreq2Selected() {
        return this._frequency === this.freq2Value;
    }

    get showPresets() {
        const p = this._resolveActivePresets();
        return p !== null && p.length > 0;
    }

    get presetAmountOptions() {
        const presets = this._resolveActivePresets() || [];
        return presets.map(amount => ({
            value:      amount,
            label:      this._formatPresetAmount(amount, this.currencyCode, this._locale),
            inputId:    `${this._instanceId}-preset-${amount}`,
            isSelected: this._selectedPreset === amount && this._customAmount === ''
        }));
    }

    get currencySymbol() {
        return this._getCurrencySymbolInfo(this.currencyCode, this._locale).symbol;
    }

    get isCurrencyPrefix() {
        return this._getCurrencySymbolInfo(this.currencyCode, this._locale).position === 'prefix';
    }

    get isCurrencySuffix() {
        return this._getCurrencySymbolInfo(this.currencyCode, this._locale).position === 'suffix';
    }

    get customAmountMin() {
        return Number(this.minAmount) || 1;
    }

    get customAmountMax() {
        const n = Number(this.maxAmount);
        return n > 0 ? n : null;
    }

    get _currencyDecimals() {
        if (!this.currencyCode) return 2;
        try {
            return new Intl.NumberFormat(this._locale, {
                style: 'currency',
                currency: this.currencyCode
            }).resolvedOptions().maximumFractionDigits;
        } catch {
            return 2;
        }
    }

    get validationError() {
        return this._validationError;
    }

    get hasValidationError() {
        return !!this._validationError;
    }

    get customAmountRowClass() {
        return this._validationError
            ? 'custom-amount-row custom-amount-row--error'
            : 'custom-amount-row';
    }

    @api validate() {
        // If no cached error but a custom amount exists, re-compute — this handles the case
        // where the component re-mounted (clearing _validationError) while _customAmount was
        // restored from sessionStorage.
        if (!this._validationError && this._customAmount !== '') {
            this._validateAmount(Number(this._customAmount));
        }

        if (this._validationError) {
            return {
                isValid: false,
                /*
                 * Use a zero-width space (\u200B) to block Salesforce Flow navigation.
                 * Returning the actual error string causes the Flow runtime to render a static,
                 * duplicate error message outside our component that fails to clear when the
                 * user empties the input. The zero-width space satisfies the Flow engine's
                 * requirement for an errorMessage while letting our custom, reactive inline
                 * error handle the UI cleanly.
                 */
                errorMessage: '\u200B'
            };
        }

        return { isValid: true };
    }

    connectedCallback() {
        if (this.defaultFrequency) {
            this._frequency = this.defaultFrequency;
        }
        this._restoreState();
        this._applyQueryParams();

        // If a state was restored from sessionStorage, immediately evaluate
        // validation to prevent layout shifts or flashing of error styles.
        if (this._customAmount !== '') {
            this._validateAmount(Number(this._customAmount));
        }

        this._dispatchChange();
    }

    disconnectedCallback() {
        this._saveState();
    }

    handleFrequencyChange(event) {
        this._frequency = event.target.value;
        this._validationError = '';
        this._dispatchChange();
    }

    handlePresetAmountSelect(event) {
        this._selectedPreset = Number(event.target.value);
        this._customAmount    = '';
        this._validationError = '';
        this._dispatchChange();
    }

    handleCustomAmountInput(event) {
        // Accept locale-formatted input: strip the locale grouping separator and normalise the
        // decimal separator to "." (e.g. fr "25,50" and de "1.234,56" both → "1234.56"/"25.50").
        let val = toPlainNumberString(event.target.value, this._locale);
        const decimals = this._currencyDecimals;
        const dotIdx = val.indexOf('.');
        if (decimals === 0 && dotIdx !== -1) {
            val = val.substring(0, dotIdx);
        } else if (decimals > 0 && dotIdx !== -1 && val.length - dotIdx - 1 > decimals) {
            val = val.substring(0, dotIdx + decimals + 1);
        }
        event.target.value = val;
        this._customAmount   = val;
        this._selectedPreset = val !== '' ? null : this._selectedPreset;
        this._validateAmount(Number(val));
        this._dispatchChange();
    }

    handleCustomAmountFocus(event) {
        // Show the value in the locale format (decimal separator matching blur), never the raw
        // dot-decimal internal value. In comma-decimal locales "." is the grouping separator, so
        // writing back "25.5" would make the next keystroke reparse it as 255 (a payment-amount
        // corruption). Formatting keeps focus and blur symmetric.
        event.target.value = this._formatForEditing(this._customAmount);
    }

    handleCustomAmountBlur(event) {
        event.target.value = this._formatForEditing(this._customAmount);
    }

    // Render the dot-decimal internal amount in the active locale for display in the input, e.g.
    // "25.5" → en "25.5" / de "25,5". Returns '' for empty/non-numeric so the field can stay blank.
    _formatForEditing(plainAmount) {
        if (plainAmount === '') return '';
        const num = Number(plainAmount);
        if (isNaN(num)) return '';
        return new Intl.NumberFormat(this._locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: this._currencyDecimals
        }).format(num);
    }

    _parseAmounts(raw) {
        if (!raw || !String(raw).trim()) return null;
        const parsed = String(raw)
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n) && n > 0);
        return parsed.length > 0 ? parsed : null;
    }

    _getCurrencySymbolInfo(currencyCode, locale) {
        if (!currencyCode) {
            return { symbol: '', position: 'prefix' };
        }
        try {
            const parts = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                currencyDisplay: 'narrowSymbol',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).formatToParts(0);
            const currencyIdx = parts.findIndex(p => p.type === 'currency');
            const integerIdx  = parts.findIndex(p => p.type === 'integer');
            const symbol      = parts[currencyIdx] ? parts[currencyIdx].value : currencyCode;
            const position    = currencyIdx < integerIdx ? 'prefix' : 'suffix';
            return { symbol, position };
        } catch {
            return { symbol: currencyCode, position: 'prefix' };
        }
    }

    _formatPresetAmount(amount, currencyCode, locale) {
        try {
            // Without a currency, fall back to a plain localized number instead of a placeholder
            // currency so the form never shows amounts in a currency the payer didn't pick.
            const options = currencyCode
                ? { style: 'currency', currency: currencyCode, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0 }
                : { style: 'decimal', minimumFractionDigits: 0 };
            return new Intl.NumberFormat(locale, options).format(amount);
        } catch {
            return `${currencyCode} ${amount}`.trim();
        }
    }

    _resolveActivePresets() {
        const raw = this._frequency === this.freq2Value
            ? this.presetAmountsRecurring
            : this.presetAmountsOneTime;
        return this._parseAmounts(raw);
    }

    _validateAmount(num) {
        if (this._customAmount === '') {
            this._validationError = '';
            return;
        }
        const min = this.customAmountMin;
        const max = this.customAmountMax;
        if (isNaN(num) || num < min) {
            this._validationError = this.labels.ec_label_amount_min_error.replace(
                '{0}',
                this._formatPresetAmount(min, this.currencyCode, this._locale)
            );
        } else if (max !== null && num > max) {
            this._validationError = this.labels.ec_label_amount_max_error.replace(
                '{0}',
                this._formatPresetAmount(max, this.currencyCode, this._locale)
            );
        } else {
            this._validationError = '';
        }
    }

    _dispatchChange() {
        const detail = {
            frequency:        this._frequency,
            amountOneTime:    this.amountOneTime,
            amountRecurring:  this.amountRecurring,
            isAmountSelected: this.isAmountSelected,
            currency:         this.currencyCode
        };
        this.dispatchEvent(new CustomEvent('amountfrequencychange', { detail }));
        this.dispatchEvent(new FlowAttributeChangeEvent('frequency',        detail.frequency));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountOneTime',    detail.amountOneTime));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountRecurring',  detail.amountRecurring));
        this.dispatchEvent(new FlowAttributeChangeEvent('isAmountSelected', detail.isAmountSelected));
        // Echo the configured recurring frequency back so the Flow can reference it (e.g. in payButton's pixConfig).
        this.dispatchEvent(new FlowAttributeChangeEvent('recurringFrequency', this.recurringFrequency));
    }

    _storageKey() {
        try { return `af-state-${window.location.pathname}`; } catch { return 'af-state'; }
    }

    _saveState() {
        try {
            sessionStorage.setItem(this._storageKey(), JSON.stringify({
                frequency:      this._frequency,
                selectedPreset: this._selectedPreset,
                customAmount:   this._customAmount
            }));
        } catch { /* sessionStorage unavailable */ }
    }

    _restoreState() {
        try {
            const raw = sessionStorage.getItem(this._storageKey());
            if (!raw) return;
            const s = JSON.parse(raw);
            if (s.frequency)                    this._frequency      = s.frequency;
            if (s.selectedPreset !== undefined) this._selectedPreset = s.selectedPreset;
            if (s.customAmount   !== undefined) this._customAmount   = s.customAmount;
        } catch { /* ignore parse errors */ }
    }

    _applyQueryParams() {
        try {
            const params     = new URLSearchParams(window.location.search);
            const qAmount    = params.get('amount');
            const qFrequency = params.get('frequency');

            if (qFrequency) this._frequency = qFrequency;

            if (qAmount) {
                const num    = Number(qAmount);
                const presets = this._resolveActivePresets();
                if (!isNaN(num) && num > 0) {
                    if (presets && presets.includes(num)) {
                        this._selectedPreset = num;
                    } else {
                        this._customAmount = String(num);
                    }
                }
            }
        } catch {
            // window.location unavailable in SSR / test environments.
        }
    }
}

// Grouping/decimal separators for a locale, e.g. en-US → { group: ',', decimal: '.' },
// de-DE → { group: '.', decimal: ',' }, fr-FR → { group: ' ', decimal: ',' }.
function localeNumberSeparators(locale) {
    try {
        const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);
        return {
            group: parts.find((p) => p.type === 'group')?.value ?? '',
            decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.'
        };
    } catch {
        return { group: '', decimal: '.' };
    }
}

// Normalise a locale-formatted amount string to a plain "1234.56" string: drop the locale's
// grouping separator and convert its decimal separator to ".". Anything else non-numeric is
// stripped, and only the first decimal point is kept.
export function toPlainNumberString(raw, locale) {
    const { group, decimal } = localeNumberSeparators(locale);
    let s = String(raw ?? '');

    // In comma-decimal locales (de/nl) the group separator is "." and the decimal is ",". A user
    // typing "25.50" means twenty-five-fifty, not 2550 — but that "." only reads as grouping when it
    // precedes exactly 3 digits ("1.234"). The ambiguous case is real: handleCustomAmountFocus writes
    // back the dot-decimal internal value ("25.5"), so the field can carry a "." that is actually a
    // decimal point. Reclassify a lone "." with 1–2 trailing digits (and no locale decimal char
    // present) as the decimal separator instead of dropping it as grouping.
    if (group === '.' && decimal !== '.' && s.indexOf(decimal) === -1) {
        if (/^\d+\.\d{1,2}$/.test(s)) {
            s = s.split('.').join(decimal);
        }
    }

    if (group) s = s.split(group).join('');
    if (decimal && decimal !== '.') s = s.split(decimal).join('.');
    s = s.replace(/[^0-9.]/g, '');
    const dot = s.indexOf('.');
    if (dot !== -1) {
        s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
    }
    return s;
}