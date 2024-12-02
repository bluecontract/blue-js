import { HostCommunicator } from '../messaging/HostCommunicator';

export class RouteChangeListener {
  private static readonly historyStateChangeEvent = 'history-state-change';

  private originalPushState = history.pushState;
  private originalReplaceState = history.replaceState;

  private communicator: HostCommunicator;
  private mutationObserver?: MutationObserver;

  // TODO: Store the full URL instead of just the pathname and reuse it also in the route change handler (To support different variants of routing)
  private previousPathName?: string;

  constructor(communicator: HostCommunicator) {
    this.communicator = communicator;
  }

  public startListening() {
    window.addEventListener('popstate', this.handleRouteChange);

    // Add URL polling for cases where History API isn't used (observe the document for URL changes)
    this.mutationObserver = new MutationObserver(this.handleRouteChange);
    this.mutationObserver.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    this.startListeningToHistory();

    // Send the initial route change
    this.handleRouteChange();
  }

  private startListeningToHistory() {
    history.pushState = (
      ...args: Parameters<typeof this.originalPushState>
    ) => {
      this.originalPushState.apply(history, args);
      window.dispatchEvent(
        new Event(RouteChangeListener.historyStateChangeEvent)
      );
    };

    history.replaceState = (
      ...args: Parameters<typeof this.originalReplaceState>
    ) => {
      this.originalReplaceState.apply(history, args);
      window.dispatchEvent(
        new Event(RouteChangeListener.historyStateChangeEvent)
      );
    };

    window.addEventListener(
      RouteChangeListener.historyStateChangeEvent,
      this.handleRouteChange
    );
  }

  private stopListeningToHistory() {
    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;

    window.removeEventListener(
      RouteChangeListener.historyStateChangeEvent,
      this.handleRouteChange
    );
  }

  private handleRouteChange = () => {
    const pathname = window.location.pathname;
    if (pathname !== this.previousPathName) {
      this.previousPathName = pathname;
      this.communicator.sendMessage({
        type: 'route-change',
        payload: { path: pathname },
      });
    }
  };

  public stopListening() {
    window.removeEventListener('popstate', this.handleRouteChange);
    this.mutationObserver?.disconnect();
    this.stopListeningToHistory();
  }
}
