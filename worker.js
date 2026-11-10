// www.isaacbridge.com redirects to isaacbridge.com; everything else is the static site.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.isaacbridge.com') {
      url.hostname = 'isaacbridge.com';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
