
// ALTER-EGO SECRET SANTA — Cloudflare Worker
// Bindings:
// DB: D1 database alter_ego
// TELEGRAM_BOT_TOKEN: Worker Secret

const ADMIN_ID = "8998835017";
const APP_URL = "https://aescretsanta.meowmeow-didi1903.workers.dev/app";

const APP_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#120d1b">
<title>ALTER-EGO SECRET SANTA</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:28px 18px;color:#fff;text-align:center;font-family:system-ui;background:radial-gradient(ellipse at top,#49305e,#120d1b 68%)}
h1{letter-spacing:2px;font-size:25px;margin:8px 0}
.sub{color:#d2bfdf;margin-bottom:24px}
#status{min-height:28px;color:#eadcf5;margin:12px 0}
.panel{max-width:440px;margin:20px auto;padding:22px;border:1px solid #a17cba;border-radius:18px;background:#291d38}
input,textarea{width:100%;margin:8px 0;padding:14px;border:1px solid #a17cba;border-radius:10px;background:#160f20;color:white;font:inherit}
textarea{min-height:100px;resize:vertical}
button{border:1px solid #c5a0df;border-radius:12px;padding:13px 18px;background:linear-gradient(145deg,#65447c,#261a35);color:white;font:inherit}
button:disabled{opacity:.5}
.primary{width:100%;margin-top:12px;background:linear-gradient(145deg,#9164ad,#503467)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:440px;margin:auto}
.env{min-height:112px;font-size:30px}
.env small{display:block;font-size:11px;color:#eadcf5;margin-top:5px}
#result{display:none;margin:24px auto 0;max-width:440px;padding:22px;border:1px solid #c5a0df;border-radius:18px;background:#291d38}
#prize{display:block;color:#f4dcff;font-size:23px;margin-top:10px}
.hint{font-size:13px;color:#bcaacb;margin-top:22px}
</style>
</head>
<body>
<h1>ALTER-EGO</h1>
<div class="sub">SECRET SANTA 🎅</div>
<div id="status">Подключаемся…</div>

<section id="registration" class="panel" hidden>
  <h3>ЗАЯВКА НА УЧАСТИЕ 💌</h3>
  <input id="pubgId" placeholder="PUBG ID" inputmode="numeric">
  <input id="pubgNickname" placeholder="Никнейм в PUBG">
  <textarea id="wish" placeholder="Твоё новогоднее пожелание"></textarea>
  <button class="primary" id="submitRegistration">ОТПРАВИТЬ ЗАЯВКУ</button>
</section>

<section id="waiting" class="panel" hidden>
  <h3>ЗАЯВКА ОТПРАВЛЕНА 💌</h3>
  <p>Твоё письмо уже у администрации ALTER-EGO.</p>
  <strong>ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ</strong>
  <p>Мы сообщим тебе, когда заявка будет рассмотрена.</p>
</section>

<div class="grid" id="grid"></div>
<div id="result">ТВОЙ КОНВЕРТ 💌<strong id="prize"></strong></div>
<div class="hint">Один участник — один конверт. Выбор нельзя отменить.</div>

<script>
const tg=window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const statusEl=document.getElementById('status');
const registration=document.getElementById('registration');
const waiting=document.getElementById('waiting');
const grid=document.getElementById('grid');
const result=document.getElementById('result');
const prize=document.getElementById('prize');

async function api(path,extra={}) {
  const r=await fetch(path,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({initData:tg?.initData||'',...extra})
  });
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||'Ошибка');
  return d;
}

function hideSections() {
  registration.hidden=true;
  waiting.hidden=true;
  grid.innerHTML='';
  result.style.display='none';
}

async function startApp() {
  hideSections();
  try {
    const d=await api('/api/profile');

    if(!d.participant) {
      registration.hidden=false;
      statusEl.textContent='Заполни заявку на участие';
      return;
    }

    if(!d.complete) {
      document.getElementById('pubgId').value=d.participant.pubg_id||'';
      document.getElementById('pubgNickname').value=d.participant.pubg_nickname||'';
      document.getElementById('wish').value=d.participant.wish||'';
      registration.hidden=false;
      statusEl.textContent='Заполни данные для участия';
      return;
    }

    if(d.participant.status!=='approved') {
      waiting.hidden=false;
      statusEl.textContent='Заявка ожидает подтверждения';
      return;
    }

    statusEl.textContent='Заявка одобрена. Добро пожаловать!';
    await loadEnvelopes();
  } catch(e) {
    statusEl.textContent=e.message;
  }
}

document.getElementById('submitRegistration').onclick=async()=>{
  const pubg_id=document.getElementById('pubgId').value.trim();
  const pubg_nickname=document.getElementById('pubgNickname').value.trim();
  const wish=document.getElementById('wish').value.trim();

  if(!pubg_id||!pubg_nickname||!wish) {
    statusEl.textContent='Заполни все три поля.';
    return;
  }

  const button=document.getElementById('submitRegistration');
  button.disabled=true;
  statusEl.textContent='Отправляем заявку…';

  try {
    const d=await api('/api/register',{pubg_id,pubg_nickname,wish});
    hideSections();

    if(d.status==='approved') {
      statusEl.textContent='Данные сохранены. Ты уже допущен(а) к розыгрышу!';
      await loadEnvelopes();
    } else {
      waiting.hidden=false;
      statusEl.textContent='Заявка отправлена администрации ALTER-EGO.';
    }
  } catch(e) {
    statusEl.textContent=e.message;
  } finally {
    button.disabled=false;
  }
};

async function loadEnvelopes() {
  try {
    const d=await api('/api/envelopes');
    statusEl.textContent=d.message||'Выбери один закрытый конверт';

    if(d.claimed) {
      result.style.display='block';
      prize.textContent=d.claimed.prize_title;
      return;
    }

    grid.innerHTML='';
    d.envelopes.forEach(n=>{
      const b=document.createElement('button');
      b.className='env';
      b.innerHTML='✉️<small>КОНВЕРТ №'+n+'</small>';
      b.onclick=()=>claim(n);
      grid.appendChild(b);
    });
  } catch(e) {
    statusEl.textContent=e.message;
  }
}

let claiming=false;

async function claim(n) {
  if(claiming)return;
  if(!confirm('Выбрать конверт №'+n+'? Выбор будет окончательным.'))return;

  claiming=true;
  grid.querySelectorAll('button').forEach(b=>b.disabled=true);
  statusEl.textContent='Закрепляем конверт…';

  try {
    const d=await api('/api/claim',{envelope:n});
    grid.innerHTML='';
    result.style.display='block';
    prize.textContent=d.prize_title;
    statusEl.textContent='Твой конверт выбран ❤️';
    tg?.HapticFeedback?.notificationOccurred('success');
  } catch(e) {
    statusEl.textContent=e.message;
    await loadEnvelopes();
  } finally {
    claiming=false;
  }
}

startApp();
</script>
</body>
</html>`;

const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"content-type":"application/json; charset=utf-8"}
});

const isAdmin=(env,id)=>String(id)===ADMIN_ID;

async function tg(env,method,payload) {
  if(!env.TELEGRAM_BOT_TOKEN)throw new Error("Не задан TELEGRAM_BOT_TOKEN.");
  const r=await fetch(
    \`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/\${method}\`,
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    }
  );
  const d=await r.json();
  if(!d.ok)throw new Error(d.description||"Telegram API error");
  return d.result;
}

async function say(env,chatId,text,extra={}) {
  return tg(env,"sendMessage",{chat_id:chatId,text,...extra});
}

async function setting(db,key,fallback="0") {
  const r=await db.prepare(
    "SELECT setting_value FROM event_settings WHERE setting_key=?"
  ).bind(key).first();
  return r?.setting_value??fallback;
}

async function setSetting(db,key,value) {
  await db.prepare(
    "INSERT INTO event_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value"
  ).bind(key,String(value)).run();
}

async function participant(db,id) {
  return db.prepare(
    "SELECT * FROM participants WHERE telegram_id=?"
  ).bind(String(id)).first();
}

async function botUpdate(env,u) {
  const m=u.message;
  if(!m?.text)return;

  const chat=m.chat.id;
  const user=m.from;
  const text=m.text.trim();
  const cmd=text.split(/\s+/)[0].split("@")[0];

  if(cmd==="/start") {
    const open=await setting(env.DB,"registration_open","0");
    const p=await participant(env.DB,user.id);

    if(!p&&open!=="1") {
      return say(env,chat,
        "🎅 ALTER-EGO SECRET SANTA\nРегистрация пока закрыта. Следи за объявлениями клана."
      );
    }

    return say(env,chat,
      "🎅 ALTER-EGO SECRET SANTA\n\nОткрой приложение, чтобы заполнить заявку или посмотреть своё участие.",
      {
        reply_markup:{
          inline_keyboard:[[
            {text:"Открыть приложение 💌",web_app:{url:APP_URL}}
          ]]
        }
      }
    );
  }

  if(cmd==="/id") {
    return say(env,chat,"Твой Telegram ID: "+user.id);
  }

  if(cmd==="/admin") {
    if(!isAdmin(env,user.id))return say(env,chat,"Нет доступа.");

    const p=await env.DB.prepare("SELECT COUNT(*) n FROM participants").first();
    const pending=await env.DB.prepare("SELECT COUNT(*) n FROM participants WHERE status='pending'").first();
    const claimed=await env.DB.prepare("SELECT COUNT(*) n FROM envelopes WHERE claimed_by IS NOT NULL").first();

    return say(env,chat,\`🛠 ALTER-EGO ADMIN
Участников: \${p.n}
Ожидают подтверждения: \${pending.n}
Выбрано конвертов: \${claimed.n}
Регистрация: \${await setting(env.DB,"registration_open")}
Выбор конвертов: \${await setting(env.DB,"draw_open")}

Команды:
/approve TELEGRAM_ID
/openreg и /closereg
/opendraw и /closedraw
/pending\`);
  }

  if(["/openreg","/closereg","/opendraw","/closedraw","/pending","/approve"].includes(cmd)) {
    if(!isAdmin(env,user.id))return say(env,chat,"Нет доступа.");

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
      return say(env,chat,"Выбор конвертов открыт.");
    }

    if(cmd==="/closedraw") {
      await setSetting(env.DB,"draw_open","0");
      return say(env,chat,"Выбор конвертов закрыт.");
    }

    if(cmd==="/pending") {
      const rows=await env.DB.prepare(
        "SELECT telegram_id,display_name,pubg_id,pubg_nickname FROM participants WHERE status='pending' ORDER BY created_at"
      ).all();

      return say(env,chat,rows.results.length
        ?rows.results.map(x=>
          \`\${x.display_name} | \${x.pubg_nickname||"без ника"} | \${x.telegram_id}\`
        ).join("\\n")
        :"Нет заявок на подтверждение."
      );
    }

    if(cmd==="/approve") {
      const id=text.split(/\\s+/)[1];
      if(!id)return say(env,chat,"Формат: /approve TELEGRAM_ID");

      const res=await env.DB.prepare(
        "UPDATE participants SET status='approved' WHERE telegram_id=? AND status='pending'"
      ).bind(id).run();

      if(!res.meta?.changes)return say(env,chat,"Ожидающая заявка не найдена.");

      await say(env,chat,"Участник "+id+" допущен к розыгрышу.");

      try {
        await say(env,id,"🎉 ТЫ В ИГРЕ!\nТвоя заявка ALTER-EGO одобрена.");
      } catch(e) {}

      return;
    }
  }

  return say(env,chat,"Команды: /start и /id"+(isAdmin(env,user.id)?" или /admin":""));
}

async function verifyInitData(initData,token) {
  if(!initData||!token)throw new Error("Открой приложение через Telegram.");

  const p=new URLSearchParams(initData);
  const hash=p.get("hash");
  if(!hash)throw new Error("Нет подписи Telegram.");
  p.delete("hash");

  const check=[...p.entries()]
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>\`\${k}=\${v}\`)
    .join("\\n");

  const enc=new TextEncoder();
  const k1=await crypto.subtle.importKey(
    "raw",enc.encode("WebAppData"),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]
  );
  const secret=await crypto.subtle.sign("HMAC",k1,enc.encode(token));
  const k2=await crypto.subtle.importKey(
    "raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]
  );
  const sig=await crypto.subtle.sign("HMAC",k2,enc.encode(check));
  const actual=[...new Uint8Array(sig)]
    .map(b=>b.toString(16).padStart(2,"0")).join("");

  if(actual!==hash)throw new Error("Подпись Telegram не прошла проверку.");

  const auth=Number(p.get("auth_date")||0);
  if(!auth||Date.now()/1000-auth>86400) {
    throw new Error("Сессия устарела. Закрой и снова открой приложение.");
  }

  const user=JSON.parse(p.get("user")||"{}");
  if(!user.id)throw new Error("Не найден Telegram ID.");
  return user;
}

async function getApiUser(req,env) {
  const body=await req.json();
  const user=await verifyInitData(body.initData,env.TELEGRAM_BOT_TOKEN);
  return {body,user};
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);

    if(url.pathname==="/"&&request.method==="GET") {
      return new Response("ALTER-EGO SECRET SANTA is running 🎅");
    }

    if(url.pathname==="/app"&&request.method==="GET") {
      return new Response(APP_HTML,{
        headers:{"content-type":"text/html; charset=utf-8"}
      });
    }

    if(url.pathname==="/telegram"&&request.method==="POST") {
      try {
        await botUpdate(env,await request.json());
        return new Response("ok");
      } catch(e) {
        return new Response("bot error: "+e.message,{status:500});
      }
    }

    if(request.method==="POST"&&url.pathname==="/api/profile") {
      try {
        const {user}=await getApiUser(request,env);
        const p=await participant(env.DB,user.id);

        if(!p)return reply({participant:null,complete:false});

        const complete=Boolean(
          p.pubg_id&&p.pubg_nickname&&p.wish
        );

        return reply({participant:p,complete});
      } catch(e) {
        return reply({error:e.message},400);
      }
    }

    if(request.method==="POST"&&url.pathname==="/api/register") {
      try {
        const {body,user}=await getApiUser(request,env);

        const pubg_id=String(body.pubg_id||"").trim();
        const pubg_nickname=String(body.pubg_nickname||"").trim();
        const wish=String(body.wish||"").trim();

        if(!pubg_id||!pubg_nickname||!wish) {
          throw new Error("Заполни все три поля.");
        }

        if(pubg_id.length>30||pubg_nickname.length>50||wish.length>500) {
          throw new Error("Проверь длину заполненных полей.");
        }

        if(await setting(env.DB,"registration_open","0")!=="1") {
          throw new Error("Регистрация закрыта.");
        }

        const old=await participant(env.DB,user.id);

        if(old) {
          await env.DB.prepare(
            "UPDATE participants SET pubg_id=?,pubg_nickname=?,wish=? WHERE telegram_id=?"
          ).bind(pubg_id,pubg_nickname,wish,String(user.id)).run();

          return reply({
            ok:true,
            status:old.status,
            message:"Данные сохранены."
          });
        }

        const name=[user.first_name,user.last_name]
          .filter(Boolean).join(" ")||user.username||"Участник";

        await env.DB.prepare(
          "INSERT INTO participants(telegram_id,username,display_name,status,pubg_id,pubg_nickname,wish) VALUES(?,?,?,'pending',?,?,?)"
        ).bind(
          String(user.id),user.username||null,name,
          pubg_id,pubg_nickname,wish
        ).run();

        return reply({
          ok:true,
          status:"pending",
          message:"Заявка отправлена."
        });
      } catch(e) {
        return reply({error:e.message},400);
      }
    }

    if(request.method==="POST"&&url.pathname==="/api/envelopes") {
      try {
        const {user}=await getApiUser(request,env);
        const p=await participant(env.DB,user.id);

        if(!p)throw new Error("Сначала заполни заявку в приложении.");
        if(p.status!=="approved")throw new Error("Заявка ещё не подтверждена администратором.");
        if(await setting(env.DB,"draw_open")!=="1") {
          throw new Error("Выбор конвертов пока закрыт.");
        }

        const old=await env.DB.prepare(
          "SELECT envelope_number,prize_title FROM envelopes WHERE claimed_by=?"
        ).bind(String(user.id)).first();

        if(old)return reply({
          claimed:old,
          envelopes:[],
          message:"У тебя уже есть конверт."
        });

        const rows=await env.DB.prepare(
          "SELECT envelope_number FROM envelopes WHERE claimed_by IS NULL ORDER BY envelope_number"
        ).all();

        return reply({
          envelopes:rows.results.map(x=>x.envelope_number),
          message:"Выбери один закрытый конверт 💌"
        });
      } catch(e) {
        return reply({error:e.message},400);
      }
    }

    if(request.method==="POST"&&url.pathname==="/api/claim") {
      try {
        const {body,user}=await getApiUser(request,env);
        const p=await participant(env.DB,user.id);

        if(!p)throw new Error("Сначала заполни заявку.");
        if(p.status!=="approved")throw new Error("Заявка ещё не подтверждена.");
        if(await setting(env.DB,"draw_open")!=="1") {
          throw new Error("Выбор конвертов пока закрыт.");
        }

        const n=Number(body.envelope);
        if(!Number.isInteger(n)||n<1||n>30) {
          throw new Error("Номер конверта некорректен.");
        }

        const upd=await env.DB.prepare(
          "UPDATE envelopes SET claimed_by=?,claimed_at=datetime('now') WHERE envelope_number=? AND claimed_by IS NULL AND NOT EXISTS(SELECT 1 FROM envelopes WHERE claimed_by=?)"
        ).bind(String(user.id),n,String(user.id)).run();

        if(!upd.meta?.changes) {
          const old=await env.DB.prepare(
            "SELECT envelope_number,prize_title FROM envelopes WHERE claimed_by=?"
          ).bind(String(user.id)).first();

          if(old)throw new Error("Ты уже выбрал(а) конверт №"+old.envelope_number);
          throw new Error("Этот конверт уже заняли. Выбери другой.");
        }

        const won=await env.DB.prepare(
          "SELECT prize_title,prize_value,prize_type FROM envelopes WHERE envelope_number=? AND claimed_by=?"
        ).bind(n,String(user.id)).first();

        return reply({envelope:n,...won});
      } catch(e) {
        return reply({error:e.message},400);
      }
    }

    return new Response("Not found",{status:404});
  }
};
