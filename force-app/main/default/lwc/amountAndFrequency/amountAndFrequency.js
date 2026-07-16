import { LightningElement, api } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import { labels } from './amountAndFrequencyLabels';
import LOCALE from '@salesforce/i18n/locale';

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
    _defaultCurrency         = '';

    labels = labels;

    @api freq1Value = DEFAULT_FREQ_1_VALUE;
    @api freq2Value = DEFAULT_FREQ_2_VALUE;
    @api showFrequencyToggle   = false;

    @api presetAmountsOneTime   = DEFAULT_AMOUNTS_ONE_TIME;
    @api presetAmountsRecurring = DEFAULT_AMOUNTS_RECURRING;

    @api minAmount       = 1;
    @api maxAmount       = 0;
    @api defaultFrequency = '';

    @api
    get defaultCurrency() {
        return this._defaultCurrency;
    }
    set defaultCurrency(value) {
        const next = (value || '').toUpperCase();
        if (this._defaultCurrency === next) return;
        this._defaultCurrency = next;
        // Clear custom amount if it has more decimal places than the new currency allows.
        // Rounding or truncating silently would change the payment amount without user awareness,
        // which is unacceptable for a payment form — the user must re-enter the amount explicitly.
        if (this._customAmount !== '') {
            const dotIdx = this._customAmount.indexOf('.');
            const decimals = this._currencyDecimals;
            if (dotIdx !== -1 && this._customAmount.length - dotIdx - 1 > decimals) {
                this._customAmount = '';
                this._dispatchChange();
            }
        }
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedCurrency', next));
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
    get selectedCurrency() {
        return this.defaultCurrency;
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
        return LOCALE ? LOCALE.replace('_', '-') : 'en-US';
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
            label:      this._formatPresetAmount(amount, this.defaultCurrency, this._locale),
            inputId:    `${this._instanceId}-preset-${amount}`,
            isSelected: this._selectedPreset === amount && this._customAmount === ''
        }));
    }

    get currencySymbol() {
        return this._getCurrencySymbolInfo(this.defaultCurrency, this._locale).symbol;
    }

    get isCurrencyPrefix() {
        return this._getCurrencySymbolInfo(this.defaultCurrency, this._locale).position === 'prefix';
    }

    get isCurrencySuffix() {
        return this._getCurrencySymbolInfo(this.defaultCurrency, this._locale).position === 'suffix';
    }

    get customAmountMin() {
        return Number(this.minAmount) || 1;
    }

    get customAmountMax() {
        const n = Number(this.maxAmount);
        return n > 0 ? n : null;
    }

    get _currencyDecimals() {
        try {
            return new Intl.NumberFormat(this._locale, {
                style: 'currency',
                currency: this.defaultCurrency
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
        let val = event.target.value;
        val = val.replace(',', '.');
        val = val.replace(/[^0-9.]/g, '');
        const firstDot = val.indexOf('.');
        if (firstDot !== -1) {
            val = val.substring(0, firstDot + 1) + val.substring(firstDot + 1).replace(/\./g, '');
        }
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
        event.target.value = this._customAmount;
    }

    handleCustomAmountBlur(event) {
        if (this._customAmount === '') return;
        const num = Number(this._customAmount);
        if (isNaN(num)) return;
        event.target.value = new Intl.NumberFormat(this._locale, {
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
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                currencyDisplay: 'narrowSymbol',
                minimumFractionDigits: 0
            }).format(amount);
        } catch {
            return `${currencyCode} ${amount}`;
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
                this._formatPresetAmount(min, this.defaultCurrency, this._locale)
            );
        } else if (max !== null && num > max) {
            this._validationError = this.labels.ec_label_amount_max_error.replace(
                '{0}',
                this._formatPresetAmount(max, this.defaultCurrency, this._locale)
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
            selectedCurrency: this.defaultCurrency
        };
        this.dispatchEvent(new CustomEvent('amountfrequencychange', { detail }));
        this.dispatchEvent(new FlowAttributeChangeEvent('frequency',        detail.frequency));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountOneTime',    detail.amountOneTime));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountRecurring',  detail.amountRecurring));
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedCurrency', detail.selectedCurrency));
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
