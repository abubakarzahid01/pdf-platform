// Central product settings.

export const site = {
  name: "EditBee",
  url: "https://editbee.online",
  tagline: "Every PDF task, done right in your browser",
  description:
    "Edit, convert, organise and extract data from PDF, Word, Excel and PowerPoint files online.",
  contactEmail: "contact@editbee.online",
  hostingProvider: "Hostinger",
} as const;

// Upload and processing limits. Enforced in code from Phase 3 onwards.
export const limits = {
  free: {
    maxFileSizeMb: 50, // [SIZE LIMIT] keeps processing in the browser responsive
    maxPages: 200,
    maxFilesPerTask: 10,
  },
} as const;
