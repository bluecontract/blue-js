import { MessageBus, PageHeightMessage } from '@blue-company/app-sdk-core';
import { IframeCommunicator } from 'src/messaging/IframeCommunicator';

export class PageHeightHandler {
  private unsubscribe: (() => void) | undefined = undefined;

  constructor(
    private messageBus: MessageBus,
    private communicator: IframeCommunicator
  ) {}

  public startHandling() {
    this.unsubscribe = this.messageBus.subscribe<PageHeightMessage['payload']>(
      'page-height',
      this.handleHeightChange
    );
  }

  public stopHandling() {
    this.unsubscribe?.();
  }

  private handleHeightChange = (payload: PageHeightMessage['payload']) => {
    const iframe = this.communicator.getIframeElement();
    if (!iframe) {
      console.warn('Cannot resize: iframe element not found');
      return;
    }
    iframe.style.height = `${payload.height}px`;
  };

  destroy(): void {
    this.stopHandling();
  }
}
