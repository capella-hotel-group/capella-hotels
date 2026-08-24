declare module '*dompurify.min.js';

interface DOMPurifyApi {
  sanitize: (html: string, options?: Record<string, unknown>) => string;
}

interface Window {
  DOMPurify?: DOMPurifyApi;
}
