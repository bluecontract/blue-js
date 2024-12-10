import { Logger } from '@blue-company/app-sdk-core';

const SIZE_ATTR = 'data-iframe-size';
const getAllElements = (element: Element | Document) => () =>
  Array.from(
    element.querySelectorAll(
      '* :not(head):not(meta):not(base):not(title):not(script):not(link):not(style):not(map):not(area):not(option):not(optgroup):not(template):not(track):not(wbr):not(nobr)'
    )
  );

export class IframeResizer {
  /**
   * @description Whether the iframe has tags based on which the size will be calculated, defined by the `sizeSelector`
   */
  private hasTags = false;
  private taggedElements: Element[] = [];

  /**
   * TODO: Implement this
   */
  private hasOverflow = false;
  private overflowedNodeList: Element[] = [];

  private triggerLocked = false;

  private prevBoundingSize = 0;
  private prevScrollSize = 0;

  private config = {
    offsetHeight: 0,
    enabled: true,
    sizeSelector: '',
  };

  constructor(private logger: Logger) {
    this.logger = logger.cloneWithConfig({
      enabled: false,
    });
  }

  public calculateHeight = () => {
    return this.getAutoSize();
  };

  public checkAndSetupTags = () => {
    this.taggedElements = Array.from(
      document.querySelectorAll(`[${SIZE_ATTR}]`)
    );
    this.hasTags = this.taggedElements.length > 0;
    this.logger.debug(`Tagged elements found: ${this.hasTags}`);
  };

  public applySizeSelector = () => {
    if (this.config.sizeSelector === '') return;

    this.logger.debug(`Applying sizeSelector: ${this.config.sizeSelector}`);

    for (const el of Array.from(
      document.querySelectorAll(this.config.sizeSelector)
    )) {
      (el as HTMLElement).dataset.iframeSize = 'true';
    }
  };

  public stopInfiniteResizingOfIframe = () => {
    const setAutoHeight = (el: HTMLElement) =>
      el.style.setProperty('height', 'auto', 'important');

    setAutoHeight(document.documentElement);
    setAutoHeight(document.body);

    this.logger.debug('HTML & body height set to "auto !important"');
  };

  public injectClearFixIntoBodyElement = () => {
    const clearFix = document.createElement('div');

    clearFix.style.clear = 'both';
    // Guard against the following having been globally redefined in CSS.
    clearFix.style.display = 'block';
    clearFix.style.height = '0';
    document.body.append(clearFix);
  };

  private getAutoSize = () => {
    const returnBoundingClientRect = () => {
      this.prevBoundingSize = boundingSize;
      this.prevScrollSize = scrollSize;
      return boundingSize;
    };

    const boundingSize = this.heightBoundingClientRect;
    const ceilBoundingSize = Math.ceil(boundingSize);
    const floorBoundingSize = Math.floor(boundingSize);
    const scrollSize = this.getAdjustedScroll();
    const sizes = `HTML: ${boundingSize}  Page: ${scrollSize}`;

    switch (true) {
      case !this.config.enabled:
        return scrollSize;

      case this.hasTags:
        return this.heightTaggedElement;

      case !this.hasOverflow &&
        this.prevBoundingSize === 0 &&
        this.prevScrollSize === 0:
        this.logger.debug(`Initial page size values: ${sizes}`);
        return returnBoundingClientRect();

      case this.triggerLocked &&
        boundingSize === this.prevBoundingSize &&
        scrollSize === this.prevScrollSize:
        this.logger.debug(`Size unchanged: ${sizes}`);
        return Math.max(boundingSize, scrollSize);

      case boundingSize === 0:
        this.logger.debug(`Page is hidden: ${sizes}`);
        return scrollSize;

      case !this.hasOverflow &&
        boundingSize !== this.prevBoundingSize &&
        scrollSize <= this.prevScrollSize:
        this.logger.debug(
          `New HTML bounding size: ${sizes}`,
          'Previous bounding size:',
          this.prevBoundingSize
        );
        return returnBoundingClientRect();

      case !this.hasOverflow && boundingSize < this.prevBoundingSize:
        this.logger.debug('HTML bounding size decreased:', sizes);
        return returnBoundingClientRect();

      case scrollSize === floorBoundingSize || scrollSize === ceilBoundingSize:
        this.logger.debug('HTML bounding size equals page size:', sizes);
        return returnBoundingClientRect();

      case boundingSize > scrollSize:
        this.logger.debug(`Page size < HTML bounding size: ${sizes}`);
        return returnBoundingClientRect();

      default:
        this.logger.debug(`Content overflowing HTML element: ${sizes}`);
    }

    return Math.max(this.heightTaggedElement, returnBoundingClientRect());
  };

  private getAdjustedScroll = () => {
    return (
      this.heightDocumentElementScroll + Math.max(0, this.config.offsetHeight)
    );
  };

  private get heightBoundingClientRect() {
    return Math.max(
      document.documentElement.getBoundingClientRect().bottom,
      document.body.getBoundingClientRect().bottom
    );
  }

  private get heightDocumentElementScroll() {
    return document.documentElement.scrollHeight;
  }

  private get heightTaggedElement() {
    return this.getMaxElement('bottom');
  }

  private getMaxElement(side: 'top' | 'bottom') {
    let elVal = 0;
    let maxVal = this.hasTags
      ? 0
      : document.documentElement.getBoundingClientRect().bottom;

    const targetElements = this.hasTags
      ? this.taggedElements
      : this.hasOverflow
      ? this.overflowedNodeList
      : getAllElements(document)(); // We should never get here, but just in case

    const hasCheckVisibility = 'checkVisibility' in window;

    for (const element of targetElements) {
      if (
        !this.hasTags &&
        hasCheckVisibility && // Safari was missing checkVisibility until March 2024
        !element.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        })
      ) {
        continue;
      }

      elVal =
        element.getBoundingClientRect()[side] +
        parseFloat(
          getComputedStyle(element).getPropertyValue(`margin-${side}`)
        );

      if (elVal > maxVal) {
        maxVal = elVal;
      }
    }

    return maxVal;
  }

  public lockTrigger = () => {
    if (this.triggerLocked) return;

    this.triggerLocked = true;
    this.logger.debug('Trigger event lock on');

    requestAnimationFrame(() => {
      this.triggerLocked = false;
      this.logger.debug('Trigger event lock off');
      this.logger.debug('--');
    });
  };
}
