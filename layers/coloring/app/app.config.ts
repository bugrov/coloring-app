import { ColoringRoutes } from '../shared/routes'

export default defineAppConfig({
  games: {
    coloring: {
      id: 'coloring',
      title: 'Раскраска',
      entry: ColoringRoutes.GALLERY,
      order: 0,
      adminEntry: ColoringRoutes.ADMIN_ARTS,
    },
  },
})
