import decorate from './destination-cards-signature';

describe('Destination Cards Signature Block', () => {
  let block: HTMLElement;

  beforeEach(() => {
    block = document.createElement('div');
    block.className = 'destination-cards-signature';
  });

  afterEach(() => {
    block.remove();
  });

  describe('Block Structure', () => {
    test('should add class to block', async () => {
      await decorate(block);
      expect(block.classList.contains('destination-cards-signature')).toBe(true);
    });

    test('should create intro section with title', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const intro = block.querySelector('.destination-cards-signature-intro');
      expect(intro).toBeTruthy();

      const title = intro?.querySelector('.destination-cards-signature-title');
      expect(title?.textContent).toBe('Test Title');
    });

    test('should create carousel container', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const carousel = block.querySelector('.destination-cards-signature-carousel');
      expect(carousel).toBeTruthy();
    });

    test('should create modal', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const modal = block.querySelector('.destination-cards-signature-modal');
      expect(modal).toBeTruthy();
    });
  });

  describe('Background Style', () => {
    test('should apply signature-warm style by default', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      expect(block.classList.contains('destination-cards-signature--signature-warm')).toBe(true);
    });

    test('should apply custom background style', async () => {
      const idCell = document.createElement('div');
      idCell.textContent = '';
      const testIdCell = document.createElement('div');
      testIdCell.textContent = '';
      const eyebrowCell = document.createElement('div');
      eyebrowCell.textContent = '';
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      const descCell = document.createElement('div');
      descCell.textContent = '';
      const bgStyleCell = document.createElement('div');
      bgStyleCell.textContent = 'default-light';

      block.append(idCell, testIdCell, eyebrowCell, titleCell, descCell, bgStyleCell);

      await decorate(block);

      expect(block.classList.contains('destination-cards-signature--default-light')).toBe(true);
    });
  });

  describe('Test ID', () => {
    test('should set testId attribute if provided', async () => {
      const idCell = document.createElement('div');
      idCell.textContent = '';
      const testIdCell = document.createElement('div');
      testIdCell.textContent = 'my-test-id';
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';

      block.append(idCell, testIdCell, titleCell);

      await decorate(block);

      expect(block.getAttribute('data-testid')).toBe('my-test-id');
    });
  });

  describe('Intro Section', () => {
    test('should render eyebrow when provided', async () => {
      const idCell = document.createElement('div');
      idCell.textContent = '';
      const testIdCell = document.createElement('div');
      testIdCell.textContent = '';
      const eyebrowCell = document.createElement('div');
      eyebrowCell.textContent = 'CAPELLA SIGNATURE';
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';

      block.append(idCell, testIdCell, eyebrowCell, titleCell);

      await decorate(block);

      const eyebrow = block.querySelector('.destination-cards-signature-eyebrow');
      expect(eyebrow?.textContent).toBe('CAPELLA SIGNATURE');
    });

    test('should render description when provided', async () => {
      const idCell = document.createElement('div');
      idCell.textContent = '';
      const testIdCell = document.createElement('div');
      testIdCell.textContent = '';
      const eyebrowCell = document.createElement('div');
      eyebrowCell.textContent = '';
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      const descCell = document.createElement('div');
      descCell.textContent = 'Test Description';

      block.append(idCell, testIdCell, eyebrowCell, titleCell, descCell);

      await decorate(block);

      const description = block.querySelector('.destination-cards-signature-description');
      expect(description?.textContent).toBe('Test Description');
    });

    test('should set component anchor ID when provided', async () => {
      const idCell = document.createElement('div');
      idCell.textContent = 'my-anchor';
      const testIdCell = document.createElement('div');
      testIdCell.textContent = '';
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';

      block.append(idCell, testIdCell, titleCell);

      await decorate(block);

      const intro = block.querySelector('.destination-cards-signature-intro');
      expect(intro?.id).toBe('my-anchor');
    });
  });

  describe('Modal', () => {
    test('should create modal with default heading', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const modalTitle = block.querySelector('.destination-cards-signature-modal-title');
      expect(modalTitle?.textContent).toBe('Choose destination');
    });

    test('should create modal with custom heading', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      const modalHeadingCell = document.createElement('div');
      modalHeadingCell.textContent = 'Custom Modal Title';

      // Pad with required cells to get to modalHeadingCell
      const idCell = document.createElement('div');
      const testIdCell = document.createElement('div');
      const eyebrowCell = document.createElement('div');
      const descCell = document.createElement('div');
      const bgStyleCell = document.createElement('div');
      const submitLabelCell = document.createElement('div');

      block.append(
        idCell,
        testIdCell,
        eyebrowCell,
        titleCell,
        descCell,
        bgStyleCell,
        modalHeadingCell,
        submitLabelCell,
      );

      await decorate(block);

      const modalTitle = block.querySelector('.destination-cards-signature-modal-title');
      expect(modalTitle?.textContent).toBe('Custom Modal Title');
    });

    test('should create modal submit button with default label', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const submitBtn = block.querySelector('.destination-cards-signature-modal-submit');
      expect(submitBtn?.textContent).toBe('GO TO DESTINATION');
    });

    test('should have close button', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const closeBtn = block.querySelector('.destination-cards-signature-modal-close');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close modal');
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      const titleCell = document.createElement('div');
      titleCell.textContent = 'Test Title';
      block.append(titleCell);

      await decorate(block);

      const closeBtn = block.querySelector('[aria-label="Close modal"]');
      expect(closeBtn).toBeTruthy();
    });
  });
});
