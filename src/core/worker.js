// @ts-check
/**
 * Module core/worker
 *
 * Exports a Web Worker for ReSpec, allowing for
 * multi-threaded processing of things.
 */
export const name = "core/worker";

import { fetchBase } from "./text-loader.js";

async function loadWorkerScript() {
  try {
    return (await import("text!../../builds/respec-worker.js")).default;
  } catch {
    return fetchBase("builds/respec-worker.js");
  }
}

async function createWorker() {
  const workerScript = await loadWorkerScript();
  const blob = new Blob([workerScript], {
    type: "text/javascript",
  });
  return new Worker(URL.createObjectURL(blob), { type: "module" });
}

export const workerPromise = createWorker();
