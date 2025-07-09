const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require("fs");
const qrcode = require('qrcode-terminal'); // حط هذا السطر في أعلى الملف

const VERIFIED_FILE = './verified_groups.json';
const SETTINGS_FILE = './settings.json';
const RULES_FILE = './rules.json';
const GROUP_RULES_FILE = './groupRules.json';

function loadRules() {
  return loadJSON(RULES_FILE, {});
}

function saveRules(rules) {
  saveJSON(RULES_FILE, rules);
}
function loadGroupRules() {
  return loadJSON(GROUP_RULES_FILE, {});
}

function saveGroupRules(groupRules) {
  saveJSON(GROUP_RULES_FILE, groupRules);
}


const MUTES_FILE = './mutes.json';
const mutes = loadJSON(MUTES_FILE, {});

const removeSymbols = (text) => {
  return text.normalize("NFD")
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g, '') // Remove Arabic tashkeel
    .replace(/[^أ-يa-zA-Z0-9]/g, '') // Remove symbols
    .replace(/[إأآا]/g, 'ا') // Normalize Arabic letters
    .replace(/[ى]/g, 'ي') // Normalize final yeh
    .replace(/[ة]/g, 'ه') // Normalize taa marbouta
    .toLowerCase();
};

const path = require("path");
const filePath = path.join(__dirname, "verified_groups.json");

function loadVerifiedGroups() {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }
    return JSON.parse(fs.readFileSync(filePath));
}

function saveVerifiedGroups(groups) {
    fs.writeFileSync(filePath, JSON.stringify(groups, null, 2));
}


function loadJSON(path, fallback = {}) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path));
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

async function startBot() {
  console.log('🚀 بدء تشغيل البوت...');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
  
  });

  sock.ev.on('creds.update', saveCreds);

 sock.ev.on('connection.update', (update) => {
  if (update.qr) {
    // هنا يطبع كود QR في التيرمنال
    qrcode.generate(update.qr, { small: true });
  }

  if (update.connection === 'open') {
    console.log('✅ تم الاتصال بنجاح!');
  } else if (update.connection === 'close') {
    const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode;
    console.log('❌ تم فصل الاتصال. السبب:', reason);
    if (reason === DisconnectReason.loggedOut) {
      console.log('🛑 تم تسجيل الخروج نهائيًا. احذف مجلد auth_info وأعد التشغيل.');
    } else {
      console.log('🔁 إعادة الاتصال...');
      startBot();
    }
  }
});




  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

const rules = loadRules(); // أول مرّة فقط
const sender = m.key.remoteJid;
const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
const isGroup = sender.endsWith('@g.us');
const senderId = m.key.participant || m.key.remoteJid;
const isPrivate = !sender.endsWith('@g.us');

if (!rules[sender]) {
    rules[sender] = { bannedWords: [], bannedWarning: "", rules: "" };
}

const devNumbers = [
  "201040549167@s.whatsapp.net",
  "61488873681@s.whatsapp.net",
"201141615736@s.whatsapp.net"
];

const isDev = devNumbers.includes(sender);


const mutes = loadJSON('./mutes.json', {});
if (isPrivate && isDev && text.startsWith(".اضافه ")) {
    const groupId = text.split(" ")[1]?.trim();
    if (!groupId) return sock.sendMessage(sender, { text: "❌ يرجى وضع آيدي المجموعة بعد الأمر." });

    const reply = await sock.sendMessage(sender, { text: "⏳ جاري الإضافة..." });

    try {
        let groups = loadVerifiedGroups();
        if (!groups.includes(groupId)) {
            groups.push(groupId);
            saveVerifiedGroups(groups);
        }

        await sock.sendMessage(sender, {
            text: "✅ تمت الإضافة بنجاح!",
            edit: reply.key
        });
    } catch (e) {
        await sock.sendMessage(sender, {
            text: "❌ حدث خطأ أثناء الإضافة.",
            edit: reply.key
        });
    }
  }
  
  if (isPrivate && isDev && (text.startsWith(".ازالة ") || text.startsWith(".إزالة "))) {

    const groupId = text.split(" ")[1]?.trim();
    if (!groupId) return sock.sendMessage(sender, { text: "❌ يرجى وضع آيدي المجموعة بعد الأمر." });

    const reply = await sock.sendMessage(sender, { text: "⏳ جاري الإزالة..." });

    try {
        let groups = loadVerifiedGroups();
        if (groups.includes(groupId)) {
            groups = groups.filter(g => g !== groupId);
            saveVerifiedGroups(groups);

            await sock.sendMessage(sender, {
                text: "✅ تمت الإزالة بنجاح!",
                edit: reply.key
            });
        } else {
            await sock.sendMessage(sender, {
                text: "⚠️ هذا الآيدي غير موجود في القائمة.",
                edit: reply.key
            });
        }
    } catch (e) {
        await sock.sendMessage(sender, {
            text: "❌ حدث خطأ أثناء الإزالة.",
            edit: reply.key
        });
    }
}


if (isPrivate && isDev && text.trim() === ".معلومات") {
    const verified = loadVerifiedGroups();

    // رسالة أولية
    const reply = await sock.sendMessage(sender, { text: "⏳ جارٍ معرفة مجموعات البوت." });

    // حركة النقاط
    const loadingFrames = [
        "⏳ جارٍ معرفة مجموعات البوت.",
        "⏳ جارٍ معرفة مجموعات البوت..",
        "⏳ جارٍ معرفة مجموعات البوت..."
    ];

    // تحديث الرسالة كأنها بتتحرك
    for (let i = 0; i < 3; i++) {
        await new Promise(res => setTimeout(res, 500));
        await sock.sendMessage(sender, {
            text: loadingFrames[i % loadingFrames.length],
            edit: reply.key
        });
    }

    // بعد الانتهاء، نحصل على المجموعات الحالية
    const groupMetadata = await sock.groupFetchAllParticipating();
    const groupIds = Object.keys(groupMetadata);

    // تجهيز الرسالة النهائية
    let result = `📋 قائمة المجموعات:\n\n`;
    for (const id of groupIds) {
        const name = groupMetadata[id]?.subject || "مجموعة غير معروفة";
        const status = verified.includes(id) ? "✅ مفعل" : "❌ غير مفعل";
        result += `- ${name}\nآيدي: ${id}\nالحالة: ${status}\n\n`;
    }

    // تعديل الرسالة النهائية
    await sock.sendMessage(sender, {
        text: result.trim(),
        edit: reply.key
    });
}


else if (isPrivate && isDev && text.startsWith(".غادر ")) {
  const groupIds = text.split(" ").slice(1).map(gid => gid.trim()).filter(gid => gid.endsWith("@g.us"));

  if (groupIds.length === 0) {
    return sock.sendMessage(sender, { text: "❌ يرجى وضع آيدي أو آيديات المجموعات بعد الأمر." });
  }

  const reply = await sock.sendMessage(sender, { text: "🚪 جارٍ مغادرة المجموعات." });

  const loadingFrames = [
    "🚪 جارٍ مغادرة المجموعات.",
    "🚪 جارٍ مغادرة المجموعات..",
    "🚪 جارٍ مغادرة المجموعات..."
  ];

  for (let i = 0; i < 3; i++) {
    await new Promise(res => setTimeout(res, 500));
    await sock.sendMessage(sender, {
      text: loadingFrames[i % loadingFrames.length],
      edit: reply.key
    });
  }

  let result = `📤 النتائج:\n\n`;
  for (const gid of groupIds) {
    try {
      await sock.groupLeave(gid);
      result += `- ✅ تم مغادرة المجموعة: ${gid}\n`;
    } catch (err) {
      result += `- ❌ فشل مغادرة المجموعة: ${gid} (${err.message})\n`;
    }
  }

  await sock.sendMessage(sender, {
    text: result.trim(),
    edit: reply.key
  });
}


else if (isPrivate && isDev && text.startsWith(".انضم ")) {
  const inviteLink = text.split(" ")[1]?.trim();

  if (!inviteLink || !inviteLink.includes("chat.whatsapp.com")) {
    return sock.sendMessage(sender, { text: "❌ يرجى إرسال رابط مجموعة صحيح بعد الأمر." });
  }

  const inviteCode = inviteLink.split("chat.whatsapp.com/")[1]?.split(" ")[0];
  if (!inviteCode) {
    return sock.sendMessage(sender, { text: "❌ رابط غير صالح." });
  }

  const reply = await sock.sendMessage(sender, { text: "🔗 جارٍ الانضمام..." });

  const loadingFrames = [
    "🔗 جارٍ الانضمام.",
    "🔗 جارٍ الانضمام..",
    "🔗 جارٍ الانضمام..."
  ];

  for (let i = 0; i < 3; i++) {
    await new Promise(res => setTimeout(res, 500));
    await sock.sendMessage(sender, {
      text: loadingFrames[i % loadingFrames.length],
      edit: reply.key
    });
  }

  try {
    const res = await sock.groupAcceptInvite(inviteCode);
    await sock.sendMessage(sender, {
      text: `✅ تم الانضمام للمجموعة!\nآيدي: ${res}`,
      edit: reply.key
    });
  } catch (err) {
    await sock.sendMessage(sender, {
      text: `❌ فشل الانضمام: ${err.message}`,
      edit: reply.key
    });
  }
}


if (isPrivate && isDev && text.startsWith(".اوامر")) {
    const msg = `
🛠️ أوامر المطور:

1. .اضافه [آيدي المجموعة]
↳ لإضافة مجموعة إلى قائمة المجموعات المفعلة

2. .إزالة / .ازالة [آيدي المجموعة]
↳ لإزالة مجموعة من القائمة

3. .معلومات
↳ لعرض آيديات المجموعات التي البوت موجود فيها، وهل مفعل أم لا

4. .غادر [آيدي المجموعة1] [آيدي المجموعة2] ...
↳ لمغادرة مجموعة أو أكثر

5. .انضم [رابط الدعوة]
↳ للانضمام لمجموعة بالرابط

6. .اوامر
↳ لعرض هذه القائمة

📌 جميع الأوامر تُستخدم في الخاص فقط، ومخصصة للمطورين المعتمدين.
    `.trim();

    await sock.sendMessage(sender, { text: msg });
}






// 🟥 حذف أي رسالة من عضو مكتوم (بغض النظر عن نوعها)
if (isGroup && mutes[sender] && mutes[sender].includes(senderId)) {
  try {
    await sock.sendMessage(sender, {
      delete: {
        remoteJid: sender,
        fromMe: false,
        id: m.key.id,
        participant: senderId
      }
    });
  } catch (err) {
    console.error("فشل حذف رسالة عضو مكتوم:", err.message);
  }
  return;
}

if (isGroup && rules[sender]?.bannedWords?.length > 0) {
  const banned = rules[sender].bannedWords;
  const msgText = removeSymbols(text);

  // احصل على معلومات المجموعة والمشرفين
  const metadata = await sock.groupMetadata(sender);
  const admins = metadata.participants
    .filter(p => p.admin !== null)
    .map(p => p.id);

  // المرسل
  const msgSender = m.key.participant || sender;

  for (let word of banned) {
    const regex = new RegExp(word, 'i');
    if (regex.test(msgText)) {
      // فقط احذف لو المرسل مش مشرف
      if (!admins.includes(msgSender)) {
        try {
          await sock.sendMessage(sender, { text: rules[sender].bannedWarning || "⚠️ ممنوع استخدام كلمات محظورة." }, { quoted: m });
          await sock.sendMessage(sender, { delete: m.key });
        } catch (e) {
          console.error("⚠️ خطأ في حذف الرسالة:", e);
        }
      }
      break;
    }
  }
}






    const verifiedGroups = loadJSON(VERIFIED_FILE, []);
    const settings = loadJSON(SETTINGS_FILE, { groups: {} });

    if (!isGroup) return;

    try {
      const metadata = await sock.groupMetadata(sender);
      const participants = metadata.participants;

    const botBaseJid = sock.user?.id.split(":")[0] + "@s.whatsapp.net";
const botIsAdmin = participants.some(p => p.id?.split(":")[0] + "@s.whatsapp.net" === botBaseJid && p.admin);

const senderIsAdmin = participants.some(p => p.id === senderId && p.admin);







      const adminOnlyCommands = [".طرد", ".كتم", ".فك كتم", ".تحقق",".حذف التحقق", ".تشغيل",".اوامر", ".وقف 1", ".تشغيل 1", ".وقف 2", ".تشغيل 2", ".الحذف للكل", ".الحذف للاعضاء"];
if (text.startsWith('.') && adminOnlyCommands.includes(text.split(' ')[0]) && !senderIsAdmin) {
  return; // يمنع تنفيذ أوامر المشرف إذا المرسل ليس مشرف
}


      const groupSettings = settings.groups[sender] || {
        linksBlocked: true,
        stickersBlocked: true,
        deleteTarget: 'all'
      };



      // ========== الأوامر ==========


            if (text === ".id") {
        await sock.sendMessage(sender, {
          text: `🆔 معرف المجموعة:\n${sender}`
        });
        return;
      }
      
if (!verifiedGroups.includes(sender)) {
  if (text.startsWith(".كود ")) {
    const code = text.trim().split(" ")[1];
    if (code === "SANJI-GG-BOT") {
      verifiedGroups.push(sender);
      saveJSON(VERIFIED_FILE, verifiedGroups);
      await sock.sendMessage(sender, {
        text: "✅ تم التحقق بنجاح باستخدام الكود. يمكنك الآن استخدام أوامر البوت."
      });
    } else {
      await sock.sendMessage(sender, {
        text: "❌ الكود غير صحيح. الرجاء إدخال الكود الصحيح لتفعيل البوت."
      });
    }
    return;
  } else if (text.startsWith(".")) {
    await sock.sendMessage(sender, {
      text: "🔐 هذه المجموعة غير مفعّلة بعد.\nيرجى إدخال الكود باستخدام الأمر التالي:\n\n.كود SANJI"
    });
    return;
  } else {
    return; // تجاهل أي رسائل عادية بدون أمر.
  }
}

const botReplies = [
  "نعم",
  "وش بدك؟",
  "متوفر",
  "أهلاً! كيف أقدر أساعدك؟",
  "أنا هنا دايمًا",
  "تفضل، وش عندك؟"
];

if (text === ".بوت") {
  const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];
  await sock.sendMessage(sender, { text: randomReply });
}


      if (text === ".id") {
        await sock.sendMessage(sender, {
          text: `🆔 معرف المجموعة:\n${sender}`
        });
        return;
      }


      if (text === ".تحقق") {
        try {
          await sock.sendMessage(sender, {
            delete: {
              remoteJid: sender,
              fromMe: false,
              id: m.key.id,
              participant: senderId
            }
          });

          if (!verifiedGroups.includes(sender)) {
            verifiedGroups.push(sender);
            saveJSON(VERIFIED_FILE, verifiedGroups);
          }

          settings.groups[sender] = groupSettings;
          saveJSON(SETTINGS_FILE, settings);

          await sock.sendMessage(sender, {
            text: "✅ تم التحقق. لدي صلاحيات مشرف وتم حفظ المجموعة.\n🔗 سيتم حذف الروابط والملصقات تلقائيًا.\nاكتب .اوامر لعرض الإعدادات."
          });
        } catch {
          await sock.sendMessage(sender, { text: "❌ لا يمكن حذف الرسائل. يبدو أنني لست مشرفًا." });
        }
        return;
      }

      if (text === ".تشغيل") {
        if (!verifiedGroups.includes(sender)) {
          await sock.sendMessage(sender, { text: "⚠️ للتحقق من أنني مشرف، أرسل .تحقق" });
          return;
        }
        await sock.sendMessage(sender, {
          text: "✅ تم تشغيل البوت بنجاح!\n🔗 سيتم حذف الروابط\n🖼️ سيتم حذف الملصقات\n✏️ لحذف الكل: .الحذف للكل\n✏️ لحذف الأعضاء فقط: .الحذف للاعضاء\n📜 لعرض الإعدادات: .اوامر"
        });
        return;
      }

      if (text === ".حذف التحقق") {
        const index = verifiedGroups.indexOf(sender);
        if (index !== -1) {
          verifiedGroups.splice(index, 1);
          saveJSON(VERIFIED_FILE, verifiedGroups);
          delete settings.groups[sender];
          saveJSON(SETTINGS_FILE, settings);
          await sock.sendMessage(sender, { text: "🗑️ تم حذف تحقق المجموعة." });
        } else {
          await sock.sendMessage(sender, { text: "ℹ️ هذه المجموعة غير مسجلة." });
        }
      }


      // 🧠 دالة التحقق إذا المستخدم مشرف
function isAdmin(userId, participants) {
  const p = participants.find(p => p.id === userId);
  return p?.admin || false;
}

// 🟨 تحميل ملف الكتم
const MUTE_FILE = './mutes.json';
let mutes = loadJSON(MUTE_FILE, {});

// 🟩 حذف رسالة العضو المكتوم تلقائياً
if (isGroup && mutes[sender] && mutes[sender].includes(senderId)) {
  await sock.sendMessage(sender, {
    delete: {
      remoteJid: sender,
      fromMe: false,
      id: m.key.id,
      participant: senderId
    }
  });
  return;
}

// ✅ أمر الكتم
if (text.startsWith(".كتم")) {
  if (!senderIsAdmin) {
    await sock.sendMessage(sender, { text: "❌ ليس لديك صلاحية. هذا الأمر للمشرفين فقط." });
    return;
  }

  let target;
  if (m.message?.extendedTextMessage?.contextInfo?.participant) {
    target = m.message.extendedTextMessage.contextInfo.participant;
  } else {
    const number = text.split(" ")[1]?.replace(/[^0-9]/g, "");
    if (number) {
      target = number + "@s.whatsapp.net";
    }
  }

  if (!target) {
    await sock.sendMessage(sender, { text: "⚠️ استخدم الأمر عبر الرد على رسالة العضو أو كتابة رقمه:\nمثال: .كتم 201234567890" });
    return;
  }

  if (isAdmin(target, participants)) {
    await sock.sendMessage(sender, { text: "❌ لا يمكن كتم المشرفين." });
    return;
  }

  if (target === "201040549167@s.whatsapp.net") {
    await sock.sendMessage(sender, { text: "❌ لا يمكن كتم المطور." });
    return;
  }

  if (target === "48699551915@s.whatsapp.net") {
    await sock.sendMessage(sender, { text: "❌ لا يمكن كتم البوت 😒" });
    return;
  }

  if (!mutes[sender]) mutes[sender] = [];
  if (!mutes[sender].includes(target)) {
    mutes[sender].push(target);
    saveJSON(MUTE_FILE, mutes);
    await sock.sendMessage(sender, { text: "🔇 تم كتم العضو بنجاح، وسيتم حذف جميع رسائله." });
  } else {
    await sock.sendMessage(sender, { text: "ℹ️ هذا العضو مكتوم بالفعل." });
  }
  return;
}

// ✅ أمر فك الكتم
if (text.startsWith(".فك كتم")) {
  if (!senderIsAdmin) {
    await sock.sendMessage(sender, { text: "❌ ليس لديك صلاحية. هذا الأمر للمشرفين فقط." });
    return;
  }

  let target;
  if (m.message?.extendedTextMessage?.contextInfo?.participant) {
    target = m.message.extendedTextMessage.contextInfo.participant;
  } else {
    const number = text.split(" ")[2]?.replace(/[^0-9]/g, "");
    if (number) {
      target = number + "@s.whatsapp.net";
    }
  }

  if (!target || !mutes[sender]?.includes(target)) {
    await sock.sendMessage(sender, { text: "ℹ️ هذا العضو غير مكتوم." });
    return;
  }

  mutes[sender] = mutes[sender].filter(id => id !== target);
  saveJSON(MUTE_FILE, mutes);
  await sock.sendMessage(sender, { text: "✅ تم فك الكتم عن العضو." });
  return;
}



      if (text.startsWith(".طرد")) {
        if (!senderIsAdmin) {
          await sock.sendMessage(sender, { text: "❌ لا يمكنك استخدام هذا الأمر، أنت لست مشرفًا." });
          return;
        }

        const args = text.trim().split(" ");
        let targetJid;

        if (m.message?.extendedTextMessage?.contextInfo?.participant) {
          // رد على رسالة عضو
          targetJid = m.message.extendedTextMessage.contextInfo.participant;
        } else if (args.length === 2) {
          // باستخدام رقم
          const rawNum = args[1].replace(/[^0-9]/g, '');
          targetJid = rawNum + "@s.whatsapp.net";
        } else {
          await sock.sendMessage(sender, { text: "❌ استخدم: .طرد [رقم] أو بالرد على رسالة العضو." });
          return;
        }

        const isTargetAdmin = participants.some(p => p.id === targetJid && p.admin);
        const isDev = targetJid === "201040549167@s.whatsapp.net";
        const isBot = targetJid === "48699551915@s.whatsapp.net";

        if (isTargetAdmin) {
          await sock.sendMessage(sender, { text: "❌ لا يمكن طرد المشرفين." });
          return;
        }

        if (isDev) {
          await sock.sendMessage(sender, { text: "❌ لا يمكن طرد المطور." });
          return;
        }

        if (isBot) {
          await sock.sendMessage(sender, { text: "❌ لا يمكن طرد البوت يا غبي 😂." });
          return;
        }

        try {
          await sock.groupParticipantsUpdate(sender, [targetJid], "remove");
          await sock.sendMessage(sender, { text: "✅ تم طرد العضو بنجاح." });
        } catch {
          await sock.sendMessage(sender, { text: "❌ لم أستطع طرده، يبدو أنني لست مشرفًا." });
        }

        return;
      }



      if (text === ".وقف 1") {
        groupSettings.linksBlocked = false;
        settings.groups[sender] = groupSettings;
        saveJSON(SETTINGS_FILE, settings);
        await sock.sendMessage(sender, { text: "✅ تم إيقاف حذف الروابط." });
        return;
      }

      if (text === ".تشغيل 1") {
        if (groupSettings.linksBlocked) {
          await sock.sendMessage(sender, { text: "ℹ️ حذف الروابط مفعل بالفعل." });
        } else {
          groupSettings.linksBlocked = true;
          settings.groups[sender] = groupSettings;
          saveJSON(SETTINGS_FILE, settings);
          await sock.sendMessage(sender, { text: "✅ تم تفعيل حذف الروابط." });
        }
        return;
      }

      if (text === ".وقف 2") {
        groupSettings.stickersBlocked = false;
        settings.groups[sender] = groupSettings;
        saveJSON(SETTINGS_FILE, settings);
        await sock.sendMessage(sender, { text: "✅ تم إيقاف حذف الملصقات." });
        return;
      }

      if (text === ".تشغيل 2") {
        if (groupSettings.stickersBlocked) {
          await sock.sendMessage(sender, { text: "ℹ️ حذف الملصقات مفعل بالفعل." });
        } else {
          groupSettings.stickersBlocked = true;
          settings.groups[sender] = groupSettings;
          saveJSON(SETTINGS_FILE, settings);
          await sock.sendMessage(sender, { text: "✅ تم تفعيل حذف الملصقات." });
        }
        return;
      }

      if (text === ".الحذف للكل") {
        groupSettings.deleteTarget = 'all';
        settings.groups[sender] = groupSettings;
        saveJSON(SETTINGS_FILE, settings);
        await sock.sendMessage(sender, { text: "🧹 سيتم الآن حذف رسائل الجميع (مشرفين وأعضاء)." });
        return;
      }

      if (text === ".الحذف للاعضاء") {
        groupSettings.deleteTarget = 'members';
        settings.groups[sender] = groupSettings;
        saveJSON(SETTINGS_FILE, settings);
        await sock.sendMessage(sender, { text: "🧹 سيتم الآن حذف رسائل الأعضاء فقط وترك المشرفين." });
        return;
      }



// أمر إعداد الكلمات المحظورة
if ([".الكلمات المحظورة", ".الكلمات المحظوره"].includes(text.trim()) && isGroup) {
  const metadata = await sock.groupMetadata(sender);
  const isAdmin = metadata.participants.find(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
  if (!isAdmin) return sock.sendMessage(sender, { text: "❌ هذا الأمر للمشرفين فقط." });

  global.awaitingBannedWords = global.awaitingBannedWords || {};
  global.awaitingBannedWords[senderId] = sender;

  return sock.sendMessage(sender, {
    text: "🔒 رد على هذه الرسالة بما تريد تعيينه ككلمات محظورة، مفصولة بفواصل `,`\n⚠️ سيتم حذفها تلقائيًا عند كتابتها في المجموعة."
  }, { quoted: m });
}

// استقبال الكلمات المحظورة
if (global.awaitingBannedWords?.[senderId] && isGroup && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
  const groupId = global.awaitingBannedWords[senderId];
  delete global.awaitingBannedWords[senderId];

  const words = text.split(',').map(w => removeSymbols(w.trim())).filter(Boolean);
  rules[groupId].bannedWords = words;
  saveRules(rules);

  global.awaitingBannedWarning = global.awaitingBannedWarning || {};
  global.awaitingBannedWarning[senderId] = groupId;

  return sock.sendMessage(sender, {
    text: "📝 تم حفظ الكلمات.\nرد على هذه الرسالة بما تريد تعيينه كرسالة تحذير لمن يكتب الكلمات المحظورة."
  });
}

// استقبال رسالة التحذير
if (global.awaitingBannedWarning?.[senderId] && isGroup && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
  const groupId = global.awaitingBannedWarning[senderId];
  delete global.awaitingBannedWarning[senderId];

  rules[groupId].bannedWarning = text.trim();
  saveRules(rules);

  return sock.sendMessage(sender, { text: "✅ تم حفظ الكلمات المحظورة ورسالة التحذير بنجاح." });
}




// تعديل القوانين
if (text.trim() === ".تعديل القوانين" && isGroup) {
  const metadata = await sock.groupMetadata(sender);
  const isAdmin = metadata.participants.find(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

  if (!isAdmin) {
    return sock.sendMessage(sender, { text: "❌ هذا الأمر للمشرفين فقط." });
  }

  if (!global.awaitingRules) global.awaitingRules = {};
  global.awaitingRules[senderId] = sender;

  await sock.sendMessage(sender, {
    text: "🔧 رد على هذه الرسالة بما تريد تعيينه كقوانين."
  }, { quoted: m });

  return;
}

// استقبال رد تعديل القوانين
if (global.awaitingRules && global.awaitingRules[senderId] && isGroup && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
  const groupId = global.awaitingRules[senderId];
  delete global.awaitingRules[senderId];

  const content = text.trim();
  if (!content) {
    return sock.sendMessage(sender, { text: "⚠️ لم يتم العثور على محتوى لتعيينه كقوانين." });
  }

  // تحميل القوانين الحالية وحفظ الجديدة
  const groupRules = loadGroupRules();
  groupRules[groupId] = content;
  saveGroupRules(groupRules);

  return sock.sendMessage(sender, { text: "✅ تم تحديث القوانين بنجاح." });
}

// عرض القوانين
if (text.trim() === ".قوانين" && isGroup) {
  const groupRules = loadGroupRules();
  const bannedData = loadRules();

  const groupRuleText = groupRules[sender] || "⚠️ لم يتم تعيين قوانين.";
  const bannedWords = bannedData[sender]?.bannedWords || [];

  let message = "📜 قوانين المجموعة:\n\n" + groupRuleText;

  if (bannedWords.length > 0) {
    message += `\n\n🚫 الكلمات المحظورة:\n${bannedWords.join(", ")}`;
  }

  await sock.sendMessage(sender, { text: message });
  return;
}




      if (text === ".اوامر") {
        const msg = `⚙️ إعدادات المجموعة:

🔗 حذف الروابط: ${groupSettings.linksBlocked ? "مفعل" : "موقف"}
🖼️ حذف الملصقات: ${groupSettings.stickersBlocked ? "مفعل" : "موقف"}
👥 من يُحذف له: ${groupSettings.deleteTarget === 'all' ? "الكل" : "الأعضاء فقط"}

✏️ للتحكم:
.تشغيل 1 / .وقف 1 - الروابط
.تشغيل 2 / .وقف 2 - الملصقات
.الحذف للكل / .الحذف للاعضاء
.طرد لطرد عضو عبر الرد على رسالته او عبر .طرد ثم رقمه `;

        await sock.sendMessage(sender, { text: msg });
        return;
      }

      settings.groups[sender] = groupSettings;
      saveJSON(SETTINGS_FILE, settings);

      // ========== الحذف التلقائي ==========
      if (!verifiedGroups.includes(sender)) return;

      const isSticker = m.message?.stickerMessage;
      const isLink = /(https?:\/\/[^\s]+)/.test(text);

      const senderInfo = participants.find(p => p.id === senderId);
      const isAdminSender = senderInfo?.admin;

      const shouldDelete = groupSettings.deleteTarget === 'all' || (!isAdminSender && groupSettings.deleteTarget === 'members');

      if (shouldDelete && groupSettings.linksBlocked && isLink) {
        await sock.sendMessage(sender, {
          delete: {
            remoteJid: sender,
            fromMe: false,
            id: m.key.id,
            participant: senderId
          }
        });
        return;
      }
      if (shouldDelete && groupSettings.stickersBlocked && isSticker) {
        await sock.sendMessage(sender, {
          delete: {
            remoteJid: sender,
            fromMe: false,
            id: m.key.id,
            participant: senderId
          }
        });
      }

    } catch (err) {
      console.error("❌ خطأ أثناء المعالجة:", err);
    }
  });
}

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('SanjiBot is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

startBot();
