// SPDX-License-Identifier: MPL-2.0
declare module 'imagetracerjs' {
  type TraceImageData = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  type TraceOptions = Record<string, unknown>;

  const ImageTracer: {
    imagedataToSVG: (image: TraceImageData, options?: TraceOptions | string) => string;
  };

  export default ImageTracer;
}
