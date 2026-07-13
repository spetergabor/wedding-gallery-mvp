declare module "lazystream" {
  import { PassThrough } from "node:stream";

  export class Readable extends PassThrough {
    constructor(createStream: (options?: object) => NodeJS.ReadableStream, options?: object);
  }

  export class Writable extends PassThrough {
    constructor(createStream: (options?: object) => NodeJS.WritableStream, options?: object);
  }
}
