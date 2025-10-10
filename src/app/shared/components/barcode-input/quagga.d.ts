declare module '@ericblade/quagga2' {
  export interface QuaggaJSConfigObject {
    inputStream?: {
      name?: string;
      type?: string;
      target?: HTMLElement | string;
      constraints?: {
        width?: number;
        height?: number;
        facingMode?: string;
      };
    };
    decoder?: {
      readers?: string[];
    };
    locate?: boolean;
    locator?: {
      patchSize?: string;
      halfSample?: boolean;
    };
    numOfWorkers?: number;
    frequency?: number;
  }

  export interface QuaggaJSResultObject {
    codeResult?: {
      code?: string;
      format?: string;
    };
  }

  export default class Quagga {
    static init(config: QuaggaJSConfigObject, callback: (err: any) => void): void;
    static start(): void;
    static stop(): void;
    static onDetected(callback: (result: QuaggaJSResultObject) => void): void;
  }
}
