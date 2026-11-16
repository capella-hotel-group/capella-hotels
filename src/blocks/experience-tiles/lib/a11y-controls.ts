export const LABELS = {
  carousel: 'Experience tiles',
  previous: 'Previous slide',
  next: 'Next slide',
  slide: (n: number, total: number): string => `${n} of ${total}`,
  status: (n: number, total: number): string => `Slide ${n} of ${total}`,
  newTab: '(opens in new tab)',
};
