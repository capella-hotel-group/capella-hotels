/**
 * Turneo Widget embed helpers.
 *
 * Mounts the real `<turneo-widget>` custom element (used by the `capella-poc`
 * store site) so it can render an experience's detail/booking view in place,
 * given the same experience id an App Builder/Turneo list already returns.
 */

/** Site slug the `<turneo-widget store="...">` embed is configured with. */
export const WIDGET_STORE_SITE = 'capella-poc';
export const WIDGET_SCRIPT_URL = 'https://widget-turneo.vercel.app/turneo-widget.iife.js';

/** Builds the `turneoExperience` URL param value the widget reads to deep-link into a detail view. */
export function buildWidgetExperienceParam(id: string, name: string): string {
  return `${id}_${name.replace(/ /g, '-')}`;
}

/** Mounts the `<turneo-widget>` custom element (and its script, once) inside `container`. */
export function mountWidgetDetail(container: HTMLElement): void {
  if (!document.querySelector(`script[src="${WIDGET_SCRIPT_URL}"]`)) {
    const script = document.createElement('script');
    script.src = WIDGET_SCRIPT_URL;
    document.body.append(script);
  }

  const widget = document.createElement('turneo-widget');
  widget.setAttribute('store', WIDGET_STORE_SITE);
  container.append(widget);
}
