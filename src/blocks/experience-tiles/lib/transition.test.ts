import { waitForTransforms } from './transition';

describe('waitForTransforms', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.body.replaceChildren();
  });

  function element(properties: string, durations: string, delays: string): HTMLElement {
    const node = document.createElement('div');
    node.style.transitionProperty = properties;
    node.style.transitionDuration = durations;
    node.style.transitionDelay = delays;
    document.body.append(node);
    return node;
  }

  it('uses the transform entry and repeats shorter timing lists, including negative delays', () => {
    const node = element('opacity, transform', '2s, 1200ms', '-200ms');
    const complete = jest.fn();
    waitForTransforms([node], complete);
    jest.advanceTimersByTime(1049);
    expect(complete).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(complete).toHaveBeenCalledWith(false);
  });

  it('does not wait for transition:none or zero-duration transforms, even with a delay', () => {
    const complete = jest.fn();
    waitForTransforms([element('none', '1.2s', '100ms'), element('transform', '0s', '1s')], complete);
    expect(complete).toHaveBeenCalledWith(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels all listeners and the fallback without calling completion', () => {
    const node = element('all', '1.2s', '100ms');
    const complete = jest.fn();
    const cleanup = waitForTransforms([node], complete);
    cleanup();
    const event = new Event('transitioncancel');
    Object.defineProperty(event, 'propertyName', { value: 'transform' });
    node.dispatchEvent(event);
    jest.advanceTimersByTime(2000);
    expect(complete).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
