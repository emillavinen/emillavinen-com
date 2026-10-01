/**
 * Everything the backlog downloader assumes about Pinterest's pages, in one
 * place. Pinterest changes its markup without notice: when the downloader
 * stops finding pins, run it with --debug, open the saved HTML, and update
 * the lists below (first match wins). See SETUP.md, step 5.
 *
 * Last checked by hand: never against a logged-in session from the build
 * environment — these are written defensively from Pinterest's public
 * markup as of 2026-09.
 */

export const PINTEREST = "https://www.pinterest.com";
export const LOGIN_URL = `${PINTEREST}/login/`;

/** Present only when signed in (avatar / profile menu). */
export const SIGNED_IN = ['[data-test-id="header-profile"]', '[data-test-id="header-avatar"]', 'div[aria-label="Accounts and more options"]', '[data-test-id="button-container"] img[alt]'];

/** The container that holds the board's own pins (not recommendations). */
export const BOARD_GRID = ['[data-test-id="board-feed"]', '[data-test-id="boardFeed"]', '[data-test-id="board-section-pins"]', 'div[role="list"]', "main"];

/** A link to a pin inside the grid. The pin id is read from its href. */
export const PIN_LINK = 'a[href*="/pin/"]';
export const PIN_ID_FROM_HREF = /\/pin\/(\d+)/;

/**
 * Headings that start the "More ideas" / "More like this" recommendations
 * under a board. Pins below them are not Emil's and are never collected.
 */
export const RECOMMENDATIONS_HEADING = ['[data-test-id="moreIdeasTitle"]', '[data-test-id="more-ideas-header"]', "h2", "h3"];
export const RECOMMENDATIONS_TEXT = /more ideas|more like this|find some ideas|lisää ideoita|samankaltaisia/i;

/** Board header pin count, e.g. "126 Pins". Used to know when scrolling is done. */
export const PIN_COUNT_TEXT = /([\d,. ]+)\s*(pins?|nastaa?)/i;

/** Pinterest embeds page data as JSON in these scripts. */
export const EMBEDDED_JSON = ['script#__PWS_INITIAL_PROPS__', "script#__PWS_DATA__", 'script[data-relay-response="true"]', 'script[type="application/json"]'];

/** XHR responses that carry pin objects while the board scrolls. */
export const FEED_RESPONSE = /\/resource\/(BoardFeedResource|BoardSectionPinsResource)\/get|\/_graphql\//;

/** Pin-page fallbacks when no JSON is found. */
export const PIN_PAGE = {
  image: ['meta[property="og:image"]', 'img[src*="i.pinimg.com/originals"]', 'img[src*="i.pinimg.com"]'],
  title: ['h1', 'meta[property="og:title"]'],
  description: ['meta[property="og:description"]', 'meta[name="description"]'],
  video: ["video", '[data-test-id="pinrep-video"]'],
};

/** Field names Pinterest has used for the same things over the years. */
export const FIELDS = {
  id: ["id", "entityId", "pinId"],
  image: [
    ["images", "orig", "url"],
    ["imageSpec_orig", "url"],
    ["imageSpec_originals", "url"],
    ["images", "originals", "url"],
    ["imageLargeUrl"],
  ],
  title: ["title", "gridTitle", "grid_title", "seoTitle"],
  description: ["description", "closeupUnifiedDescription", "closeup_unified_description", "closeupDescription"],
  date: ["created_at", "createdAt"],
  video: ["videos", "videoList", "video_list", "storyPinData", "story_pin_data"],
};
