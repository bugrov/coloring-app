import { listGames } from '#shared/utils/games'

/** Games registered by the installed game layers, in display order. */
export function useGames() {
  const appConfig = useAppConfig()

  return computed(() => listGames(appConfig.games))
}
