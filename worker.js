// www.isaacbridge.com redirects to isaacbridge.com; search-engine verification files are served
// at their exact .html address (the asset layer would otherwise redirect them); everything else is the static site.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.isaacbridge.com') {
      url.hostname = 'isaacbridge.com';
      return Response.redirect(url.toString(), 301);
    }
    if (/^\/(google[0-9a-f]+|naver[0-9a-f]+)\.html$/.test(url.pathname)) {
      url.pathname = url.pathname.slice(0, -5);
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
