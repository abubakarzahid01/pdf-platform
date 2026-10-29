// Central product settings. Placeholders in [brackets] are decisions still to be made.

export const site = {
  name: "[Brand]",
  tagline: "Every PDF task, done right in your browser",
  description:
    "Edit, convert, organise and extract data from PDF, Word, Excel and PowerPoint files online.",
} as const;

// Upload and processing limits. Enforced in code from Phase 3 onwards.
export const limits = {
  free: {
    maxFileSizeMb: 50, // [SIZE LIMIT] keeps processing in the browser responsive
    maxPages: 200,
    maxFilesPerTask: 10,
  },
} as const;
