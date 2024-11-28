import { HostCommunicator } from '../messaging/HostCommunicator';

export class PageHeightListener {
  private resizeObserver: ResizeObserver;
  private mutationObserver: MutationObserver;

  constructor(private communicator: HostCommunicator) {
    this.resizeObserver = new ResizeObserver(this.handleHeightChange);
    this.mutationObserver = new MutationObserver(this.handleHeightChange);
  }

  startListening(): void {
    // TODO: This is a temporary solution to get the root element.
    // We need to find a better way to do this.
    const rootElement = document.getElementById('root');
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
  }

  stopListening(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
  }

  private handleHeightChange = () => {
    const height = document
      .getElementById('root')
      ?.getBoundingClientRect().height;

    this.communicator.sendMessage({
      type: 'page-height',
      payload: { height: height ?? 0 },
    });
  };
}
