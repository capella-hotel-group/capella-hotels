import { bindGestures } from './gesture';

function pointer(target: EventTarget, type: string, x: number, y = 0, id = 1): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0 });
  target.dispatchEvent(event);
}

describe('split-media gestures', () => {
  let surface: HTMLElement;
  let cleanup: () => void;
  let cancel: () => void;
  const next = jest.fn();
  const previous = jest.fn();
  const begin = jest.fn();
  const end = jest.fn();
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    surface = document.createElement('div');
    document.body.append(surface);
    ({ cleanup, cancel } = bindGestures(surface, { next, previous, begin, end }));
  });
  afterEach(() => {
    cleanup();
    surface.remove();
    jest.useRealTimers();
  });

  it('advances on left drag and reverses on right drag only after release', () => {
    pointer(surface, 'pointerdown', 100);
    pointer(window, 'pointermove', 40);
    expect(next).not.toHaveBeenCalled();
    pointer(window, 'pointerup', 40);
    expect(next).toHaveBeenCalledTimes(1);
    pointer(surface, 'pointerdown', 40);
    pointer(window, 'pointerup', 100);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(begin).toHaveBeenCalledTimes(2);
    expect(end).toHaveBeenCalledTimes(2);
  });

  it('preserves taps, short drags and vertical scroll', () => {
    for (const [x, y] of [
      [100, 0],
      [70, 0],
      [40, 100],
    ]) {
      pointer(surface, 'pointerdown', 100);
      pointer(window, 'pointerup', x, y);
    }
    expect(next).not.toHaveBeenCalled();
    expect(previous).not.toHaveBeenCalled();
  });

  it('ignores interactive and editable targets', () => {
    surface.innerHTML = '<a href="#">CTA</a><button>Button</button><input><div contenteditable="true">Edit</div>';
    [...surface.children].forEach((child) => {
      pointer(child, 'pointerdown', 100);
      pointer(window, 'pointerup', 0);
    });
    expect(begin).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('cancels on pointercancel, multitouch and resize cancellation', () => {
    pointer(surface, 'pointerdown', 100);
    pointer(window, 'pointercancel', 0);
    pointer(surface, 'pointerdown', 100);
    pointer(surface, 'pointerdown', 100, 0, 2);
    pointer(window, 'pointerup', 0);
    pointer(surface, 'pointerdown', 100);
    cancel();
    pointer(window, 'pointerup', 0);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps autoplay suspended until every contact of a pinch is released', () => {
    pointer(surface, 'pointerdown', 100);
    pointer(surface, 'pointerdown', 50, 0, 2);
    pointer(window, 'pointerup', 0);
    expect(end).not.toHaveBeenCalled();
    pointer(window, 'pointerup', 0, 0, 2);
    expect(end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('suppresses the generated click after dragging and removes listeners on cleanup', () => {
    pointer(surface, 'pointerdown', 100);
    pointer(window, 'pointerup', 0);
    expect(surface.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
    jest.advanceTimersByTime(500);
    expect(surface.dispatchEvent(new MouseEvent('click', { cancelable: true }))).toBe(true);
    cleanup();
    pointer(surface, 'pointerdown', 100);
    pointer(window, 'pointerup', 0);
    expect(next).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
