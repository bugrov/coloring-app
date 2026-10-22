import { ColoringRoutes } from '../shared/routes'

export default defineAppConfig({
  games: {
    coloring: {
      id: 'coloring',
      title: 'Раскраска',
      description: 'Раскрашивайте готовые рисунки или загрузите свой SVG. Прогресс сохраняется.',
      cover: '/games/coloring.svg',
      entry: ColoringRoutes.GALLERY,
      order: 0,
      adminEntry: ColoringRoutes.ADMIN_ARTS,
    },
  },
})
