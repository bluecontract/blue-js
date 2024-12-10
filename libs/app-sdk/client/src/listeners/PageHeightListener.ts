import { HostCommunicator } from '../messaging/HostCommunicator';
import { IframeResizer } from '../resizer/IframeResizer';

export class PageHeightListener {
  private resizeObserver: ResizeObserver;
  private mutationObserver: MutationObserver;

  private sendPending = false;
  private height = 1;
  private tolerance = 0;

  constructor(
    private communicator: HostCommunicator,
    private iframeResizer: IframeResizer
  ) {
    this.resizeObserver = new ResizeObserver(this.handler);
    this.mutationObserver = new MutationObserver(this.handler);
  }

  startListening(): void {
    const rootElement = document.querySelector('body');

    if (!rootElement) return;

    this.resizeObserver.observe(rootElement);
    this.mutationObserver.observe(rootElement, {
      attributes: false,
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false,
      childList: true,
      subtree: true,
    });

    window.addEventListener('afterprint', this.handler, { passive: true });
    window.addEventListener('beforeprint', this.handler, { passive: true });
    window.addEventListener('readystatechange', this.handler, {
      passive: true,
    });
  }

  stopListening(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    window.removeEventListener('readystatechange', this.handler);
    window.removeEventListener('beforeprint', this.handler);
    window.removeEventListener('afterprint', this.handler);
  }

  private handler = () => {
    if (document.hidden) {
      return;
    }

    if (!this.sendPending) {
      this.checkAndSendHeight();

      requestAnimationFrame(() => {
        this.sendPending = false;
      });
    }

    this.sendPending = true;
  };

  private checkAndSendHeight = () => {
    const isSizeChangeDetected = (newHeight: number) =>
      this.checkTolerance(this.height, newHeight);

    const calculatedHeight = this.iframeResizer.calculateHeight();

    if (isSizeChangeDetected(calculatedHeight)) {
      this.iframeResizer.lockTrigger();
      this.height = calculatedHeight;

      this.communicator.sendMessage({
        type: 'page-height',
        payload: { height: this.height },
      });
    }
  };

  private checkTolerance = (a: number, b: number) =>
    !(Math.abs(a - b) <= this.tolerance);
}
