declare module "socket.io-msgpack-parser" {
  import type { Encoder, Decoder } from "socket.io-parser";
  const parser: {
    protocol: number;
    Encoder: typeof Encoder;
    Decoder: typeof Decoder;
  };
  export default parser;
}
