import type { SvgErrorCode, SvgWarningCode } from '../types'

/** User-facing explanations of import results. */
export const SVG_ERROR_MESSAGES: Record<SvgErrorCode, string> = {
  'too-large': 'Файл слишком большой. Максимальный размер 1 МБ.',
  'doctype-not-allowed': 'Файл содержит DOCTYPE или объявления сущностей. Такие SVG не поддерживаются.',
  'malformed': 'Файл повреждён или это не SVG.',
  'not-svg': 'Это не SVG-изображение.',
  'too-many-elements': 'В рисунке слишком много элементов. Упростите его и попробуйте снова.',
  'no-dimensions': 'У рисунка не указаны размеры (viewBox или width/height).',
  'no-regions': 'В рисунке не нашлось областей для раскрашивания. Нужны замкнутые фигуры.',
  'too-many-regions': 'В рисунке слишком много областей. Максимум 500.',
  'timeout': 'Рисунок слишком сложный для обработки.',
  'invalid-svg': 'Не удалось обработать файл.',
}

export const SVG_WARNING_MESSAGES: Record<SvgWarningCode, string> = {
  'unsupported-element': 'Текст, растровые картинки и встроенные объекты пропущены.',
  'unsupported-paint': 'Градиенты и узоры заменены сплошной заливкой.',
  'ignored-effect': 'Маски и фильтры не применяются.',
  'ignored-dash': 'Пунктирные линии нарисованы сплошными.',
  'external-reference': 'Ссылки на внешние ресурсы удалены.',
  'invalid-path': 'Часть фигур с некорректными данными пропущена.',
  'path-too-long': 'Слишком сложные фигуры пропущены.',
}
