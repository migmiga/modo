import * as amplitude from "@amplitude/analytics-browser";

// Client-only: instrumentation-client.ts (project root) calls this before
// hydration, so this module never runs on the server and needs no "use
// client" directive — it isn't a React component.
export function initAnalytics() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;

  amplitude.init(apiKey, {
    autocapture: {
      // Page views, form interactions, sessions, attribution, and file
      // downloads default to true inside autocapture — only element
      // (click) tracking defaults to false, so it's opted in explicitly.
      elementInteractions: true,
    },
  });
}
