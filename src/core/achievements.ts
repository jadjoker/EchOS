/**
 * Steam achievements, and the single place they are awarded from.
 *
 * Nothing is wired yet: EchOS has no Steam app ID, so there is no Steamworks
 * call to make. This exists anyway so that the game code can already say the
 * true thing at the moment it happens, and turning it on later is one file
 * rather than a hunt through the machine for the right moments.
 *
 * Awarding is deliberately fire-and-forget. An achievement is a side effect of
 * play, and no gameplay decision may ever depend on whether one fired.
 */

/** Ids are the strings that will be registered on Steam. Do not rename them. */
export type AchievementId = "all_my_fish_are_dead";

const NAMES: Record<AchievementId, string> = {
  all_my_fish_are_dead: "All my fish are dead, push me to the edge",
};

/**
 * Only once per session per achievement. Steam de-duplicates anyway, but the
 * dev log should not repeat and a future implementation should not spam the
 * API from inside an animation loop.
 */
const awarded = new Set<AchievementId>();

export function award(id: AchievementId): void {
  if (awarded.has(id)) return;
  awarded.add(id);

  // The Steamworks call goes here. Until then, saying so out loud in dev is
  // more useful than a silent no-op, because it is the only way to check the
  // trigger fires at the right moment.
  if (import.meta.env.DEV) {
    console.info(`[achievement] ${NAMES[id]} (${id})`);
  }
}
