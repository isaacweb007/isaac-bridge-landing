// isaacbridge.com
// - www.isaacbridge.com redirects to isaacbridge.com
// - search-engine verification files are served at their exact .html address
// - POST /api/contact: the inquiry form; each inquiry is mailed to every address in INQUIRY_TO
//   through Cloudflare Email Routing (send_email binding MAIL; destinations must be verified)
// - everything else is the static site
import { EmailMessage } from 'cloudflare:email';

const INQUIRY_TO = ['msc690428@gmail.com', 'jiyoungjws1981@gmail.com'];
const FROM = 'inquiry@isaacbridge.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.isaacbridge.com') {
      url.hostname = 'isaacbridge.com';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/contact') return contact(request, env);
    if (/^\/(google[0-9a-f]+|naver[0-9a-f]+)\.html$/.test(url.pathname)) {
      url.pathname = url.pathname.slice(0, -5);
      return env.ASSETS.fetch(new Request(url, request));
    }
    const res = await env.ASSETS.fetch(request);
    return /\.(mp4|webm)$/.test(url.pathname) ? ranged(request, res) : res;
  },
};

// Video needs byte ranges (iPhone Safari will not play an mp4 without 206 answers); the asset
// server answers 200 with the whole file, so slice it here. Files are a few MB.
async function ranged(request, res) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  const headers = new Headers(res.headers);
  headers.set('accept-ranges', 'bytes');
  if (res.status !== 200 || !m || (!m[1] && !m[2])) return new Response(res.body, { status: res.status, headers });
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let start = m[1] ? +m[1] : Math.max(0, size - +m[2]);
  let end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start >= size || start > end) {
    headers.set('content-range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const oneLine = v => v.replace(/[\r\n]+/g, ' ');                       // no header injection
const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const wrap = s => s.replace(/.{1,76}/g, '$&\r\n');
const word = s => `=?UTF-8?B?${b64(s)}?=`;

async function contact(request, env) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (new URL(request.url).hostname !== 'isaacbridge.com') return json(403, { ok: false, error: 'origin' });
  let d;
  try { d = await request.json(); } catch { return json(400, { ok: false, error: 'json' }); }
  // quiet bot checks: the hidden field must stay empty and a person needs a few seconds to fill the form
  if (clean(d.website, 200) || Number(d.elapsed) < 3000) return json(200, { ok: true });
  const f = {
    name: oneLine(clean(d.name, 60)), company: oneLine(clean(d.company, 80)), email: oneLine(clean(d.email, 120)),
    phone: oneLine(clean(d.phone, 40)), when: oneLine(clean(d.when, 60)), message: clean(d.message, 4000),
    kinds: (Array.isArray(d.kinds) ? d.kinds : []).slice(0, 8).map(k => oneLine(clean(k, 40))).filter(Boolean),
    lang: oneLine(clean(d.lang, 8)), page: oneLine(clean(d.page, 200)),
  };
  if (!f.name || !f.message || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(f.email)) return json(400, { ok: false, error: 'fields' });
  if (!env.MAIL) return json(503, { ok: false, error: 'mail-off' });

  const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const text = [
    `아이작브릿지 웹사이트로 새 프로젝트 문의가 왔습니다. (${when})`, '',
    `이름: ${f.name}`, `회사·팀: ${f.company || '-'}`, `이메일: ${f.email}`, `연락처: ${f.phone || '-'}`,
    `희망 시작 시기: ${f.when || '-'}`, `만들고 싶은 것: ${f.kinds.join(', ') || '-'}`, '',
    '내용:', f.message, '',
    `언어: ${f.lang || '-'} · 국가: ${request.headers.get('cf-ipcountry') || '-'} · 페이지: ${f.page || '-'}`,
    '이 메일에 답장하면 문의하신 분에게 바로 갑니다.',
  ].join('\r\n');
  const subject = `[아이작브릿지 문의] ${f.company || f.name} · ${f.kinds[0] || '프로젝트'}`;

  let sent = 0;
  for (const to of INQUIRY_TO) {
    const raw = [
      `From: ${word('아이작브릿지 문의')} <${FROM}>`, `To: <${to}>`, `Reply-To: ${word(f.name)} <${f.email}>`,
      `Subject: ${word(subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@isaacbridge.com>`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(text)),
    ].join('\r\n');
    try { await env.MAIL.send(new EmailMessage(FROM, to, raw)); sent++; }
    catch (e) { console.log('mail to', to, 'failed:', e && e.message); }  // e.g. destination not verified yet
  }
  return sent ? json(200, { ok: true }) : json(502, { ok: false, error: 'send' });
}
