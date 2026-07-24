export const SITE_NAME = "دليل المدينة الخفية";
export const SITE_DESCRIPTION =
  "دليل عملي للأماكن الأقل شهرة في المدينة المنورة: مساجد أثرية وآبار وبساتين ومواقع تاريخية، مع المسافة من المسجد النبوي وكيفية الوصول وتكلفة المواصلات.";

/** Font size steps (px) applied on <html> via data-font-step. */
export const FONT_STEPS = [18, 20, 23] as const;
export const FONT_STEP_STORAGE_KEY = "hm-font-step";

/** Time-based ISR safety net; admin edits revalidate on demand. */
export const REVALIDATE_SECONDS = 86400;
