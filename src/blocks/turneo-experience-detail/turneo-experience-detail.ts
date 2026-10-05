import { mountWidgetDetail } from '@/utils/turneo-widget-api';

/**
 * Renders the real turneo-widget's detail/booking view for the experience id
 * passed via `?turneoExperience=<id>_<slug>` (see turneo-proxy-test's
 * "View Detail (New Page)" CTA, which builds that link).
 */
export default async function decorate(block: HTMLElement): Promise<void> {
  const experienceParam = new URLSearchParams(window.location.search).get('turneoExperience');

  block.replaceChildren();

  if (!experienceParam) {
    const empty = document.createElement('p');
    empty.className = 'turneo-experience-detail-empty';
    empty.textContent = 'No experience selected — missing "turneoExperience" URL parameter.';
    block.append(empty);
    return;
  }

  mountWidgetDetail(block);
}
