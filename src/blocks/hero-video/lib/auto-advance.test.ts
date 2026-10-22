import { AutoAdvance, FALLBACK_ADVANCE_MS } from './auto-advance';

describe('hero-video AutoAdvance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('advances to the next index when the active video ends', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);

    auto.handleEnded(0);

    expect(onAdvance).toHaveBeenCalledWith(1);
  });

  it('wraps from the last item back to the first', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);

    auto.handleEnded(2);

    expect(onAdvance).toHaveBeenCalledWith(0);
  });

  it('defers an end that happens before the intro completes until ready', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);

    auto.handleEnded(0);
    expect(onAdvance).not.toHaveBeenCalled();

    auto.setReady(true);
    expect(onAdvance).toHaveBeenCalledWith(1);
  });

  it('does nothing with a single item', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(1, onAdvance);
    auto.setReady(true);

    auto.handleEnded(0);
    auto.scheduleFallback(0);
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS);

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('advances after the fallback delay for items without playable video', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);

    auto.scheduleFallback(1);
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS - 1);
    expect(onAdvance).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledWith(2);
  });

  it('cancels a pending fallback', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);

    auto.scheduleFallback(0);
    auto.cancel();
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS);

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('reschedules the fallback while the document is hidden', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    auto.scheduleFallback(0);
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS);
    expect(onAdvance).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS);
    expect(onAdvance).toHaveBeenCalledWith(1);
    hidden.mockRestore();
  });

  it('ignores ends and fallbacks after destroy', () => {
    const onAdvance = jest.fn();
    const auto = new AutoAdvance(3, onAdvance);
    auto.setReady(true);

    auto.scheduleFallback(0);
    auto.destroy();
    auto.handleEnded(0);
    jest.advanceTimersByTime(FALLBACK_ADVANCE_MS);

    expect(onAdvance).not.toHaveBeenCalled();
  });
});
