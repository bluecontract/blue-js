export interface Message {
  type: string;
  payload?: unknown;
  requestId?: string; // Optional, for correlating requests and responses
}

export interface PageHeightMessage extends Message {
  type: 'page-height';
  payload: {
    height: number;
  };
}

export interface RouteUpdateMessage extends Message {
  type: 'route-update';
  payload: {
    route: string;
  };
}

export interface CustomMessage extends Message {
  type: 'custom';
  payload: unknown;
}

export interface ApiRequestMessage extends Message {
  type: 'api-request';
  payload: {
    method: string;
    url: string;
  };
}

export interface ApiResponseMessage extends Message {
  type: 'api-response';
  payload: {
    requestId: string;
    data: unknown;
  };
}
