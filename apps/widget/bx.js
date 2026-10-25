// Buildonyx chat widget — minimal starter for SIY-8.
// Usage on any site: <script src="https://YOUR_API/bx.js" data-client="spa-slug" defer></script>
(function () {
  const script = document.currentScript || document.querySelector('script[src*="bx.js"]');
  // data-client on the tag, or ?client= in the page URL (used by demo links)
  const slug = script.dataset.client || new URLSearchParams(location.search).get('client');
  const API = new URL(script.src).origin;
  if (!slug) return console.warn('[bx] no client slug');
  const messages = [];

  // One id per browser tab session so the API updates a single lead (SIY-9)
  let sessionId;
  try {
    sessionId = sessionStorage.getItem('bx-session');
    if (!sessionId) sessionStorage.setItem('bx-session', (sessionId = crypto.randomUUID()));
  } catch {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
  }

  const color = script.dataset.color || '#111827';

  // Render inside a shadow root so host-page CSS (and cosmetic filters / extensions
  // that match on ids/classes) can't hide or restyle the widget.
  const host = document.createElement('div');
  host.id = 'bx-root';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      #bx-btn{border-radius:50%;border:0;background:${color};color:#fff;font-size:24px;line-height:1;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);padding:0;margin:0}
      #bx-box{position:fixed;bottom:88px;right:20px;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 108px);background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;font:14px system-ui,sans-serif;color:#111;z-index:2147483647}
      #bx-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .bx-m{padding:8px 12px;border-radius:12px;max-width:85%;line-height:1.4;white-space:pre-wrap}
      .bx-u{align-self:flex-end;background:${color};color:#fff}
      .bx-a{align-self:flex-start;background:#f1f5f9;color:#111}
      #bx-form{display:flex;border-top:1px solid #e5e7eb;margin:0}
      #bx-in{flex:1;border:0;padding:12px;outline:none;font:inherit;color:inherit;background:#fff}
      #bx-send{border:0;background:none;padding:0 14px;color:${color};font:inherit;font-weight:600;cursor:pointer}
    </style>
    <div id="bx-box"><div id="bx-log"></div>
      <form id="bx-form"><input id="bx-in" placeholder="Ask about treatments, pricing..." autocomplete="off"/><button id="bx-send">Send</button></form>
    </div>
    <button id="bx-btn" aria-label="Chat" style="position:fixed;bottom:20px;right:20px;z-index:2147483647;width:56px;height:56px;display:flex">💬</button>`;
  document.body.appendChild(host);

  const box = root.querySelector('#bx-box');
  const log = root.querySelector('#bx-log');
  const input = root.querySelector('#bx-in');

  function add(role, text) {
    const el = document.createElement('div');
    el.className = 'bx-m ' + (role === 'user' ? 'bx-u' : 'bx-a');
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  root.querySelector('#bx-btn').onclick = () => {
    const open = box.style.display === 'flex';
    box.style.display = open ? 'none' : 'flex';
    if (!open && !log.children.length) add('assistant', 'Hi! How can I help you today?');
  };

  root.querySelector('#bx-form').onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    add('user', text);
    messages.push({ role: 'user', content: text });
    const pending = add('assistant', '...');
    try {
      const res = await fetch(API + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sessionId, messages }),
      });
      const data = await res.json();
      pending.textContent = data.reply || 'Sorry, something went wrong.';
      messages.push({ role: 'assistant', content: pending.textContent });
    } catch {
      pending.textContent = 'Sorry, I could not connect. Please try again.';
    }
  };

  console.log('[bx] widget loaded', slug);
})();
