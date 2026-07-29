import { createElement } from 'lwc';
import CurrencyPicker from 'c/currencyPicker';

// toBeAccessible() runs axe-core (WCAG 2.1 AA + WCAG 2.2 AA) via jest.setup.a11y.js.

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('c-currency-picker WCAG 2.2 AA accessibility', () => {
    it('passes axe scan with a multi-currency picker', async () => {
        const element = createElement('c-currency-picker', { is: CurrencyPicker });
        element.allowedCurrencies = 'EUR,USD,GBP';
        element.defaultCurrency = 'EUR';
        document.body.appendChild(element);
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });
});
