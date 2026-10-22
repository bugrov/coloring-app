// @ts-check
import { readdirSync } from 'node:fs'
import withNuxt from './.nuxt/eslint.config.mjs'

// Every directory in layers/ except core is a mini-game.
const gameLayers = readdirSync(new URL('./layers', import.meta.url), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== 'core')
  .map(entry => entry.name)

/**
 * @param {string[]} layers
 * @param {string} message
 * @returns {import('eslint').Linter.RulesRecord}
 */
const forbidLayers = (layers, message) => ({
  'no-restricted-imports': ['error', {
    patterns: [{ group: layers.map(layer => `**/layers/${layer}/**`), message }],
  }],
})

// Dependency direction: game -> core. Core never imports games, and games
// never import each other, so a game can be added or removed in isolation.
const layerBoundaries = [
  {
    files: ['layers/core/**'],
    rules: forbidLayers(gameLayers, 'Core must not depend on game layers.'),
  },
  ...gameLayers
    .map(game => ({ game, others: gameLayers.filter(other => other !== game) }))
    .filter(({ others }) => others.length > 0)
    .map(({ game, others }) => ({
      files: [`layers/${game}/**`],
      rules: forbidLayers(others, 'Games must not depend on each other; move shared code to core.'),
    })),
]

export default withNuxt(
  // No stray logging: nuxt-security's removeLoggers is off, so this rule keeps console calls out of the
  // build. The audit trail (layers/core/server/utils/audit.ts) is the one allowed exception.
  { rules: { 'no-console': 'error' } },
  {
    rules: {
      // `} catch {` and `} else {` on the line of the closing brace.
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      // A one-line `if (x) return` stays; a body that takes several lines gets braces.
      'curly': ['error', 'multi-line'],
      // Logical blocks are told apart by a blank line: around declarations, and before control flow and return.
      '@stylistic/padding-line-between-statements': ['error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: ['return', 'if', 'try', 'for', 'while', 'switch', 'throw'] },
        { blankLine: 'any', prev: ['if'], next: ['if'] },
      ],
    },
  },
  ...layerBoundaries,
)
