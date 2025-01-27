const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ChannelType, ActivityType } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");

// Bot Ayarları
const TOKEN = "MTIyODgyNDQ5ODI2MzAzNTkzNA.Gsh5Ib.cURcS3Pe_K7vRn7wU4g0Etz-BJml6gXoAW5ADE";
const CLIENT_ID = "1228824498263035934";
const GUILD_ID = "1312106273868611664";

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Express sunucusu
const app = express();
app.get("/", (req, res) => res.send("Bot Aktif!"));
app.listen(3000, () => console.log("Web sunucusu çalışıyor!"));

// Slash komutları
const commands = [
  {
    name: "ekle",
    description: "📅 Belirtilen zamanda mesaj gönderir",
    options: [
      {
        name: "mesaj",
        description: "Gönderilecek mesaj içeriği",
        type: 3, // STRING
        required: true,
      },
      {
        name: "tarih",
        description: "GG.AA.YYYY formatında tarih",
        type: 3, // STRING
        required: true,
      },
      {
        name: "saat",
        description: "SS:DD formatında saat",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "listele",
    description: "📋 Zamanlanmış tüm mesajları gösterir",
  },
  {
    name: "log-kanal-ayarla",
    description: "🔧 Log kanalını ayarlar veya oluşturur",
  },
  {
    name: "log-kanal-kapat",
    description: "🔧 Log kanalını devre dışı bırakır",
  },
];

// Zamanlanmış mesajlar
let wipes = [];

// Log kanalı ID'si
let logChannelId = null;

// Bot hazır olduğunda
client.once("ready", async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı!`);

  // Botun aktivitesini "Rust izliyor" olarak ayarla
  client.user.setActivity("Ali eşşeği Rust ", { 
    type: ActivityType.Playing 
  });

  // Slash komutlarını kaydet
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Komutlar kaydediliyor...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { 
      body: commands 
    });
    console.log("Komutlar başarıyla kaydedildi!");
  } catch (error) {
    console.error("Komutlar kaydedilirken hata oluştu:", error);
  }
});

// Slash komutlarını işleme
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === "ekle") {
    const mesaj = options.getString("mesaj");
    const tarih = options.getString("tarih");
    const saat = options.getString("saat");

    // Tarih ve saat kontrolü (GMT+3)
    const wipeZaman = moment.tz(`${tarih} ${saat}`, "DD.MM.YYYY HH:mm", "Europe/Istanbul").toDate();

    if (isNaN(wipeZaman.getTime())) {
      return interaction.reply("❌ Geçersiz tarih veya saat formatı!");
    }

    // Mesajı kaydet
    wipes.push({ mesaj, zaman: wipeZaman });
    interaction.reply(`✅ Mesaj başarıyla ayarlandı: ${tarih} ${saat}`);

    // Log kanalına bilgi ver
    if (logChannelId) {
      const logChannel = client.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send(`Yeni zamanlanmış mesaj eklendi: "${mesaj}" - Zaman: ${wipeZaman.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`);
      }
    }

    // Mesajı zamanında göndermek için zamanlayıcı kur
    const zamanFarki = wipeZaman - Date.now();
    if (zamanFarki > 0) {
      setTimeout(async () => {
        const kanal = interaction.channel;
        if (kanal) {
          await kanal.send(mesaj);
          // Log kanalına bilgi ver
          if (logChannelId) {
            const logChannel = client.channels.cache.get(logChannelId);
            if (logChannel) {
              logChannel.send(`Zamanlanmış mesaj gönderildi: "${mesaj}"`);
            }
          }
        }
      }, zamanFarki);
    }
  }

  if (commandName === "listele") {
    if (wipes.length === 0) {
      return interaction.reply("❌ Zamanlanmış mesaj bulunmuyor.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Zamanlanmış Mesajlar")
      .setDescription(
        wipes
          .map(
            (w, i) =>
              `${i + 1}. Mesaj: "${w.mesaj}" - Zaman: ${w.zaman.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`
          )
          .join("\n")
      )
      .setColor("#00FF00");

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === "log-kanal-ayarla") {
    const guild = interaction.guild;
    if (guild) {
      const existingChannel = guild.channels.cache.find(ch => ch.name === "zamanlanmış-mesaj-log");
      if (existingChannel) {
        logChannelId = existingChannel.id;
        interaction.reply(`✅ Log kanalı zaten ayarlı: <#${logChannelId}>`);
      } else {
        const newChannel = await guild.channels.create({
          name: "zamanlanmış-mesaj-log",
          type: ChannelType.GuildText,
          reason: "Zamanlanmış mesajlar için log kanalı",
        });
        logChannelId = newChannel.id;
        interaction.reply(`✅ Log kanalı oluşturuldu: <#${logChannelId}>`);
      }
    }
  }

  if (commandName === "log-kanal-kapat") {
    if (logChannelId) {
      logChannelId = null;
      interaction.reply("✅ Log kanalı kapatıldı.");
    } else {
      interaction.reply("❌ Aktif bir log kanalı bulunmuyor.");
    }
  }
});

// Botu başlat
client.login(TOKEN);