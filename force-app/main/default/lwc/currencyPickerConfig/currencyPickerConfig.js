import { api, track, LightningElement } from 'lwc';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';

const ISO_CODE = /^[A-Z]{3}$/;
const FLOW_VAR_OPTION = 'USE_FLOW_VARIABLE';

export default class currencyPickerConfig extends LightningElement {
    @api builderContext;
    @api genericTypeMappings;
    @api automaticOutputVariables;

    @api
    get inputVariables() {
        return this._inputVariables;
    }
    set inputVariables(value) {
        this._inputVariables = value || [];
        if (!this._hydrated && this._inputVariables.length > 0) {
            this._hydrated = true;
            this._hydrate();
        }
    }

    @track _orgCurrencies = [];
    @track _currenciesLoaded = false;
    @track showVariableInput = false;
    @track comboboxValue = '';
    @track _defaultCurrencyValue = '';
    @track _defaultCurrencyValueType = 'String';
    @track _defaultCurrencyError = '';

    _inputVariables = [];
    _hydrated = false;

    // ISO code only across the editor: long localized names (e.g. "USD - Amerikaanse dollar") get
    // truncated in the narrow Flow Builder panel. Codes are compact and unambiguous for admins; the
    // full localized name is shown to payers by the runtime currencyPicker.
    get currencyOptions() {
        return dedupe([...this._orgCurrencies, ...this.allowedValue]).map((code) => ({
            label: code,
            value: code
        }));
    }

    get allowedValue() {
        return (this._get('allowedCurrencies') || '')
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);
    }

    // When no allow-list is configured, the payer picks from all currencies active in the org, so
    // the default must be selectable from that same set.
    get defaultCandidates() {
        return this.allowedValue.length ? this.allowedValue : this._orgCurrencies;
    }

    get defaultOptions() {
        const options = this.defaultCandidates.map((code) => ({
            label: code,
            value: code
        }));

        options.unshift({
            label: 'Use Flow Variable...',
            value: FLOW_VAR_OPTION
        });

        return options;
    }

    get defaultCurrencyValue() {
        return this._defaultCurrencyValue;
    }

    get defaultCurrencyValueType() {
        return this._defaultCurrencyValueType;
    }

    // Only worth choosing an allow-list when the org has more than one currency to choose from.
    // A pre-existing allow-list also implies a multi-currency org, so keep the control visible even
    // before the org currencies load (or if the Apex call fails).
    get showAllowed() {
        return this._orgCurrencies.length > 1 || this.allowedValue.length > 0;
    }

    // The single-currency notice is only trustworthy once the org currencies have loaded — until
    // then we can't tell a single-currency org from a not-yet-loaded multi-currency one.
    get showSingleCurrencyNotice() {
        return this._currenciesLoaded && !this.showAllowed;
    }

    get showDefaultSelector() {
        return !this.showSingleCurrencyNotice;
    }

    get defaultCurrencyError() {
        return this._defaultCurrencyError;
    }

    // Called by the Flow Builder when the admin tries to save/activate the screen. Returning a
    // non-empty array blocks activation; the builder then shows a generic "You have N errors" banner
    // without the message text, so we also mirror each error inline next to its field. The allow-list
    // is optional (blank = all active currencies), but the default currency is mandatory: either a
    // fixed ISO code or a Flow variable that supplies it.
    @api
    validate() {
        this._defaultCurrencyError = '';
        if (this.showSingleCurrencyNotice) {
            return [];
        }
        if (!this.comboboxValue) {
            this._defaultCurrencyError = 'Select a default currency source.';
        } else if (this.comboboxValue === FLOW_VAR_OPTION && !this._defaultCurrencyValue) {
            this._defaultCurrencyError = 'Select the Flow variable that provides the default currency.';
        }

        return this._defaultCurrencyError
            ? [{ key: 'defaultCurrency', errorString: this._defaultCurrencyError }]
            : [];
    }

    connectedCallback() {
        getActiveCurrencies()
            .then((currencies) => {
                this._orgCurrencies = (currencies || []).map(normalize).filter(Boolean);
                this._prefillSingleCurrency();
            })
            .catch(() => {
                /* On failure, leave options as currently selected values */
            })
            .finally(() => {
                this._currenciesLoaded = true;
            });
    }

    // Single-currency org: pre-select its one currency as the default so the admin doesn't have to
    // pick from a list of one. They can still switch to a Flow variable if they need to.
    _prefillSingleCurrency() {
        if (this._orgCurrencies.length === 1 && !this.comboboxValue) {
            const singleCurrency = this._orgCurrencies[0];
            this.comboboxValue = singleCurrency;
            this._defaultCurrencyValue = singleCurrency;
            this._defaultCurrencyValueType = 'String';
            this._dispatch('defaultCurrency', singleCurrency, 'String');
        }
    }

    _hydrate() {
        const currentVar = this._getVariable('defaultCurrency');
        this._defaultCurrencyValue = currentVar?.value ?? '';
        this._defaultCurrencyValueType = currentVar?.valueDataType ?? 'String';

        const val = this._defaultCurrencyValue;
        const type = this._defaultCurrencyValueType;

        const isFlowVariable =
            type === 'Reference' ||
            type === 'Formula' ||
            val.startsWith('{!') ||
            (val && !ISO_CODE.test(val));

        if (isFlowVariable && val) {
            this.comboboxValue = FLOW_VAR_OPTION;
            this.showVariableInput = true;
        } else if (val) {
            this.comboboxValue = val;
            this.showVariableInput = false;
        } else {
            this.comboboxValue = '';
            this.showVariableInput = false;
        }
    }

    _get(name) {
        return this._inputVariables.find((v) => v.name === name)?.value;
    }

    _getVariable(name) {
        return this._inputVariables.find((v) => v.name === name);
    }

    _dispatch(name, value, newValueDataType = 'String') {
        this.dispatchEvent(
            new CustomEvent('configuration_editor_input_value_changed', {
                bubbles: true,
                cancelable: false,
                composed: true,
                detail: { name, newValue: value, newValueDataType }
            })
        );
    }

    handleAllowedChange(event) {
        const selected = event.detail.value; // Array of ISO codes
        this._dispatch('allowedCurrencies', selected.join(','));

        // A fixed default must stay within the picker's choices. When the allow-list is cleared the
        // choices fall back to all org currencies, so the default only needs resetting when a
        // non-empty allow-list no longer contains it. A Flow-variable default is never affected.
        if (
            selected.length &&
            this.comboboxValue !== FLOW_VAR_OPTION &&
            this.comboboxValue &&
            !selected.includes(this.comboboxValue)
        ) {
            this.comboboxValue = '';
            this._defaultCurrencyValue = '';
            this.showVariableInput = false;
            this._dispatch('defaultCurrency', '');
        }
    }

    handleComboboxChange(event) {
        const selectedVal = event.detail.value;
        this.comboboxValue = selectedVal;
        this._defaultCurrencyError = '';

        if (selectedVal === FLOW_VAR_OPTION) {
            this.showVariableInput = true;
            this._dispatch('defaultCurrency', this._defaultCurrencyValue, this._defaultCurrencyValueType);
        } else {
            this.showVariableInput = false;
            this._defaultCurrencyValue = selectedVal;
            this._defaultCurrencyValueType = 'String';
            this._dispatch('defaultCurrency', selectedVal, 'String');
        }
    }

    handleVariableChange(event) {
        const type = event.detail.newValueDataType ?? 'String';
        const raw = event.detail.newValue ?? '';
        const val = type === 'String' ? raw.toUpperCase() : raw;

        this._defaultCurrencyValue = val;
        this._defaultCurrencyValueType = type;
        this._defaultCurrencyError = '';
        this._dispatch('defaultCurrency', val, type);
    }
}

function normalize(code) {
    const upper = (code || '').toString().trim().toUpperCase();
    return ISO_CODE.test(upper) ? upper : '';
}

function dedupe(list) {
    return [...new Set(list)];
}