import decorate from './footer-contact';

jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: jest.fn(),
}));

function createBlock(content: string): HTMLElement {
  const block = document.createElement('div');
  block.innerHTML = `<div><div>Contact Us</div></div><div><div>${content}</div></div>`;
  return block;
}

describe('footer-contact', () => {
  it('adds line-break opportunities after "@" and before the TLD in email links without changing their text', () => {
    const block = createBlock('<p><a href="mailto:info@capellahotels.com">info@capellahotels.com</a></p>');

    decorate(block);

    const link = block.querySelector('a[href^="mailto:"]');
    expect(link?.innerHTML).toBe(
      '<bdi class="footer-contact-email" dir="ltr">info@<wbr><span class="footer-contact-email-domain">capellahotels<wbr>.com</span></bdi>',
    );
    expect(link?.textContent).toBe('info@capellahotels.com');
  });

  it('adds a line-break opportunity before each "." in the local part of long emails', () => {
    const block = createBlock(
      '<p><a href="mailto:reservations.singapore@capellahotels.com">reservations.singapore@capellahotels.com</a></p>',
    );

    decorate(block);

    const link = block.querySelector('a[href^="mailto:"]');
    expect(link?.innerHTML).toBe(
      '<bdi class="footer-contact-email" dir="ltr">reservations<wbr>.singapore@<wbr><span class="footer-contact-email-domain">capellahotels<wbr>.com</span></bdi>',
    );
    expect(link?.textContent).toBe('reservations.singapore@capellahotels.com');
  });

  it('adds break opportunities to emails nested in inline formatting', () => {
    const block = createBlock(
      '<p><a href="mailto:info@capellahotels.com"><strong>info@capellahotels.com</strong></a></p>',
    );

    decorate(block);

    expect(block.querySelectorAll('strong wbr')).toHaveLength(2);
    expect(block.querySelector('a')?.textContent).toBe('info@capellahotels.com');
  });

  it('leaves email links whose text is not an address untouched', () => {
    const block = createBlock('<p><a href="mailto:info@capellahotels.com">Email us</a></p>');

    decorate(block);

    expect(block.querySelector('a')?.innerHTML).toBe('Email us');
  });

  it('keeps phone number digit groups together with non-breaking spaces', () => {
    const block = createBlock('<p><a href="tel:+81755418877">+81 75 541 8877</a></p>');

    decorate(block);

    expect(block.querySelector('a')?.textContent).toBe('+81\u00a075\u00a0541\u00a08877');
  });

  it('leaves descriptive phone link text wrappable', () => {
    const block = createBlock('<p><a href="tel:+81755418877">Call our team</a></p>');

    decorate(block);

    expect(block.querySelector('a')?.textContent).toBe('Call our team');
  });
});
