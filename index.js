// Packages
const fs = require('fs');
const rn = require('random-number');
const CronJob = require('cron').CronJob;
const { Client, Intents, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_PRESENCES
]});

// Config
const cronTimezone = 'America/Los_Angeles';
const { token, economy, prefix, adminRole, images, adminRole1, status, repChannel } = require('./data/config.json');
let chatters = []; // holds the IDs of people sending messages
let rewarded = []; // hold IDs of people who have recieved coins for that minute
let lastEvent = 999; // unix date of when the last event took place
let fights = []; // holds the IDs of users who have fought in the last 10mins
let repCommandCooldown = []; // holds the IDs of users who have used the rep command in the last hour

// Functions
function get(id) {
    if(fs.existsSync(`./data/users/${id}.json`)) {
        return JSON.parse(fs.readFileSync(`./data/users/${id}.json`));
    } else {
        return {
            id: id,
            balance: 0,
            messagesSent: 0,
            special: 0
        }
    }
}
function set(id, data) {
    fs.writeFileSync(`./data/users/${id}.json`, JSON.stringify(data, null, 4));
}
function lb(id) {
    files = fs.readdirSync(`./data/users/`).filter(t => t.endsWith('.json'));
    unsorted = [];
    for(let i in files) {
        file = JSON.parse(fs.readFileSync(`./data/users/${files[i]}`));
        unsorted.push({
            id: files[i].split(".")[0],
            balance: file.balance,
            messagesSent: file.messagesSent,
            special: file.special,
            staffCredits: (file.staffCredits == null ? 0 : file.staffCredits)
        });
    };

    bal = unsorted.sort((a, b) => (a.balance < b.balance) ? 1 : -1).map(t => t.id);
    msgSent = unsorted.sort((a, b) => (a.messagesSent < b.messagesSent) ? 1 : -1).map(t => t.id);
    spec = unsorted.sort((a, b) => (a.special < b.special) ? 1 : -1).map(t => t.id);
    rating = unsorted.sort((a, b) => (a.staffCredits > b.staffCredits) ? 1 : -1).map(t => t.id).reverse();

    return [bal.indexOf(id) + 1, msgSent.indexOf(id) + 1, spec.indexOf(id) + 1, (rating.indexOf(id) == null ? null : rating.indexOf(id) + 1)];
}
function isLocked(id) {
    st = JSON.parse(fs.readFileSync(`./data/locked.json`)).includes(id) ? true : false;
    return st
}

// Listeners
client.on("ready", () => {

    // log
    console.log(`--> Bot online`);

    // status
    client.user.setPresence({ activities: [{ name: status.message, type: status.type }], status: 'idle' });

    // reset rewarded array every minute
    setInterval(() => {
        rewarded = [];
    }, 60000);

    // reset quests at midnight + logs
    let job1 = new CronJob('1 0 0 * * *', function() {
        files = fs.readdirSync(`./data/quests/`);
        for(i = 0; i < files.length; i++) {
            fs.unlinkSync(`./data/quests/${files[i]}`);
        }

        fs.writeFileSync(`./data/log.json`, JSON.stringify([], null, 4));
    }, null, true, cronTimezone);
    job1.start();

    // remove expired fight cooldowns
    setInterval(() => {
        fights = fights.filter(t => t != null && t.time > Date.now());
    }, (1000));
});
client.on("messageCreate", async message => {

    // filter
    if(message.author.bot) return;
    
    // variables
    let msg = message.content.toLowerCase();
    let md = message.content.split(" ");

    // update message stat
    dt = get(message.author.id);
    dt.messagesSent += 1;
    set(message.author.id, dt);

    // quests
    if(fs.existsSync(`./data/quests/${message.author.id}.json`)) {
        xx = JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`));

        if(xx.messages.count >= 1000 && xx.messages.claimed == false) {
            xx.messages.claimed = true;

            yy = get(message.author.id);
            if(!isLocked(message.author.id)) yy.balance += 250;
            yy.staffCredits += 2;
            set(message.author.id, yy);
        } else if(xx.messages.count >= 500 && xx.messages.claimed1 == false) {
            xx.messages.claimed1 = true;

            yy = get(message.author.id);
            if(!isLocked(message.author.id)) yy.balance += 100;
            yy.staffCredits += 1;
            set(message.author.id, yy);
        }

        xx.messages.count += 1;
        fs.writeFileSync(`./data/quests/${message.author.id}.json`, JSON.stringify(xx, null, 4));
    } else {
        fs.writeFileSync(`./data/quests/${message.author.id}.json`, JSON.stringify({
            id: message.author.id,
            messages: {
                count: 1,
                claimed: false, // 1000 messages (250 coins, 2 rep)
                claimed1: false // 500 messages (100 coins, 1 rep)
            }
        }, null, 4));
    }

    // earn coins through messaging
    if(message.channel.id == economy.channel && !rewarded.includes(message.author.id)) {

        chatters.push(message.author.id); // push to array
        setTimeout(() => {
            delete chatters[chatters.indexOf(message.author.id)];
            chatters = chatters.filter(t => t != null);
        }, 60000); // remove after 60s

        // sent enough messages?
        if(chatters.filter(t => t == message.author.id).length > economy.minimumMessagesIn60Seconds) {
            
            // push to rewards
            rewarded.push(message.author.id);

            // load data
            dxx = get(message.author.id);

            // randomise 
            reward = rn({
                min: economy.minimumCoins,
                max: economy.maxiumumCoins,
                integer: true
            });

            // double?
            if(!dxx.staffCredits) dxx.staffCredits = 0;
            btm = dxx.staffCredits >= 50 
            ? 20
            : (dxx.staffCredits >= 25) 
            ? 15
            : 10

            // generate
            number = rn({ min: 1, max: 100, integer: true });
            if(number <= btm) reward = reward * 2;

            // booster?
            if(message.member.roles.cache.has(economy.boostRole)) reward += economy.boostAmount;

            // add to JSON
            if(!isLocked(message.author.id)) dxx.balance += reward;
            set(message.author.id, dxx);
        }
    }

    // events
    if(message.channel.id == economy.channel && (lastEvent < Date.now() - (1000*60*15)) && chatters.filter(t => t != null).length >= 5 && !message.content.startsWith(prefix)) {

        // stop further
        lastEvent = Date.now();

        // decide game
        xxx = rn({ min: 1, max: 4, integer: true });

        // hot potato
        if(xxx == 1) { 
            current = chatters;
            holder = message.author.id;
    
            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setTitle(`⭐ Random Event | Hot Potato`)
                .setDescription(`Use **?pass @user** to pass the potato! \nYou must mention someone who was chatting in the last minute, otherwise you will lose 50 coins.`)
                .setFooter({text:`Game ends in 10 seconds!`})
            message.channel.send({embeds:[embed]});
            
            message.channel.send(`<@${holder}> has the potato!`);
    
            const filter = m => m.content.startsWith(`?pass`) && m.mentions.users.first();
            const collector = message.channel.createMessageCollector({ filter, time: 10000 });
            collector.on('collect', m => {
                
                if(holder != m.author.id) return;
    
                if(current.includes(m.mentions.users.first().id)) {
                    holder = m.mentions.users.first().id;
                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setDescription(`Potato passed to <@${m.mentions.users.first().id}>!`)
                    message.channel.send({embeds:[embed]});
                } else {
                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setDescription(`You must mention an active chatter. You have had 50 coins removed.`)
                    message.channel.send({embeds:[embed]});
    
                    dz = get(m.author.id);
                    if(!isLocked(message.author.id)) dz.balance -= 50;
                    set(m.author.id, dz);
                }
            });
            collector.on('end', collected => {
                embed = new MessageEmbed()
                    .setColor('ORANGE')
                    .setTitle(`Game over!`)
                    .setDescription(`<@${holder}> had the potato - they lost 50 coins!`)
                message.channel.send({embeds:[embed]});
    
                dz = get(holder);
                if(!isLocked(message.author.id)) dz.balance -= 50;
                set(holder, dz);
            });
        }

        // first to reply with word
        if(xxx == 2) {

            word = images[rn({
                min: 0,
                max: images.length -1,
                integer: true
            })];

            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setTitle(`⭐ Random Event | Name the Image`)
                .setImage(word.image)
                .setDescription(`Reply correctly to win 50 coins!`)
                .setFooter({text:`First to reply wins!`})
            message.channel.send({embeds:[embed]});

            const filter = m => m.content.toLowerCase() == word.word.toLowerCase();
            const collector = message.channel.createMessageCollector({ filter, max: 1 });
            collector.on('collect', m => {
    
                embed = new MessageEmbed()
                    .setColor('ORANGE')
                    .setTitle(`Game over!`)
                    .setDescription(`<@${m.author.id}> answered first - they won 50 coins!`)
                message.channel.send({embeds:[embed]});

                dz = get(m.author.id);
                if(!isLocked(message.author.id)) dz.balance += 50;
                set(m.author.id, dz);
            });
        }

        // count to 10
        if(xxx == 3) {
            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setTitle(`⭐ Random Event | Eggwalk`)
                .setDescription(`Users must alternate! Start at 1 and count to 10.`)
                .setFooter({text:`You win 50 coins if successful!`})
            message.channel.send({embeds:[embed]});

            last = client.user.id;
            no = 0;
            participated = [];
            fail = false;

            const filter = m => !isNaN(m.content) && !m.author.bot;
            const collector = message.channel.createMessageCollector({ filter, });
            collector.on('collect', m => {

                if(last == m.author.id || parseInt(m.content) == no || parseInt(m.content) != (no + 1)) {
                    fail = true;

                    dz = get(m.author.id);
                    dz.balance -= 100;
                    set(m.author.id, dz);

                    collector.stop();
                } 

                m.react('✔️');
                last = m.author.id;
                participated.push(m.author.id);
                no += 1;

                if(no == 10) collector.stop();
            });
            collector.on('end', collected => {

                if(fail == true) {
                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setTitle(`Fail!`)
                        .setDescription(`Better luck next time!`)
                    message.channel.send({embeds:[embed]});
                } else {

                    for(i in participated) {
                        dz = get(participated[i]);
                        if(!isLocked(participated[i])) dz.balance += 50;
                        set(participated[i], dz);
                    }

                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setTitle(`Game over!`)
                        .setDescription(`Each user has been awarded 50 coins.`)
                    message.channel.send({embeds:[embed]});
                }

            });
        }

        // dilemma
        if(xxx == 4) {

            one = message.author.id;
            two = null;
            three = null;

            while(two == null || one == two) {
                chatters = chatters.filter(t => t != null);
                two = chatters[rn({
                    min: 0,
                    max: chatters.length - 1,
                    integer: true
                })];
            }
            while(three == null || one == three || two == three) {
                chatters = chatters.filter(t => t != null);
                three = chatters[rn({
                    min: 0,
                    max: chatters.length - 1,
                    integer: true
                })];
            }

            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setTitle(`⭐ Random Event | Dielemma`)
                .setDescription(`<@${one}> must select someone below to lose 100 coins!\n\n1. <@${one}> \n2. <@${two}> \n3. <@${three}>`)
                .setFooter({text:`30 seconds to reply, or all 3 lose 100 coins.\nReply with 1, 2 or 3`})
            message.channel.send({embeds:[embed]});

            const filter = m => (m.content == '1' || m.content == '2' || m.content == '3') && m.author.id == message.author.id;
            const collector = message.channel.createMessageCollector({ filter, max: 1, time: 30000});
            collector.on('collect', m => {

                switch(m.content) {
                    case('1'): 

                        dx = get(one);
                        if(!isLocked(one)) dx.balance -= 100;
                        set(one, dx);

                        embed = new MessageEmbed()
                            .setColor('ORANGE')
                            .setTitle(`Game over!`)
                            .setDescription(`<@${one}> lost 100 coins.`)
                        message.channel.send({embeds:[embed]});
                        break;
                    
                    case('2'): 
                    
                        dx = get(two);
                        if(!isLocked(two)) dx.balance -= 100;
                        set(two, dx);

                        embed = new MessageEmbed()
                            .setColor('ORANGE')
                            .setTitle(`Game over!`)
                            .setDescription(`<@${two}> lost 100 coins.`)
                        message.channel.send({embeds:[embed]});
                        break;
                        
                    case('3'): 
                    
                        dx = get(three);
                        if(!isLocked(three)) dx.balance -= 100;
                        set(three, dx);

                        embed = new MessageEmbed()
                            .setColor('ORANGE')
                            .setTitle(`Game over!`)
                            .setDescription(`<@${three}> lost 100 coins.`)
                        message.channel.send({embeds:[embed]});
                        break;
                }
            });
            collector.on('end', collected => {
                if(collected.size == 0) {

                    dx = get(one);
                    if(!isLocked(one)) dx.balance -= 100;
                    set(one, dx);

                    dx = get(two);
                    if(!isLocked(two)) dx.balance -= 100;
                    set(two, dx);

                    dx = get(three);
                    if(!isLocked(three)) dx.balance -= 100;
                    set(three, dx);

                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setTitle(`Game over!`)
                        .setDescription(`All 3 users lost 100 coins.`)
                    message.channel.send({embeds:[embed]});

                }
            });
        }
    }

    // filter
    if(!message.content.startsWith(prefix)) return;

    // admin commands
    if(md[0].toLowerCase() == `${prefix}dm` && message.author.id == `525171507324911637`) {

        // correct usage?
        if(!message.mentions.users.first()) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}dm <@user> <message>`)
            return message.channel.send({embeds:[embed]});
        }

        // dm
        xx = await message.mentions.users.first().send({content:md.slice(2).join(" ")}).catch(err => null);

        // react
        xx == null ? await message.react("❌") : await message.react("✔️");
    }
    if(md[0].toLowerCase() == `${prefix}wipe`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first()) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}wipe <@user>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        da = get(message.mentions.users.first().id);
        if(!isLocked(message.author.id)) da.balance = 0;
        set(message.mentions.users.first().id, da);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. User balance has been reset.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}remove`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}remove <@user> <amount>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        if(!isLocked(message.author.id)) dz.balance -= parseInt(md[2]);
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Coins have been removed.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}give`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}give <@user> <amount>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        if(!isLocked(message.mentions.users.first().id)) dz.balance += parseInt(md[2]);
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Coins have been added.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}addrating`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}addrating <@user> <amount>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        if(!dz.staffCredits) dz.staffCredits = 0;
        dz.staffCredits += parseInt(md[2]);
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Reputation has been updated.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}removerating`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}removerating <@user> <amount>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        if(!dz.staffCredits) dz.staffCredits = 0;
        dz.staffCredits -= parseInt(md[2]);
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Reputation has been updated.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}strike`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first()) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}strike <@user>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        if(!dz.strikes) dz.strikes = 0;
        dz.strikes += 1;
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Strike has been added.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}lock`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first()) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}lock <@user>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        d = JSON.parse(fs.readFileSync(`./data/locked.json`));

        // reply
        if(d.includes(message.mentions.users.first().id)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Account has been unlocked.`)
            message.channel.send({embeds:[embed]});

            d = d.filter(t => t != message.mentions.users.first().id);
        } else {
            embed = new MessageEmbed()
                .setColor('GREEN')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Account has been locked.`)
            message.channel.send({embeds:[embed]});

            d.push(message.mentions.users.first().id);
        }

        // write
        fs.writeFileSync(`./data/locked.json`, JSON.stringify(d, null, 4));
    }
    if(md[0].toLowerCase() == `${prefix}reward`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || isNaN(md[2]) || md[2] < 0) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}reward <@user> <amount>`)
            return message.channel.send({embeds:[embed]});
        }

        // update JSON
        dz = get(message.mentions.users.first().id);
        dz.special += parseInt(md[2]);
        set(message.mentions.users.first().id, dz);

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Special tokens have been given.`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}log`) {
        
        // admin?
        if(!message.member.roles.cache.has(adminRole) && !message.member.roles.cache.has(adminRole1)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!md[1]) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}log <message>`)
            return message.channel.send({embeds:[embed]});
        }

        // record in JSON
        data = JSON.parse(fs.readFileSync(`./data/log.json`));
        data.push({message:`${md.slice(1).join(" ")}`, tag: message.author.tag, id: message.author.id});
        fs.writeFileSync(`./data/log.json`, JSON.stringify(data, null, 4));

        // reply
        embed = new MessageEmbed()
            .setColor('GREEN')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Log has been updated.`)
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}today`) {
        
        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // load data
        logs = JSON.parse(fs.readFileSync(`./data/log.json`)).map(t => `<@${t.id}> **${t.message}**`);

        // reply
        embed = new MessageEmbed()
            .setColor('DARK_BLUE')
            .setDescription(logs.length == 0 ? `No logs recorded for today.` : logs.join(`\n`))
            .setFooter({text:`Clears at midnight daily`})
        message.channel.send({embeds:[embed]});
    } 

    // user commands
    if(md[0].toLowerCase() == `${prefix}fight` && !msg.includes(`fightaccept`) && !msg.includes('fightdecline')) {

        // locked?
        if(isLocked(message.author.id)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Your wallet is locked. You cannot use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || message.mentions.users.first() == message.author.id|| isNaN(md[2]) || md[2] < 10 || md[2] > 250) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. ${prefix}fight @user bet`)
                .setFooter({ text: `Minimum bet 10, maximum bet 250.` })
            return message.channel.send({embeds:[embed]});
        }

        // cooldown
        if(fights.filter(t => t.id == message.author.id)[0]) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You have been in a recent fight and are still recovering, please wait another ${Math.floor((fights.filter(t => t.id == message.author.id)[0].time - Date.now()) / 60000)} minutes before fighting again`)
            return message.channel.send({embeds:[embed]});
        }

        // afford?
        if(md[2] > get(message.author.id).balance) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You cannot afford this transaction.`)
            return message.channel.send({embeds:[embed]});
        }

        // add to fights array
        fights.push({ id: message.author.id, time: (Date.now()+(1000*60*10)) });
        fights.push({ id: message.mentions.users.first().id, time: (Date.now()+(1000*60*10)) });

        // reply
        embed = new MessageEmbed()
            .setColor('DARK_BLUE')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`**Accept the fight?** \n\n${prefix}fightaccept \n${prefix}fightdecline`)
            .setFooter({ text: `You have 60 seconds to respond.` })
        message.channel.send({embeds:[embed]});

        // await response
        const filter = m => [`${prefix}fightaccept`, `${prefix}fightdecline`].includes(m.content.toLowerCase()) && m.author.id == message.mentions.users.first().id;
        const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

        // valid response
        collector.on('collect', m => {
            switch(m.content.toLowerCase()) {

                case(`${prefix}fightdecline`):

                    // reply
                    embed = new MessageEmbed()
                        .setColor('ORANGE')
                        .setDescription("Fight declined.")
                    message.channel.send({embeds:[embed], content: `<@${message.author.id}> <@${message.mentions.users.first().id}>`});

                    // remove cooldown
                    fights = fights.filter(t => t.id != message.author.id && t.id != message.mentions.users.first().id);
                    break;

                case(`${prefix}fightaccept`):

                    // afford?
                    if(md[2] > get(message.mentions.users.first().id).balance) {
                        embed = new MessageEmbed()
                            .setColor('DARK_RED')
                            .setAuthor({name:m.author.tag, iconURL:m.author.displayAvatarURL()})
                            .setDescription(`You cannot afford this transaction.`)
                        return message.channel.send({embeds:[embed]});
                    }

                    // pick winner
                    winner = rn({min: 1, max: 2, integer: true}) == 1 ? message.author.id: message.mentions.users.first().id;
                    loser = winner == message.author.id ? message.mentions.users.first().id : message.author.id;

                    // reply
                    embed = new MessageEmbed()
                        .setColor('GREEN')
                        .setDescription(`🏆 <@${winner}> wins!`)
                    message.channel.send({embeds:[embed]});

                    // update balance
                    dz = get(winner);
                    if(!isLocked(winner)) dz.balance += parseInt(md[2]);
                    fs.writeFileSync(`./data/users/${winner}.json`, JSON.stringify(dz, null, 4));

                    dzzz = get(loser);
                    if(!isLocked(loser)) dzzz.balance -= parseInt(md[2]);
                    fs.writeFileSync(`./data/users/${loser}.json`, JSON.stringify(dzzz, null, 4));

                    break;
            }
        });
        collector.on('end', collected => {
            if(collected.size == 0) {
                
                // reply
                embed = new MessageEmbed()
                    .setColor('ORANGE')
                    .setAuthor({name:message.mentions.users.first().tag, iconURL: message.mentions.users.first().displayAvatarURL()})
                    .setDescription("No response recieved. Fight cancelled.")
                message.channel.send({embeds:[embed], content:`<@${message.author.id}>`});

                // remove cooldown
                fights = fights.filter(t => t.id != message.author.id && t.id != message.mentions.users.first().id);                
            }
        });
    }
    if(md[0].toLowerCase() == `${prefix}rep` || md[0].toLowerCase() == `${prefix}r`) {

        // correct usage?
        if(!message.mentions.users.first() || message.mentions.users.map(t => t.id).includes(message.author.id) || !["+", "-"].includes(md[2]) || !md[3]) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}rep <@user> <+/-> <reason>`)
                .setFooter({text:`*Please note, you CANNOT rep yourself!*`})
            return message.channel.send({embeds:[embed]});
        }

        // cooldown
        if(repCommandCooldown.includes(message.author.id)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You are on cooldown. You can only use this command once per hour.`)
            return message.channel.send({embeds:[embed]});
        }
        repCommandCooldown.push(message.author.id);
        setTimeout(() => {
            delete repCommandCooldown[repCommandCooldown.indexOf(message.author.id)];
            repCommandCooldown = repCommandCooldown.filter(t => t != null);
        }, (1000*60*60));

        // reply
        embed = new MessageEmbed()
            .setColor('ORANGE')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Reputation has been recorded!`)
        message.channel.send({embeds:[embed]});

        // record in channel
        embed = new MessageEmbed()
            .setColor(md[2] == "-" ? "DARK_RED" : "GREEN")
            .setAuthor({ name: message.mentions.users.first().tag, iconURL: message.mentions.users.first().displayAvatarURL() })
            .setDescription("`"+md.slice(3).join(" ")+"`")
            .setFooter({ text: `Rep by: ${message.author.tag}` })
        c = await message.guild.channels.fetch(repChannel);
        c.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}pay`) {

        // locked?
        if(isLocked(message.author.id)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Your wallet is locked. You cannot use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // correct usage?
        if(!message.mentions.users.first() || message.mentions.users.map(t => t.id).includes(message.author.id) || isNaN(md[1]) || md[1] < 0 || md[1] == '') {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
				.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}pay <amount> <@user> <@user> <@user>`)
                .setFooter({text:`*Please note, you CANNOT pay yourself!*`})
            return message.channel.send({embeds:[embed]});
        }

        // afford?
        if((md[1] * message.mentions.users.size) > get(message.author.id).balance) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You cannot afford this transaction.`)
            return message.channel.send({embeds:[embed]});
        }

        // generte code
        code = rn({
            min: 1111,
            max: 9999,
            integer: true
        });

        // reply
        embed = new MessageEmbed()
            .setColor('ORANGE')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription("Transferring `"+parseInt(md[1]) * message.mentions.users.size+" coins`\n"+`<@${message.author.id}> → ${message.mentions.users.map(t => `<@${t.id}>`).join("")}\nPlease type **${code}** to confirm this transaction`)
        message.channel.send({embeds:[embed]});

        // await response
        const filter = m => m.content == `${code}` && m.author.id == message.author.id
        const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        // valid response
        collector.on('collect', m => {

            // update JSON
            dy = get(message.author.id);
            if(!isLocked(message.author.id)) dy.balance -= parseInt(md[1]);
            set(message.author.id, dy);

            message.mentions.users.forEach(t => {
                du = get(t.id);
                if(!isLocked(t.id)) du.balance += parseInt(md[1]);
                set(t.id, du);
            });

            // reply
            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription("Transaction completed! `"+parseInt(md[1]) * message.mentions.users.size+" coins`\n"+`<@${message.author.id}> → ${message.mentions.users.map(t => `<@${t.id}>`).join("")}`)
            message.channel.send({embeds:[embed]});
        });

        // no valid response?
        collector.on('end', collected => {
            if(collected.size == 0) {
                embed = new MessageEmbed()
                    .setColor('ORANGE')
                    .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                    .setDescription("No code recieved. Transaction has been cancelled.")
                message.channel.send({embeds:[embed]});
            }
        });
    }
    if(msg == `${prefix}top`) {
        
        // Sort raw data
        files = fs.readdirSync(`./data/users/`).filter(t => t.endsWith('.json'));
        unsorted = [];
        for(let i in files) {
            file = JSON.parse(fs.readFileSync(`./data/users/${files[i]}`));
            unsorted.push({
                id: files[i].split(".")[0],
                count: file.balance,
            });
        };
        leaderboard = unsorted.sort((a, b) => (a.count < b.count) ? 1 : -1);
    
        // Further sort
        raw = [];
        counter = 1
        for(let i in leaderboard) {
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
        for(let i in raw) {
            temp = `**#${raw[i].position}** ${raw[i].username} - ${raw[i].count} Coins`;
            if(raw[i].position == 1) {
                temp = `🥇 ${raw[i].username} - ${raw[i].count} Coins`
            } else if(raw[i].position == 2) {
                temp = `🥈 ${raw[i].username} - ${raw[i].count} Coins`
            } else if(raw[i].position == 3) {
                temp = `🥉 ${raw[i].username} - ${raw[i].count} Coins`
            }
            if(string.length < 10) {
                string.push(temp);
            } else {
                pages.push(string.join(` \n`));
                string = [];
                string.push(temp);
            }
        }

        // Less than 10 users?
        if(pages.length == 0) {
            pages.push(string.join(` \n`));
        }

        embed = new MessageEmbed()
            .setColor('ORANGE') 
            .setAuthor({ name: `Leaderboard - Top 10 Richest Users`, iconURL: message.guild.iconURL() })
            .setDescription(pages[0])
        message.channel.send({embeds: [embed]});
    }  
    if(msg == `${prefix}rtop`) {
        
        // Sort raw data
        files = fs.readdirSync(`./data/users/`).filter(t => t.endsWith('.json'));
        unsorted = [];
        for(let i in files) {
            file = JSON.parse(fs.readFileSync(`./data/users/${files[i]}`));
            unsorted.push({
                id: files[i].split(".")[0],
                count: file.staffCredits == null ? 0 : file.staffCredits,
            });
        };
        leaderboard = unsorted.sort((a, b) => (a.count < b.count) ? 1 : -1);
    
        // Further sort
        raw = [];
        counter = 1
        for(let i in leaderboard) {
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
        for(let i in raw) {
            temp = `**#${raw[i].position}** ${raw[i].username} - ${raw[i].count}`;
            if(raw[i].position == 1) {
                temp = `🥇 ${raw[i].username} - ${raw[i].count}`
            } else if(raw[i].position == 2) {
                temp = `🥈 ${raw[i].username} - ${raw[i].count}`
            } else if(raw[i].position == 3) {
                temp = `🥉 ${raw[i].username} - ${raw[i].count}`
            }
            if(string.length < 10) {
                string.push(temp);
            } else {
                pages.push(string.join(` \n`));
                string = [];
                string.push(temp);
            }
        }

        // Less than 10 users?
        if(pages.length == 0) {
            pages.push(string.join(` \n`));
        }

        embed = new MessageEmbed()
            .setColor('ORANGE') 
            .setAuthor({ name: `Leaderboard - Top 10 Users by Reputation`, iconURL: message.guild.iconURL() })
            .setDescription(pages[0])
        message.channel.send({embeds: [embed]});
    }  
    if(md[0].toLowerCase() == `${prefix}w` || md[0].toLowerCase() == `${prefix}wallet`) {

        // collect data
        user = message.mentions.users.first() ? message.mentions.users.first() : message.author;
        leaderboard = lb(user.id);
        dk = get(user.id);

        if(!dk.staffCredits) dk.staffCredits = 0;
        type = dk.staffCredits >= 50 
        ? { colour: "BLUE", name: "Platinum Wallet", chance: 20 }
        : (dk.staffCredits >= 25) 
        ? { colour: "GOLD", name: "Gold Wallet", chance: 15 }
        : (dk.staffCredits >= 10)
        ? { colour: "WHITE", name: "Iron Wallet", chance: 10 }
        : { colour: "#CD7F32", name: "Bronze Wallet", chance: 0 }
        string = "**Current Balance:** `"+dk.balance+" Coins` *(#"+leaderboard[0]+")*\n**Messages Sent:** `"+dk.messagesSent+"` *(#"+leaderboard[1]+")*\n**Special Tokens:** `"+dk.special+"` *(#"+leaderboard[2]+")* \n\n**User Rating:** `"+(dk.staffCredits != null ? (dk.staffCredits > 0 ? `+${dk.staffCredits}` : dk.staffCredits) : 0)+"` "+((leaderboard[3] != null) ? "*(#"+(leaderboard[3] != null ? leaderboard[3] : "")+")*" : "")+" \n**Total Strikes:** `"+(dk.strikes != null ? dk.strikes : 0)+"`";

        if(isLocked(user.id)) type = { colour: "DARK_RED", name: "Locked Wallet", chance: 0}

        // reply
        embed = new MessageEmbed()
            .setColor(type.colour)
            .setTitle(type.name)
            .setAuthor({name:user.tag, iconURL:user.displayAvatarURL()})
			.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
            .setDescription(string)

        if(type.chance > 0) embed.setFooter({ text: `${type.chance}% chance to earn double coins!` });

        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}econinfo`) {
        embed = new MessageEmbed()
            .setColor('ORANGE')
			.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
            .setTitle(`Economy Info`)
            .setDescription("Current earnings: `"+economy.minimumCoins+"-"+economy.maxiumumCoins+" Coins per minute`\nCurrent Bonuses: `N/A`")
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}quests`) {

        count = fs.existsSync(`./data/quests/${message.author.id}.json`) ? JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`)).messages.count : 0;

        embed = new MessageEmbed()
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setColor('ORANGE')
			.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
            .setTitle(`Your Available Quests`)
            .setDescription((count >= 1000 ? "~~": "") + "`Send 1000 Messages`"+ (count >= 1000 ? "~~": "") + "\n+250 Coins, +2 User Rating \n\n"+(count >= 500 ? "~~": "") + "`Send 500 Messages`"+ (count >= 500 ? "~~": "") + "\n+100 Coins, +1 User Rating")
        message.channel.send({embeds:[embed]});
    }
    /* if(msg == `${prefix}claim`) {

        count = fs.existsSync(`./data/quests/${message.author.id}.json`) ? JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`)).messages.count : 0;
        claimed = fs.existsSync(`./data/quests/${message.author.id}.json`) ? JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`)).messages.claimed : false;

        if(claimed == true) {
            embed = new MessageEmbed()
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setColor('DARK_RED')
			.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
                .setDescription(`You have already claimed. Try again with tomorrow's quest.`)
            message.channel.send({embeds:[embed]});
            return
        }
        if(count < 1000) {
            embed = new MessageEmbed()
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setColor('DARK_RED')
                .setDescription(`You have no completed quests to claim rewards from.`)
            message.channel.send({embeds:[embed]});
            return
        }

        embed = new MessageEmbed()
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setColor('ORANGE')
            .setDescription(`You claimed 200 coins.`)
        message.channel.send({embeds:[embed]});

        data = JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`));
        data.messages.claimed = true;
        fs.writeFileSync(`./data/quests/${message.author.id}.json`, JSON.stringify(data, null, 4));

        d = get(message.author.id);
        if(!isLocked(message.author.id)) d.balance += 200;
        set(message.author.id, d);
    } */
    if(msg == `${prefix}inventory`) {
        embed = new MessageEmbed()
            .setColor('DARK_BLUE')
            .setAuthor({ name: `${message.author.username}'s Inventory`, iconURL: message.author.displayAvatarURL() })
            .setDescription(`Inventory is empty.`)
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}help`) {
        embed = new MessageEmbed()
            .setColor('ORANGE')
			.setThumbnail('https://file.coffee/u/F-OHD005k7EetL.gif')
            .setTitle(`Commands Summary`)
            .addField(`${prefix}pay amount @user @user`, `Allows users to send coins to other users.`)
            .addField(`${prefix}top`, `Displays the 10 richest users.`)
            .addField(`${prefix}rtop`, `Shows the 10 users with highest rep.`)
            .addField(`${prefix}wallet OR ${prefix}w @user`, `Allows you to view the wallet of yourself or others.`)
            .addField(`${prefix}econinfo`, `Displays the current configurations of the economy.`)
            .addField(`${prefix}quests`, `Shows your daily progress on todays quest.`)
            .addField(`${prefix}fight @user bet`, `Allows you to fight other users!`)
            .addField(`${prefix}rep @user <+/-> <reason>`, `Allows you comment on another user.`)
            .addField(`${prefix}inventory`, `Displays the contents of your inventory.`)

        message.channel.send({embeds:[embed]});
    }
});

// Login
client.login(token);
