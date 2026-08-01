import { extractVisit } from './extract.js';
import { persistVisit } from './persist.js';

const MAX_BODY_BYTES = 8192;
const TEXTUAL = /^(text\/|application\/(json|xml|x-www-form-urlencoded|javascript))/i;

async function readRequestBody(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return { bodyText: null, bodyLen: 0, requestForOrigin: request };
  }

  const contentType = request.headers.get('Content-Type') || '';
  const buffer = await request.arrayBuffer();
  const bodyLen = buffer.byteLength;

  // Rebuild request so origin still receives the body
  const requestForOrigin = new Request(request, { body: buffer });

  let bodyText = null;
  if (bodyLen > 0 && bodyLen <= MAX_BODY_BYTES && TEXTUAL.test(contentType)) {
    bodyText = new TextDecoder().decode(buffer);
  }

  return { bodyText, bodyLen, requestForOrigin };
}

export default {
  async fetch(request, env, ctx) {
    let status = null;
    let bodyText = null;
    let bodyLen = null;
    let response;

    try {
      const read = await readRequestBody(request);
      bodyText = read.bodyText;
      bodyLen = read.bodyLen;
      response = await fetch(read.requestForOrigin);
      status = response.status;
    } catch (err) {
      console.log(
        JSON.stringify({
          type: 'visit_error',
          stage: 'origin_fetch',
          message: String(err && err.message ? err.message : err),
        })
      );
      response = new Response('Bad gateway', { status: 502 });
      status = 502;
    }

    const visitPromise = (async () => {
      try {
        const visit = await extractVisit(request, { status, bodyText, bodyLen });
        await persistVisit(env, visit);
      } catch (err) {
        console.log(
          JSON.stringify({
            type: 'visit_error',
            stage: 'persist',
            message: String(err && err.message ? err.message : err),
          })
        );
      }
    })();

    ctx.waitUntil(visitPromise);
    return response;
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      env.DB.prepare(
        "DELETE FROM visits WHERE ts < datetime('now', '-90 days')"
      ).run()
    );
  },
};
