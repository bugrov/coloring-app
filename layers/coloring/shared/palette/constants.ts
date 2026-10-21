import type { PaletteColor } from '../types'

/** Red: the first colour selected, clearly visible on any art. */
export const DEFAULT_COLOR = '#e53935'

/**
 * The 32 basic colours. Provisional crayon-box set (the design has no exact
 * palette): rainbow hues in light/base/dark, skin tones, browns, greys,
 * black and white. Ordered as they appear in the colour panel.
 */
export const PALETTE: readonly PaletteColor[] = [
  { hex: '#ff8a80', name: 'Светло-красный' },
  { hex: DEFAULT_COLOR, name: 'Красный' },
  { hex: '#b71c1c', name: 'Тёмно-красный' },
  { hex: '#ffb74d', name: 'Светло-оранжевый' },
  { hex: '#fb8c00', name: 'Оранжевый' },
  { hex: '#fff176', name: 'Светло-жёлтый' },
  { hex: '#fdd835', name: 'Жёлтый' },
  { hex: '#f9a825', name: 'Золотой' },
  { hex: '#aed581', name: 'Салатовый' },
  { hex: '#43a047', name: 'Зелёный' },
  { hex: '#1b5e20', name: 'Тёмно-зелёный' },
  { hex: '#4dd0e1', name: 'Бирюзовый' },
  { hex: '#81d4fa', name: 'Голубой' },
  { hex: '#1e88e5', name: 'Синий' },
  { hex: '#283593', name: 'Тёмно-синий' },
  { hex: '#ce93d8', name: 'Сиреневый' },
  { hex: '#8e24aa', name: 'Фиолетовый' },
  { hex: '#4a148c', name: 'Тёмно-фиолетовый' },
  { hex: '#f8bbd0', name: 'Светло-розовый' },
  { hex: '#ec407a', name: 'Розовый' },
  { hex: '#ad1457', name: 'Малиновый' },
  { hex: '#ffe0bd', name: 'Светлый телесный' },
  { hex: '#e0ac69', name: 'Телесный' },
  { hex: '#8d5524', name: 'Тёмный телесный' },
  { hex: '#d7b899', name: 'Бежевый' },
  { hex: '#a1887f', name: 'Светло-коричневый' },
  { hex: '#6d4c41', name: 'Коричневый' },
  { hex: '#3e2723', name: 'Тёмно-коричневый' },
  { hex: '#ffffff', name: 'Белый' },
  { hex: '#bdbdbd', name: 'Светло-серый' },
  { hex: '#616161', name: 'Серый' },
  { hex: '#000000', name: 'Чёрный' },
]
