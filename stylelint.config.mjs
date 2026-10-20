/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-recommended-vue/scss'],
  ignoreFiles: ['.nuxt/**', '.output/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'],
  rules: {
    // Mobile-first: base styles target phones and grow with min-* queries only.
    'media-feature-range-notation': 'prefix',
    'media-feature-name-disallowed-list': ['max-width', 'max-height', 'max-device-width', 'max-device-height'],
    // Safari still needs these prefixes.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-user-select', '-webkit-text-size-adjust'] }],
    // BEM: block__element--modifier, kebab-case parts.
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Use BEM with kebab-case: block__element--modifier' },
    ],
  },
}
