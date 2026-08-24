declare module '*dompurify.min.js';

interface DOMPurifyApi {
  sanitize: (html: string) => string;
}

interface Window {
  DOMPurify?: DOMPurifyApi;
}
