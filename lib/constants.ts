export const SITE_NAME = "Emil Lavinen";
export const SITE_URL = "https://emillavinen.com";
export const SITE_DESCRIPTION =
  "Emil Lavinen is a Helsinki-based Creative Director and Brand Strategist working at the intersection of visual identity, brand strategy, and music culture.";
export const AUTHOR_NAME = "Emil Lavinen";
export const AUTHOR_EMAIL = "emil.lavinen@gmail.com";

export const SOCIAL_LINKS = {
  email:     "mailto:emil.lavinen@gmail.com",
  instagram: "https://www.instagram.com/emillavinen/",
  pinterest: "https://pinterest.com/emillavinen/",
  spotify:   "https://open.spotify.com/artist/0O5wpsxmlBm0vNnCcDX4PT",
  behance:   "https://www.behance.net/emillavinen",
  linkedin:  "https://www.linkedin.com/in/emillavinen/",
} as const;

export const SOCIAL_LABELS = {
  email:     "emil.lavinen@gmail.com",
  instagram: "instagram.com/emillavinen",
  pinterest: "pinterest.com/emillavinen",
  spotify:   "spotify (artist page)",
  behance:   "behance.net/emillavinen",
  linkedin:  "linkedin.com/in/emillavinen",
} as const;

export const SOCIAL_ALL_URLS = Object.values(SOCIAL_LINKS).filter(
  (u) => !u.startsWith("mailto:")
);
