/**
 * Small citation helpers shared by server pages, client components, the
 * sitemap and llms.txt. No imports: safe in any bundle.
 */

/** "ج1 ص424" — al-Samarrai edition references are stored in Arabic notation. */
const SAMARRAI_VOL_PAGE = /^ج\s*(\d+)\s*ص\s*(\d+(?:\s*[-–]\s*\d+)?)$/;

/** Volume and page of an al-Samarrai reference, or null when it is not in "جX صY" form. */
export function parseSamarrai(ref: string | null | undefined): { vol: string; page: string } | null {
  const m = ref?.trim().match(SAMARRAI_VOL_PAGE);
  return m ? { vol: m[1], page: m[2].replace(/\s+/g, "") } : null;
}

/** The fragment id of one story on /stories (StoryCard), so a single story can be linked. */
export const storyAnchor = (claimId: number) => `story-${claimId}`;
