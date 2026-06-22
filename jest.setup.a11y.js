import { setup } from '@sa11y/jest';

// Registers toBeAccessible() globally and configures axe with Salesforce preset rules.
// This covers WCAG 2.1 AA + WCAG 2.2 AA rules that axe-core can test automatically.
setup();
