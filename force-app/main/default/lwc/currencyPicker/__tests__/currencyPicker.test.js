import { createElement } from 'lwc';
import CurrencyPicker from 'c/currencyPicker';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';

// @salesforce/i18n/currency is mocked to 'USD' (jest-mocks/i18n/currency).
// getActiveCurrencies is mocked to a single-currency org (empty list) by default.
jest.mock(
    '@salesforce/apex/CurrencyPickerController.getActiveCurrencies',
    () => ({ default: jest.fn(() => Promise.resolve([])) }),
    { virtual: true }
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
    jest.clearAllMocks();
});

// Creates the element, wires a currencychange listener, then appends it so we can capture the
// event dispatched during connectedCallback.
function mount(props = {}) {
    const element = createElement('c-currency-picker', { is: CurrencyPicker });
    Object.assign(element, props);
    const changes = [];
    element.addEventListener('currencychange', (e) => changes.push(e.detail.currency));
    document.body.appendChild(element);
    return { element, changes };
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('c-currency-picker', () => {
    it('renders a combobox with one option per allowed currency', () => {
        const { element } = mount({ allowedCurrencies: 'EUR,USD,GBP', defaultCurrency: 'EUR' });
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox).not.toBeNull();
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
    });

    it('normalizes and de-duplicates the allow-list (case, spaces, repeats)', () => {
        const { element } = mount({ allowedCurrencies: ' eur , usd ,EUR', defaultCurrency: 'eur' });
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD']);
    });

    it('collapses (no combobox) and emits the value when only one currency is allowed', () => {
        const { element, changes } = mount({ allowedCurrencies: 'EUR' });
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('EUR');
        expect(changes).toEqual(['EUR']);
    });

    it('falls back to a single currency (default, else org/user) when no allow-list is set', () => {
        const { element } = mount({ defaultCurrency: 'GBP' });
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('GBP');
    });

    it('uses the org/user currency as the single fallback when nothing is configured', () => {
        const { element } = mount({});
        expect(element.value).toBe('USD'); // from the i18n/currency mock (before auto-detect resolves)
    });

    it('auto-detects the org currencies via Apex when no allow-list is set', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element } = mount({}); // no allow-list → triggers auto-detect
        await flush();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox).not.toBeNull();
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
        expect(element.value).toBe('EUR'); // first allowed (no fixed default given)
    });

    it('keeps the single fallback when Apex returns one/zero currencies', async () => {
        getActiveCurrencies.mockResolvedValueOnce([]);
        const { element } = mount({ defaultCurrency: 'GBP' });
        await flush();
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('GBP');
    });

    it('does not call Apex when an allow-list is provided', () => {
        mount({ allowedCurrencies: 'EUR,USD' });
        expect(getActiveCurrencies).not.toHaveBeenCalled();
    });

    describe('default currency', () => {
        it('uses the configured default when it is one of the allowed currencies', () => {
            const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'USD' });
            expect(element.value).toBe('USD');
        });

        it('falls back to the first allowed currency when the default is not allowed', () => {
            const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'JPY' });
            expect(element.value).toBe('EUR');
        });
    });

    it('emits currencychange exactly once during auto-detect (no intermediate fallback emit)', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element, changes } = mount({}); // no allow-list → triggers auto-detect
        expect(changes).toEqual([]); // fallback is applied silently, before Apex resolves
        await flush();
        expect(changes).toEqual(['EUR']); // single emit with the auto-detected value
        expect(element.value).toBe('EUR');
    });

    it('emits once even when Apex returns a single/zero-currency org', async () => {
        getActiveCurrencies.mockResolvedValueOnce([]);
        const { changes } = mount({ defaultCurrency: 'GBP' });
        expect(changes).toEqual([]);
        await flush();
        expect(changes).toEqual(['GBP']);
    });

    it('keeps an externally set value when a late auto-detect list still contains it', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element } = mount({ value: 'GBP' }); // parent/Flow sets value before Apex resolves
        await flush();
        expect(element.value).toBe('GBP'); // not overridden by codes[0]
    });

    it('emits currencychange when the payer switches currency', () => {
        const { element, changes } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        expect(changes).toEqual(['EUR']); // initial
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'USD' } }));
        expect(element.value).toBe('USD');
        expect(changes).toEqual(['EUR', 'USD']);
    });
});
