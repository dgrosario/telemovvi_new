import { EventEmitter } from "events";

type GlobalSSE = {
  sseEmitter: EventEmitter;
};

const globalForSSE = globalThis as unknown as GlobalSSE;

function createEmitter() {
  if (!globalForSSE.sseEmitter) {
    globalForSSE.sseEmitter = new EventEmitter();
  }

  globalForSSE.sseEmitter.setMaxListeners(1000);

  return globalForSSE.sseEmitter;
}

export const sseEmitter = createEmitter();
