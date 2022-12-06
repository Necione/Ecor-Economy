// Packages
const fs = require("fs");
const rn = require("random-number");
const CronJob = require("cron").CronJob;
const {
  Client,
  Intents,
  MessageEmbed
} = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_PRESENCES,
  ],
});

// Config
const cronTimezone = "America/Los_Angeles";
const {
  token,
  economy,
  prefix,
  adminRole,
  images,
  images2,
  status
} = require("./data/config.json");
const config = require("./data/config.json");
let chatters = []; // holds the IDs of people sending messages
let rewarded = []; // hold IDs of people who have recieved coins for that minute
let lastEvent = 999; // unix date of when the last event took place

// Functions
function get(id) {
  if (fs.existsSync(`./data/users/${id}.json`)) {
    return JSON.parse(fs.readFileSync(`./data/users/${id}.json`));
  } else {
    return {
      id: id,
      balance: 0,
      messagesSent: 0,
      special: 0,
    };
  }
}
function set(id, data) {
  fs.writeFileSync(`./data/users/${id}.json`, JSON.stringify(data, null, 4));
}
function lb(id) {
  files = fs.readdirSync(`./data/users/`).filter((t) => t.endsWith(".json"));
  unsorted = [];
  for (let i in files) {
    file = JSON.parse(fs.readFileSync(`./data/users/${files[i]}`));
    unsorted.push({
      id: files[i].split(".")[0],
      balance: file.balance,
      messagesSent: file.messagesSent,
      special: file.special,
      staffCredits: file.staffCredits == null ? 0 : file.staffCredits,
    });
  }

  bal = unsorted
    .sort((a, b) => (a.balance < b.balance ? 1 : -1))
    .map((t) => t.id);
  msgSent = unsorted
    .sort((a, b) => (a.messagesSent < b.messagesSent ? 1 : -1))
    .map((t) => t.id);
  spec = unsorted
    .sort((a, b) => (a.special < b.special ? 1 : -1))
    .map((t) => t.id);
  rating = unsorted
    .sort((a, b) => (a.staffCredits > b.staffCredits ? 1 : -1))
    .map((t) => t.id)
    .reverse();

  return [
    bal.indexOf(id) + 1,
    msgSent.indexOf(id) + 1,
    spec.indexOf(id) + 1,
    rating.indexOf(id) == null ? null : rating.indexOf(id) + 1,
  ];
}
function isLocked(id) {
  st = JSON.parse(fs.readFileSync(`./data/locked.json`)).includes(id)
    ? true
    : false;
  return st;
}

// Listeners
client.on("ready", () => {
  // log
  console.log(`--> Bot online`);

  // load slash commands
  require('./data/slash').run(client);

  // status
  client.user.setPresence({
    activities: [{ name: status.message, type: status.type }],
    status: "idle",
  });

  // reset rewarded array every minute
  let job = new CronJob(
    "1 * * * * *",
    function () {
      rewarded = [];
    },
    null,
    true,
    cronTimezone
  );
  job.start();

  // reset quests at midnight
  let job1 = new CronJob(
    "1 0 0 * * *",
    function () {
      files = fs.readdirSync(`./data/quests/`);
      files.forEach((file) => fs.unlinkSync(`./data/quests/${file}`));
    },
    null,
    true,
    cronTimezone
  );
  job1.start();
});
client.on("interactionCreate", async interaction => {
  
  // commands
  if(interaction.commandName == 'pay') {

    // defer
    await interaction.deferReply();

    // parse
    const user = interaction.options._hoistedOptions[0].user;
    const amount = interaction.options._hoistedOptions[1].value;

    // correct usage?
    if (
      user.id == interaction.user.id ||
      amount < 0
    ) {
      embed = new MessageEmbed()
        .setColor("FFBB33")
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}pay <@user> <amount>`
        )
        .setThumbnail("https://file.coffee/u/C_j6DpCgTR34mOSpaqpd5.png")
        .setFooter({ text: `Please note, you CANNOT pay yourself.` });
      return interaction.editReply({ embeds: [embed] });
    }

    // afford?
    if (amount > get(interaction.user.id).balance) {
      embed = new MessageEmbed()
        .setColor("FF3333")
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setThumbnail("https://file.coffee/u/CWanwcFihzRKWMyxp8g5p.png")
        .setDescription(`You cannot afford this transaction.`);
      return interaction.editReply({ embeds: [embed] });
    }

    // generte code
    code = rn({
      min: 1111,
      max: 9999,
      integer: true,
    });

    // reply
    embed = new MessageEmbed()
      .setColor("B65FFF")
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setThumbnail("https://file.coffee/u/QgGkRW34pBz129RLRTus-.png")
      .setDescription(
        "Transferring `" +
          parseInt(amount) +
          " coins`\n" +
          `<@${interaction.user.id}> → <@${
            user.id
          }>\nPlease type **${code}** to confirm this transaction`
      );
    await interaction.editReply({ embeds: [embed] });
    message = await interaction.fetchReply();

    // await response
    const filter = (m) =>
      m.content == `${code}` && m.author.id == interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 15000,
      max: 1,
    });

    // valid response
    collector.on("collect", (m) => {
      // update JSON
      dy = get(interaction.user.id);
      if (!isLocked(interaction.user.id)) dy.balance -= parseInt(amount);
      set(interaction.user.id, dy);

      du = get(user.id);
      if (!isLocked(user.id))
        du.balance += parseInt(amount);
      set(user.id, du);

      // reply
      embed = new MessageEmbed()
        .setColor("33FF4C")
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setThumbnail("https://file.coffee/u/x6Pfjxf-pI3PjCMTAIL3r.png")
        .setDescription(
          "Transaction completed! `" +
            parseInt(amount) +
            " coins`\n" +
            `<@${interaction.user.id}> → <@${user.id}>`
        );
      interaction.channel.send({ embeds: [embed] });
    });

    // no valid response?
    collector.on("end", (collected) => {
      if (collected.size == 0) {
        embed = new MessageEmbed()
          .setColor("FF3333")
          .setAuthor({
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setThumbnail("https://file.coffee/u/CWanwcFihzRKWMyxp8g5p.png")
          .setDescription("No code recieved. Transaction has been cancelled.");
        interaction.channel.send({ embeds: [embed] });
      }
    });
  }
  if(interaction.commandName == 'top') {

    // defer
    await interaction.deferReply();

    // Sort raw data
    files = fs.readdirSync(`./data/users/`).filter((t) => t.endsWith(".json"));
    unsorted = [];
    for (let i in files) {
      file = JSON.parse(fs.readFileSync(`./data/users/${files[i]}`));
      unsorted.push({
        id: files[i].split(".")[0],
        count: file.balance,
      });
    }
    leaderboard = unsorted.sort((a, b) => (a.count < b.count ? 1 : -1));

    // Further sort
    raw = [];
    counter = 1;
    for (let i in leaderboard) {
      raw.push({
        id: leaderboard[i].id,
        username: `<@${leaderboard[i].id}>`,
        position: counter,
        count: leaderboard[i].count,
      });
      counter = counter + 1;
    }

    // Format
    pages = [];
    string = [];
    for (let i in raw) {
      temp = `${raw[i].position}) ${raw[i].username} - ${raw[i].count} Coins`;
      if (raw[i].position == 1) {
        temp = `🥇 ${raw[i].username} - ${raw[i].count} Coins`;
      } else if (raw[i].position == 2) {
        temp = `🥈 ${raw[i].username} - ${raw[i].count} Coins`;
      } else if (raw[i].position == 3) {
        temp = `🥉 ${raw[i].username} - ${raw[i].count} Coins`;
      }
      if (string.length < 10) {
        string.push(temp);
      } else {
        pages.push(string.join(` \n`));
        string = [];
        string.push(temp);
      }
    }

    // Less than 10 users?
    if (pages.length == 0) {
      pages.push(string.join(` \n`));
    }
    console.log(pages);

    embed = new MessageEmbed()
      .setColor("B65FFF")
      .setAuthor({
        name: `Leaderboard - Top 10`,
        iconURL: interaction.guild.iconURL(),
      })
      .setDescription(pages[0]);
    await interaction.editReply({ embeds: [embed] });
  }
  if(interaction.commandName == `w` || interaction.commandName == `wallet`) {

    // defer
    await interaction.deferReply();

    // collect data
    user = interaction.options._hoistedOptions[0]
      ? interaction.options._hoistedOptions[0].user
      : interaction.user;
    leaderboard = lb(user.id);
    dk = get(user.id);

    if (!dk.staffCredits) dk.staffCredits = 0;
    type =
      dk.staffCredits >= 30
        ? {
            colour: "BLUE",
            name: "`💷` __Platinum__ Wyvern Wallet",
            chance: 50,
          }
        : dk.staffCredits >= 20
        ? { colour: "GOLD", name: "`💵` __Gold__ Wyvern Wallet", chance: 25 }
        : dk.staffCredits >= 10
        ? { colour: "WHITE", name: "`💶` __Iron__ Wyvern Wallet", chance: 10 }
        : {
            colour: "#CD7F32",
            name: "`💴` __Bronze__ Wyvern Wallet",
            chance: 0,
          };
    string =
      "> **Current Balance:** `" +
      dk.balance +
      " Coins` *(#" +
      leaderboard[0] +
      ")*\n> **Messages Sent:** `" +
      dk.messagesSent +
      "` *(#" +
      leaderboard[1] +
      ")*\n> **Special Tokens:** `" +
      dk.special +
      "` *(#" +
      leaderboard[2] +
      ")* \n\n> **User Rating:** `" +
      (dk.staffCredits != null
        ? dk.staffCredits > 0
          ? `+${dk.staffCredits}`
          : dk.staffCredits
        : 0) +
      "` " +
      (leaderboard[3] != null
        ? "*(#" + (leaderboard[3] != null ? leaderboard[3] : "") + ")*"
        : "") +
      " \n> **Total Strikes:** `" +
      (dk.strikes != null ? dk.strikes : 0) +
      "`";

    if (isLocked(user.id))
      type = {
        colour: "DARK_RED",
        name: "`🔒` Locked Wyvern Wallet",
        chance: 0,
      };

    // reply
    embed = new MessageEmbed()
      .setColor(type.colour)
      .setTitle(type.name)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(string);

    if (type.chance > 0)
      embed.setFooter({ text: `${type.chance}% chance to earn double coins!` });

    await interaction.editReply({ embeds: [embed] });
  }
  if(interaction.commandName == `econinfo`) {
    embed = new MessageEmbed()
      .setColor("B65FFF")
      .setThumbnail("https://file.coffee/u/nA5yRHN7GD8E4ekEB_AZq.webp")
      .setTitle(`Economy Info`)
      .setDescription(
        "Current earnings: `" +
          economy.minimumCoins +
          "-" +
          economy.maxiumumCoins +
          " Coins per minute`\nCurrent Bonuses: `N/A`"
      );
    await interaction.reply({ embeds: [embed] });
  }
  if(interaction.commandName == `quests`) {
    count = fs.existsSync(`./data/quests/${interaction.user.id}.json`)
      ? JSON.parse(fs.readFileSync(`./data/quests/${interaction.user.id}.json`))
          .messages.count
      : 0;

    embed = new MessageEmbed()
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setColor("B65FFF")
      .setThumbnail("https://file.coffee/u/nA5yRHN7GD8E4ekEB_AZq.webp")
      .setTitle(`Your Available Quests`)
      .setDescription(
        (count >= 1000 ? "~~" : "") +
          "`Send 1000 Messages`" +
          (count >= 1000 ? "~~" : "") +
          " [" +
          count +
          "/1000]\n+750 Coins, +1 User Rating \n\n" +
          (count >= 500 ? "~~" : "") +
          "`Send 500 Messages`" +
          (count >= 500 ? "~~" : "") +
          " [" +
          count +
          "/500]\n+250 Coins, +1 User Rating"
      );
      await interaction.reply({ embeds: [embed] });
  }

  // client code
  if (interaction.isCommand()) return;

  const addedRoles = [];
  const removedRoles = [];

  interaction.values.forEach((value) => {
    let obj = null;

    config.rroles.roles.forEach((role) => {
      if (role.text === value) {
        obj = role;
      }
    });

    if (obj !== null) {
      const rRole = interaction.guild.roles.cache.find(
        (r) => r.id === obj.roleID
      );

      if (rRole) {
        if (!interaction.member._roles.includes(rRole.id)) {
          interaction.member.roles.add(rRole.id);
          addedRoles.push(rRole);
        }
      }
    }
  });

  config.rroles.roles.forEach((role) => {
    if (!interaction.values.includes(role.text)) {
      const rRole = interaction.guild.roles.cache.find(
        (r) => r.id === role.roleID
      );

      if (rRole) {
        if (interaction.member._roles.includes(rRole.id)) {
          interaction.member.roles.remove(rRole.id);
          removedRoles.push(rRole);
        }
      }
    }
  });

  let reply = [];

  if (addedRoles.length) {
    reply.push(`**Added Roles:** ${addedRoles.join(" ")}`);
  }
  if (removedRoles.length) {
    reply.push(`**Removed Roles:** ${removedRoles.join(" ")}`);
  }

  interaction.reply({ content: `${reply.join("\n") || " "}`, ephemeral: true });
});
client.on("messageCreate", async (message) => {
  // filter
  if (message.author.bot) return;

  // variables
  let msg = message.content.toLowerCase();
  let md = message.content.split(" ");

  // update message stat
  dt = get(message.author.id);
  dt.messagesSent += 1;
  set(message.author.id, dt);

  // quests
  if (economy.channels.includes(message.channel.id)) {
    if (fs.existsSync(`./data/quests/${message.author.id}.json`)) {
      xx = JSON.parse(
        fs.readFileSync(`./data/quests/${message.author.id}.json`)
      );

      if (xx.messages.count >= 1000 && xx.messages.claimed == false) {
        xx.messages.claimed = true;

        yy = get(message.author.id);
        if (!isLocked(message.author.id)) yy.balance += 750;
        if (!yy.staffCredits) yy.staffCredits = 0;
        yy.staffCredits += 1;
        set(message.author.id, yy);
      } else if (xx.messages.count >= 500 && xx.messages.claimed1 == false) {
        xx.messages.claimed1 = true;

        yy = get(message.author.id);
        if (!isLocked(message.author.id)) yy.balance += 250;
        if (!yy.staffCredits) yy.staffCredits = 0;
        yy.staffCredits += 1;
        set(message.author.id, yy);
      }

      xx.messages.count += 1;
      fs.writeFileSync(
        `./data/quests/${message.author.id}.json`,
        JSON.stringify(xx, null, 4)
      );
    } else {
      fs.writeFileSync(
        `./data/quests/${message.author.id}.json`,
        JSON.stringify(
          {
            id: message.author.id,
            messages: {
              count: 1,
              claimed: false, // 1000 messages (250 coins, 1 rep)
              claimed1: false, // 500 messages (100 coins, 1 rep)
            },
          },
          null,
          4
        )
      );
    }
  }

  // earn coins through messaging
  if (economy.channels.includes(message.channel.id)) {
    chatters.push(message.author.id); // push to array
    setTimeout(() => {
      delete chatters[chatters.indexOf(message.author.id)];
      chatters = chatters.filter((t) => t != null);
    }, 60000); // remove after 60s

    // sent enough messages?
    if (
      chatters.filter((t) => t == message.author.id).length >
      economy.minimumMessagesIn60Seconds
    ) {
      // push to rewards
      rewarded.push(message.author.id);

      // load data
      dxx = get(message.author.id);

      // randomise
      reward = rn({
        min: economy.minimumCoins,
        max: economy.maxiumumCoins,
        integer: true,
      });

      // double?
      if (!dxx.staffCredits) dxx.staffCredits = 0;
      btm = dxx.staffCredits >= 75 ? 20 : dxx.staffCredits >= 30 ? 15 : 10;

      // generate
      number = rn({ min: 1, max: 100, integer: true });
      if (number <= btm) reward = reward * 2;

      // booster?
      if (message.member.roles.cache.has(economy.boostRole))
        reward += economy.boostAmount;

      // add to JSON
      if (!isLocked(message.author.id)) dxx.balance += reward;
      set(message.author.id, dxx);
    }
  }

  // events
  if (
    economy.channels.includes(message.channel.id) &&
    lastEvent < Date.now() - 1000 * 60 * 30 &&
    chatters.filter((t) => t != null).length >= 5
  ) {
    // stop further
    lastEvent = Date.now();

    // decide game
    xxx = rn({ min: 1, max: 4, intesger: true });

    // hot potato
    if (xxx == 1) {
      current = chatters;
      holder = message.author.id;

      embed = new MessageEmbed()
        .setColor("ORANGE")
        .setTitle(`⭐ Random Event | Hot Potato`)
        .setDescription(
          `Use **?pass @user** to pass the potato! \nYou must mention someone who was chatting in the last minute, otherwise you will lose 50 coins.`
        )
        .setFooter({ text: `Game ends in 10 seconds!` });
      message.channel.send({ embeds: [embed] });

      message.channel.send(`<@${holder}> has the potato!`);

      const filter = (m) =>
        m.content.startsWith(`?pass`) && m.mentions.users.first();
      const collector = message.channel.createMessageCollector({
        filter,
        time: 10000,
      });
      collector.on("collect", (m) => {
        if (holder != m.author.id) return;

        if (current.includes(m.mentions.users.first().id)) {
          holder = m.mentions.users.first().id;
          embed = new MessageEmbed()
            .setColor("ORANGE")
            .setDescription(
              `Potato passed to <@${m.mentions.users.first().id}>!`
            );
          message.channel.send({ embeds: [embed] });
        } else {
          embed = new MessageEmbed()
            .setColor("ORANGE")
            .setDescription(
              `You must mention an active chatter. You have had 50 coins removed.`
            );
          message.channel.send({ embeds: [embed] });

          dz = get(m.author.id);
          dz.balance -= 50;
          set(m.author.id, dz);
        }
      });
      collector.on("end", (collected) => {
        embed = new MessageEmbed()
          .setColor("ORANGE")
          .setTitle(`Game over!`)
          .setDescription(`<@${holder}> had the potato - they lost 50 coins!`);
        message.channel.send({ embeds: [embed] });

        dz = get(holder);
        dz.balance -= 50;
        set(holder, dz);
      });
    }

    // first to reply with word
    if (xxx == 2) {
      word =
        images[
          rn({
            min: 0,
            max: images.length - 1,
            integer: true,
          })
        ];

      embed = new MessageEmbed()
        .setColor("ORANGE")
        .setTitle(`⭐ Random Event | The Typing Test`)
        .setImage(word.image)
        .setDescription(`Type the sentence quickly to earn 50 coins!`)
        .setFooter({ text: `First to finish typing wins!` });
      message.channel.send({ embeds: [embed] });

      const filter = (m) => m.content.toLowerCase() == word.word.toLowerCase();
      const collector = message.channel.createMessageCollector({
        filter,
        max: 1,
      });
      collector.on("collect", (m) => {
        embed = new MessageEmbed()
          .setColor("ORANGE")
          .setTitle(`Game over!`)
          .setDescription(
            `<@${m.author.id}> answered first - they won 50 coins!`
          );
        message.channel.send({ embeds: [embed] });

        dz = get(m.author.id);
        dz.balance += 50;
        set(m.author.id, dz);
      });
    }

    // count to 10
    if (xxx == 3) {
      embed = new MessageEmbed()
        .setColor("ORANGE")
        .setTitle(`⭐ Random Event | Eggwalk`)
        .setDescription(`Users must alternate! Start at 1 and count to 10.`)
        .setFooter({ text: `You win 50 coins if successful!` });
      message.channel.send({ embeds: [embed] });

      last = client.user.id;
      no = 0;
      participated = [];
      fail = false;

      const filter = (m) =>
        !isNaN(m.content) &&
        !m.author.bot &&
        m.content != "" &&
        !m.attachments.first();
      const collector = message.channel.createMessageCollector({ filter });
      collector.on("collect", (m) => {
        if (
          last == m.author.id ||
          parseInt(m.content) == no ||
          parseInt(m.content) != no + 1
        ) {
          fail = true;
          collector.stop();
        }

        m.react("✔️");
        last = m.author.id;
        participated.push(m.author.id);
        no += 1;

        if (no == 10) collector.stop();
      });
      collector.on("end", (collected) => {
        if (fail == true) {
          embed = new MessageEmbed()
            .setColor("ORANGE")
            .setTitle(`Fail!`)
            .setDescription(`Better luck next time!`);
          message.channel.send({ embeds: [embed] });
        } else {
          for (i in participated) {
            dz = get(participated[i]);
            dz.balance += 50;
            set(participated[i], dz);
          }

          embed = new MessageEmbed()
            .setColor("ORANGE")
            .setTitle(`Game over!`)
            .setDescription(`Each user has been awarded 50 coins.`);
          message.channel.send({ embeds: [embed] });
        }
      });
    }

    // name the location
    if (xxx == 4) {
      word2 =
        images2[
          rn({
            min: 0,
            max: images2.length - 1,
            integer: true,
          })
        ];

      embed = new MessageEmbed()
        .setColor("ORANGE")
        .setTitle(`⭐ Random Event | Name the Location`)
        .setImage(word2.image2)
        .setDescription(`Type the name of this image to win 50 coins`)
        .setFooter({ text: `The fastest reply wins` });
      message.channel.send({ embeds: [embed] });

      const filter = (m) =>
        m.content.toLowerCase() == word2.word2.toLowerCase();
      const collector = message.channel.createMessageCollector({
        filter,
        max: 1,
      });
      collector.on("collect", (m) => {
        embed = new MessageEmbed()
          .setColor("ORANGE")
          .setTitle(`Game over!`)
          .setDescription(
            `<@${m.author.id}> answered first - they won 50 coins!`
          );
        message.channel.send({ embeds: [embed] });

        dz = get(m.author.id);
        dz.balance += 50;
        set(m.author.id, dz);
      });
    }
  }

  // filter
  if (!message.content.startsWith(prefix)) return;

  // admin commands
  if (
    md[0].toLowerCase() == `${prefix}dm` &&
    message.author.id == `525171507324911637`
  ) {
    // correct usage?
    if (!message.mentions.users.first()) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}dm <@user> <message>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // dm
    xx = await message.mentions.users
      .first()
      .send({ content: md.slice(2).join(" ") })
      .catch((err) => null);

    // react
    xx == null ? await message.react("❌") : await message.react("✔️");
  }
  if (md[0].toLowerCase() == `${prefix}wipe`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first()) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`Incorrect command usage. E.g. ${prefix}wipe <@user>`);
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    da = get(message.mentions.users.first().id);
    da.balance = 0;
    set(message.mentions.users.first().id, da);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. User balance has been reset.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}remove`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}remove <@user> <amount>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    if (!isLocked(message.author.id)) dz.balance -= parseInt(md[2]);
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. Coins have been removed.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}give`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}give <@user> <amount>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    if (!isLocked(message.mentions.users.first().id))
      dz.balance += parseInt(md[2]);
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. Coins have been added.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}addrating`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}addrating <@user> <amount>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    if (!dz.staffCredits) dz.staffCredits = 0;
    dz.staffCredits += parseInt(md[2]);
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. Reputation has been updated.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}removerating`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}removerating <@user> <amount>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    if (!dz.staffCredits) dz.staffCredits = 0;
    dz.staffCredits -= parseInt(md[2]);
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. Reputation has been updated.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}strike`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first()) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}strike <@user>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    if (!dz.strikes) dz.strikes = 0;
    dz.strikes += 1;
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Strike has been added.`);
    message.channel.send({ embeds: [embed] });
  }
  if (md[0].toLowerCase() == `${prefix}lock`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first()) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`Incorrect command usage. E.g. ${prefix}lock <@user>`);
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    d = JSON.parse(fs.readFileSync(`./data/locked.json`));

    // reply
    if (d.includes(message.mentions.users.first().id)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`Account has been unlocked.`);
      message.channel.send({ embeds: [embed] });

      d = d.filter((t) => t != message.mentions.users.first().id);
    } else {
      embed = new MessageEmbed()
        .setColor("33FF4C")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`Account has been locked.`);
      message.channel.send({ embeds: [embed] });

      d.push(message.mentions.users.first().id);
    }

    // write
    fs.writeFileSync(`./data/locked.json`, JSON.stringify(d, null, 4));
  }
  if (md[0].toLowerCase() == `${prefix}reward`) {
    // admin?
    if (!message.member.roles.cache.has(adminRole)) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(`You must be a member of staff to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    // correct usage?
    if (!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
      embed = new MessageEmbed()
        .setColor("DARK_RED")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          `Incorrect command usage. E.g. ${prefix}reward <@user> <amount>`
        );
      return message.channel.send({ embeds: [embed] });
    }

    // update JSON
    dz = get(message.mentions.users.first().id);
    dz.special += parseInt(md[2]);
    set(message.mentions.users.first().id, dz);

    // reply
    embed = new MessageEmbed()
      .setColor("33FF4C")
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`Success. Special tokens have been given.`);
    message.channel.send({ embeds: [embed] });
  }
  if (msg == `${prefix}help`) {
    embed = new MessageEmbed()
      .setColor("B65FFF")
      .setThumbnail("https://file.coffee/u/nA5yRHN7GD8E4ekEB_AZq.webp")
      .addField(
        `List of Main Commands`,
        "`?pay {AMOUNT} {@} {@}` Allows users to send coins to other users\n`?top` Displays the top 10 richest users\n`?wallet OR ?w {@}` Displays your or another user's wallet\n`?econinfo` Displays the current economy configuration\n`?quests` Display your current progress on your quests"
      );
    message.channel.send({ embeds: [embed] });
  }
});

// Login
client.login(token);