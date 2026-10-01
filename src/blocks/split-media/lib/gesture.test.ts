import { bindGestures } from './gesture';

function pointer(target: EventTarget, type: string, x: number, y: number, extra = {}) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])),
  });
  target.dispatchEvent(event);
  return event;
}
function touch(target: EventTarget, type: string, y: number, count = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: {
      value:
        type === 'touchend'
          ? []
          : Array.from({ length: count }, (_, id) => ({ identifier: id, clientX: 100, clientY: y })),
    },
    changedTouches: { value: [{ identifier: 0, clientX: 100, clientY: y }] },
  });
  target.dispatchEvent(event);
  return event;
}
it('steps vertically only on release and suppresses the drag click', () => {
  const surface = document.createElement('div');
  document.body.append(surface);
  const actions = { begin: jest.fn(() => true), move: jest.fn(), end: jest.fn(() => true), cancel: jest.fn() };
  const binding = bindGestures(surface, actions);
  pointer(surface, 'pointerdown', 100, 200);
  pointer(window, 'pointermove', 100, 100);
  expect(actions.end).not.toHaveBeenCalled();
  pointer(window, 'pointerup', 100, 100);
  expect(actions.end).toHaveBeenCalledWith(1);
  const click = new MouseEvent('click', { cancelable: true, bubbles: true });
  surface.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  binding.cleanup();
  surface.remove();
});
it('leaves taps, horizontal drags, interactive elements and text selection alone', () => {
  const surface = document.createElement('div');
  surface.innerHTML = '<a href="#cta">CTA</a><div class="split-media-overlay"><p>Text</p></div>';
  document.body.append(surface);
  const actions = { begin: jest.fn(() => true), move: jest.fn(), end: jest.fn(() => true), cancel: jest.fn() };
  const binding = bindGestures(surface, actions);
  for (const target of [surface.querySelector('a')!, surface.querySelector('p')!]) {
    pointer(target, 'pointerdown', 100, 200);
    pointer(window, 'pointermove', 100, 100);
    pointer(window, 'pointerup', 100, 100);
  }
  pointer(surface, 'pointerdown', 100, 200);
  pointer(window, 'pointerup', 100, 200);
  pointer(surface, 'pointerdown', 100, 200);
  pointer(window, 'pointermove', 200, 205);
  pointer(window, 'pointerup', 200, 205);
  expect(actions.begin).not.toHaveBeenCalled();
  expect(actions.end).not.toHaveBeenCalled();
  binding.cleanup();
  surface.remove();
});
it('cancels touch recognition for pinch and passes an outward edge to native scroll', () => {
  const surface = document.createElement('div');
  document.body.append(surface);
  const actions = { begin: jest.fn(() => false), move: jest.fn(), end: jest.fn(() => true), cancel: jest.fn() };
  const binding = bindGestures(surface, actions);
  touch(surface, 'touchstart', 200);
  expect(touch(surface, 'touchmove', 100).defaultPrevented).toBe(false);
  touch(surface, 'touchend', 100);
  expect(actions.end).not.toHaveBeenCalled();
  touch(surface, 'touchstart', 200);
  touch(surface, 'touchstart', 200, 2);
  touch(surface, 'touchmove', 100, 2);
  touch(surface, 'touchend', 100);
  expect(actions.begin).toHaveBeenCalledTimes(1);
  binding.cleanup();
  surface.remove();
});
