'use strict';
// Minimal dependency-free prototype. Use HTTPS in production and persistent storage.
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = (process.env.BOT_USERNAME || '').replace(/^@/, '');
const APP_ORIGIN = process.env.APP_ORIGIN || '*';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.json');
if (!BOT_TOKEN || !BOT_USERNAME) { console.error('Set BOT_TOKEN and BOT_USERNAME'); process.exit(1); }
let db = { challenges: {}, users: {}, updates: 0 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch {}
function save(){ const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const json = (res, code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8','access-control-allow-origin':APP_ORIGIN,'access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(obj)); };
function phoneNorm(s){ return String(s||'').replace(/[\s()-]/g,''); }
async function tg(method, body={}) { const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const j=await r.json(); if(!j.ok) throw new Error(j.description||'Telegram API error'); return j.result; }
async function handleUpdate(u){
  db.updates = Math.max(db.updates, u.update_id || 0);
  const m=u.message; if(!m) return;
  const chatId=m.chat.id; const text=m.text||'';
  if(text.startsWith('/start ')){
    const id=text.slice(7).trim(); const c=db.challenges[id];
    if(!c || c.expires<Date.now()){ await tg('sendMessage',{chat_id:chatId,text:'Ссылка устарела. Вернитесь в SkautGram и запросите новую.'}); return; }
    c.chatId=chatId; c.telegramUserId=m.from.id; c.stage='await_contact'; save();
    await tg('sendMessage',{chat_id:chatId,text:'Чтобы получить код SkautGram, подтвердите номер кнопкой ниже. Мы сверим его с номером, указанным в приложении.',reply_markup:{keyboard:[[{text:'📱 Поделиться моим номером',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}}); return;
  }
  if(m.contact){
    const c=Object.values(db.challenges).find(x=>x.chatId===chatId && x.stage==='await_contact');
    if(!c){ await tg('sendMessage',{chat_id:chatId,text:'Сначала откройте ссылку привязки из приложения SkautGram.'}); return; }
    if(m.contact.user_id !== m.from.id){ await tg('sendMessage',{chat_id:chatId,text:'Пожалуйста, отправьте именно свой контакт через кнопку.'}); return; }
    if(phoneNorm(m.contact.phone_number)!==c.phone){ await tg('sendMessage',{chat_id:chatId,text:'Номер не совпадает с указанным в SkautGram. Вернитесь в приложение и проверьте номер.'}); return; }
    const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'); c.codeHash=hash(code+idSalt(c.id)); c.stage='code_sent'; c.codeExpires=Date.now()+5*60*1000; c.attempts=0; save();
    await tg('sendMessage',{chat_id:chatId,text:`Ваш код SkautGram: ${code}\nДействует 5 минут. Никому его не сообщайте.`,reply_markup:{remove_keyboard:true}}); return;
  }
  if(text==='/start') await tg('sendMessage',{chat_id:chatId,text:'Откройте SkautGram, введите номер и нажмите «Получить код». Бот выдаст код после подтверждения контакта.'});
}
function idSalt(id){ return `${id}:${process.env.CODE_PEPPER||'CHANGE_THIS_PEPPER'}`; }
async function poll(){ try { const updates=await tg('getUpdates',{offset:db.updates+1,timeout:20,allowed_updates:['message']}); for(const u of updates){ try{await handleUpdate(u)}catch(e){console.error('update:',e.message)} db.updates=Math.max(db.updates,u.update_id); save(); } } catch(e){ console.error('poll:',e.message); await new Promise(r=>setTimeout(r,3000)); } setImmediate(poll); }
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS') return json(res,204,{});
 let body=''; for await(const chunk of req) body+=chunk; let data={}; try{data=body?JSON.parse(body):{}}catch{return json(res,400,{error:'Некорректный JSON'});}
 if(req.method==='GET'&&req.url==='/health') return json(res,200,{ok:true,service:'SkautGram auth'});
 if(req.method==='POST'&&req.url==='/api/auth/start'){
  const phone=phoneNorm(data.phone); if(!/^\+?[1-9]\d{7,14}$/.test(phone)) return json(res,400,{error:'Введите номер в международном формате, например +4915112345678'});
  const id=crypto.randomBytes(18).toString('hex'); db.challenges[id]={id,phone,stage:'waiting_bot',expires:Date.now()+10*60*1000}; save();
  return json(res,200,{challengeId:id,botUrl:`https://t.me/${BOT_USERNAME}?start=${id}`,expiresIn:600,message:'Откройте бота и поделитесь своим номером телефона.'});
 }
 if(req.method==='POST'&&req.url==='/api/auth/verify'){
  const c=db.challenges[String(data.challengeId||'')]; if(!c||c.expires<Date.now()) return json(res,400,{error:'Запрос истёк. Начните заново.'});
  if(c.stage!=='code_sent') return json(res,409,{error:'Сначала подтвердите номер у бота.'});
  if(c.codeExpires<Date.now()||++c.attempts>5){save();return json(res,429,{error:'Код истёк или превышено число попыток.'});}
  if(hash(String(data.code||'')+idSalt(c.id))!==c.codeHash){save();return json(res,400,{error:'Неверный код.'});}
  c.stage='verified'; c.verifiedAt=Date.now(); const account={id:crypto.randomUUID(),phone:c.phone,telegramUserId:c.telegramUserId,createdAt:Date.now()}; db.users[account.id]=account; delete c.codeHash; save();
  return json(res,200,{ok:true,accountId:account.id,message:'Номер подтверждён. Это только проверка входа; профиль SkautGram создаётся отдельно.'});
 }
 return json(res,404,{error:'Not found'});
});
server.listen(PORT,()=>console.log(`SkautGram auth listening on ${PORT}`));
poll();
