import catSvg from '../../server/assets/arts/cat.svg?raw'
import houseSvg from '../../server/assets/arts/house.svg?raw'
import octopusSvg from '../../server/assets/arts/octopus.svg?raw'

/** Source SVGs of the built-in arts, for developer pages. The gallery loads arts from the server. */
export const BASE_ART_SAMPLES: Readonly<Record<string, string>> = {
  Осьминог: octopusSvg,
  Кошка: catSvg,
  Дом: houseSvg,
}
