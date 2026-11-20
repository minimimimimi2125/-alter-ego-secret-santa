// ALTER-EGO SECRET SANTA — Cloudflare Worker
// Cloudflare bindings/secrets:
//   DB: D1 database named alter_ego
//   TELEGRAM_BOT_TOKEN: Telegram bot token (Secret)
//   const ADMIN_IDS = "8998835017";
//   WEBAPP_URL: https://YOUR-WORKER.workers.dev/app

const APP_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#120d1b"><title>ALTER-EGO SECRET SANTA</title><script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px 18px;color:#fff;text-align:center;font-family:system-ui;background:radial-gradient(ellipse at top,#49305e,#120d1b 68%)}h1{letter-spacing:2px;font-size:25px;margin:8px 0}.sub{color:#d2bfdf;margin-bottom:24px}#status{min-height:28px;color:#eadcf5;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:440px;margin:auto}.env{min-height:112px;border:1px solid #a17cba;border-radius:16px;background:linear-gradient(145deg,#65447c,#261a35);color:white;font-size:36px;box-shadow:0 8px 22px #0007}.env small{display:block;font-size:11px;color:#eadcf5;margin-top:5px}.env:active{transform:scale(.96)}#result{display:none;margin:24px auto 0;max-width:440px;padding:22px;border:1px solid #c5a0df;border-radius:18px;background:#291d38}#prize{display:block;color:#f4dcff;font-size:23px;margin-top:10px}.hint{font-size:13px;color:#bcaacb;margin-top:22px}
</style></head><body><h1>ALTER-EGO</h1><div class="sub">SECRET SANTA 🎅</div><div id="status">Загружаем конверты…</div><div class="grid" id="grid"></div><div id="result">ТВОЙ КОНВЕРТ 💌<strong id="prize"></strong></div><div class="hint">Один участник — один конверт. Выбор нельзя отменить.</div>
<script>
const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();const statusEl=document.getElementById('status'),grid=document.getElementById('grid'),result=document.getElementById('result'),prize=document.getElementById('prize');
async function api(path,extra={}){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:tg?.initData||'',...extra})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');return d}
async function load(){try{const d=await api('/api/envelopes');statusEl.textContent=d.message||'Выбери один закрытый конверт';grid.innerHTML='';if(d.claimed){result.style.display='block';prize.textContent=d.claimed.prize_title;return}d.envelopes.forEach(n=>{const b=document.createElement('button');b.className='env';b.innerHTML='✉️<small>КОНВЕРТ №'+n+'</small>';b.onclick=()=>claim(n);grid.appendChild(b)})}catch(e){statusEl.textContent=e.message}}
let claiming = false;
async function claim(n) {
  if (claiming) return;

  if (!confirm('Открыть конверт №' + n + '? Выбор будет окончательным.')) return;

  claiming = true;
  const buttons = grid.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  statusEl.textContent = 'Открываем…';

  try {
    const d = await api('/api/claim', { envelope: n });
    grid.innerHTML = '';
    result.style.display = 'block';
    prize.textContent = d.prize_title;
    statusEl.textContent = 'Твой подарок определён ❤️';
    tg?.HapticFeedback?.notificationOccurred('success');
  } catch (e) {
    statusEl.textContent = e.message;
    await load();
  } finally {
    claiming = false;
  }
}

load();
load();
</script></body></html>`;

const reply =</script></body></html>`;

const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8"}});
const ADMIN_ID = "8998835017";
const isAdmin = (env,id) => String(id) === ADMIN_ID;

async function tg(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Не задан TELEGRAM_BOT_TOKEN в Worker Secrets.");
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const d = await r.json(); if (!d.ok) throw new Error(d.description || "Telegram API error"); return d.result;
}
async function say(env, chatId, text, extra={}) { return tg(env,"sendMessage",{chat_id:chatId,text,...extra}); }
async function setting(db,key,fallback="0") { const r=await db.prepare("SELECT setting_value FROM event_settings WHERE setting_key=?").bind(key).first(); return r?.setting_value ?? fallback; }
async function setSetting(db,key,value) { await db.prepare("INSERT INTO event_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value").bind(key,String(value)).run(); }
async function participant(db,id) { return db.prepare("SELECT * FROM participants WHERE telegram_id=?").bind(String(id)).first(); }

async function botUpdate(env,u) {
  const m=u.message;
  if(!m?.text) return;

  const chat=m.chat.id;
  const user=m.from;
  const text=m.text.trim();
  const cmd=text.split(/\s+/)[0].split("@")[0];

  if(cmd==="/start") {
    const open=await setting(env.DB,"registration_open","0");
    let p=await participant(env.DB,user.id);

    if(!p && open==="1") {
      const name=[user.first_name,user.last_name].filter(Boolean).join(" ") || user.username || "Участник";
      await env.DB.prepare("INSERT INTO participants(telegram_id,username,display_name,status) VALUES(?,?,?,'pending')").bind(String(user.id),user.username||null,name).run();
      p=await participant(env.DB,user.id);
    }

    if(!p && open!=="1") {
      return say(env,chat,"🎅 ALTER-EGO SECRET SANTA\nРегистрация пока закрыта. Следи за объявлениями клана.");
    }

    const textReply=p?.status==="approved"
      ? "Ты уже зарегистрирован(а) и допущен(а) к розыгрышу!"
      : "Заявка зарегистрирована! Ожидай подтверждения администратора. 💌";

    return say(env,chat,"🎅 ALTER-EGO SECRET SANTA\n\n"+textReply+"\n\nОдин участник — один конверт.", {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "Открыть конверты 💌",
            web_app: {
              url: "https://aescretsanta.meowmeow-didi1903.workers.dev/app"
            }
          }
        ]]
      }
    });
  }

  if(cmd==="/id") {
    return say(env,chat,"Твой Telegram ID: "+user.id);
  }

  if(cmd==="/admin") {
    if(!isAdmin(env,user.id)) return say(env,chat,"Нет доступа.");

    const p=await env.DB.prepare("SELECT COUNT(*) n FROM participants").first();
    const pending=await env.DB.prepare("SELECT COUNT(*) n FROM participants WHERE status='pending'").first();
    const claimed=await env.DB.prepare("SELECT COUNT(*) n FROM envelopes WHERE claimed_by IS NOT NULL").first();

    return say(env,chat,`🛠 ALTER-EGO ADMIN
Участников: ${p.n}
Ожидают подтверждения: ${pending.n}
Открыто конвертов: ${claimed.n}
Регистрация: ${await setting(env.DB,"registration_open")}
Розыгрыш: ${await setting(env.DB,"draw_open")}

Команды:
/approve TELEGRAM_ID
/openreg и /closereg
/opendraw и /closedraw
/pending`);
  }

  if(["/openreg","/closereg","/opendraw","/closedraw","/pending","/approve"].includes(cmd)) {
    if(!isAdmin(env,user.id)) return say(env,chat,"Нет доступа.");

    if(cmd==="/openreg") {
      await setSetting(env.DB,"registration_open","1");
      return say(env,chat,"Регистрация открыта.");
    }

    if(cmd==="/closereg") {
      await setSetting(env.DB,"registration_open","0");
      return say(env,chat,"Регистрация закрыта.");
    }

    if(cmd==="/opendraw") {
      await setSetting(env.DB,"draw_open","1");
      return say(env,chat,"Розыгрыш открыт. Mini App доступен по ссылке Worker /app.");
    }

    if(cmd==="/closedraw") {
      await setSetting(env.DB,"draw_open","0");
      return say(env,chat,"Розыгрыш закрыт.");
    }

    if(cmd==="/pending") {
      const rows=await env.DB.prepare("SELECT telegram_id,display_name FROM participants WHERE status='pending' ORDER BY created_at").all();
      return say(env,chat,rows.results.length
        ? rows.results.map(x=>`${x.display_name} — ${x.telegram_id}`).join("\n")
        : "Нет заявок на подтверждение.");
    }

    if(cmd==="/approve") {
      const id=text.split(/\s+/)[1];
      if(!id) return say(env,chat,"Формат: /approve TELEGRAM_ID");

      const res=await env.DB.prepare("UPDATE participants SET status='approved' WHERE telegram_id=?").bind(id).run();

      if(!res.meta?.changes) return say(env,chat,"Участник не найден.");

      return say(env,chat,"Участник "+id+" допущен к розыгрышу.");
    }
  }

  return say(env,chat,"Команды: /start и /id"+(isAdmin(env,user.id)?" или /admin":""));
}


async function verifyInitData(initData, token) {
  if(!initData||!token) throw new Error("Открой приложение через Telegram.");
  const p=new URLSearchParams(initData), hash=p.get("hash"); if(!hash)throw new Error("Нет подписи Telegram."); p.delete("hash");
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const enc=new TextEncoder(); const k1=await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const secret=await crypto.subtle.sign("HMAC",k1,enc.encode(token)); const k2=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",k2,enc.encode(check)); const actual=[...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
  if(actual!==hash)throw new Error("Подпись Telegram не прошла проверку.");
  const auth=Number(p.get("auth_date")||0); if(!auth||Date.now()/1000-auth>86400)throw new Error("Сессия устарела. Закрой и снова открой приложение.");
  const user=JSON.parse(p.get("user")||"{}"); if(!user.id)throw new Error("Не найден Telegram ID."); return user;
}
async function getApiUser(req,env){const body=await req.json();const user=await verifyInitData(body.initData,env.TELEGRAM_BOT_TOKEN);return {body,user};}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/"&&request.method==="GET")return new Response("ALTER-EGO SECRET SANTA is running 🎅");
  if(url.pathname==="/app"&&request.method==="GET")return new Response(APP_HTML,{headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.pathname==="/telegram"&&request.method==="POST"){try{await botUpdate(env,await request.json());return new Response("ok");}catch(e){return new Response("bot error: "+e.message,{status:500});}}
  if(url.pathname==="/api/envelopes"&&request.method==="POST"){
   try{const {user}=await getApiUser(request,env);const p=await participant(env.DB,user.id);if(!p)throw new Error("Сначала нажми /start в боте при открытой регистрации.");if(p.status!=="approved")throw new Error("Заявка ещё не подтверждена администратором.");if(await setting(env.DB,"draw_open")!=="1")throw new Error("Розыгрыш пока закрыт.");
    const old=await env.DB.prepare("SELECT envelope_number,prize_title FROM envelopes WHERE claimed_by=?").bind(String(user.id)).first();if(old)return reply({claimed:old,envelopes:[],message:"У тебя уже есть конверт."});
    const rows=await env.DB.prepare("SELECT envelope_number FROM envelopes WHERE claimed_by IS NULL ORDER BY envelope_number").all();return reply({envelopes:rows.results.map(x=>x.envelope_number),message:"Выбери один закрытый конверт 💌"});
   }catch(e){return reply({error:e.message},400);}
  }
  if(url.pathname==="/api/claim"&&request.method==="POST"){
   try{const {body,user}=await getApiUser(request,env);const p=await participant(env.DB,user.id);if(!p)throw new Error("Сначала нажми /start в боте.");if(p.status!=="approved")throw new Error("Заявка ещё не подтверждена.");if(await setting(env.DB,"draw_open")!=="1")throw new Error("Розыгрыш пока закрыт.");
    const n=Number(body.envelope);if(!Number.isInteger(n)||n<1||n>30)throw new Error("Номер конверта некорректен.");
    const upd=await env.DB.prepare("UPDATE envelopes SET claimed_by=?,claimed_at=datetime('now') WHERE envelope_number=? AND claimed_by IS NULL AND NOT EXISTS(SELECT 1 FROM envelopes WHERE claimed_by=?)").bind(String(user.id),n,String(user.id)).run();
    if(!upd.meta?.changes){const old=await env.DB.prepare("SELECT envelope_number,prize_title FROM envelopes WHERE claimed_by=?").bind(String(user.id)).first();if(old)throw new Error(`Ты уже открыл(а) конверт №${old.envelope_number}: ${old.prize_title}`);throw new Error("Этот конверт уже забрали. Выбери другой.");}
    const won=await env.DB.prepare("SELECT prize_title,prize_value,prize_type FROM envelopes WHERE envelope_number=? AND claimed_by=?").bind(n,String(user.id)).first();return reply({envelope:n,...won});
   }catch(e){return reply({error:e.message},400);}
  }
  return new Response("Not found",{status:404});
 }
};
