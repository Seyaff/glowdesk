// Buildonyx chat widget — minimal starter for SIY-8.
// Usage on any site: <script src="https://YOUR_API/widget.js" data-client="spa-slug" defer></script>
(function () {
  const script = document.currentScript;
  const slug = script.dataset.client;
  const API = new URL(script.src).origin;
  const messages = [];

  const color = script.dataset.color || '#111827';
  const root = document.createElement('div');
  root.innerHTML = `
    <style>
      #bx-btn{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:0;background:${color};color:#fff;font-size:24px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99999}
      #bx-box{position:fixed;bottom:88px;right:20px;width:340px;max-width:calc(100vw - 40px);height:460px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;font:14px system-ui,sans-serif;z-index:99999}
      #bx-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .bx-m{padding:8px 12px;border-radius:12px;max-width:85%;line-height:1.4;white-space:pre-wrap}
      .bx-u{align-self:flex-end;background:${color};color:#fff}
      .bx-a{align-self:flex-start;background:#f1f5f9;color:#111}
      #bx-form{display:flex;border-top:1px solid #e5e7eb}
      #bx-in{flex:1;border:0;padding:12px;outline:none;font:inherit}
      #bx-send{border:0;background:none;padding:0 14px;color:${color};font-weight:600;cursor:pointer}
    </style>
    <div id="bx-box"><div id="bx-log"></div>
      <form id="bx-form"><input id="bx-in" placeholder="Ask about treatments, pricing..." autocomplete="off"/><button id="bx-send">Send</button></form>
    </div>
    <button id="bx-btn" aria-label="Chat">💬</button>`;
  document.body.appendChild(root);

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
        body: JSON.stringify({ slug, messages }),
      });
      const data = await res.json();
      pending.textContent = data.reply || 'Sorry, something went wrong.';
      messages.push({ role: 'assistant', content: pending.textContent });
    } catch {
      pending.textContent = 'Sorry, I could not connect. Please try again.';
    }
  };
})();
