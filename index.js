// Packages
const fs = require('fs');
const rn = require('random-number');
const CronJob = require('cron').CronJob;
const { Client, Intents, MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');
const client = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_PRESENCES
]});

// Config
const cronTimezone = 'America/Los_Angeles';
const { token, economy, prefix, adminRole, images, images2, adminRole1, status, repChannel, storeItems } = require('./data/config.json');
const config = require('./data/config.json')
let chatters = []; // holds the IDs of people sending messages
let rewarded = []; // hold IDs of people who have recieved coins for that minute
let lastEvent = 999; // unix date of when the last event took place

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
    let job = new CronJob('1 * * * * *', function() {
        rewarded = [];
    }, null, true, cronTimezone);
    job.start();

    // reset quests at midnight
    let job1 = new CronJob('1 0 0 * * *', function() {
        files = fs.readdirSync(`./data/quests/`);
        files.forEach(file => fs.unlinkSync(`./data/quests/${file}`));
    }, null, true, cronTimezone);
    job1.start();
});
client.on('interactionCreate', async interaction => {

    if(interaction.isCommand()) return;

    const addedRoles = []
    const removedRoles = []

    interaction.values.forEach(value => {

        let obj = null;

        config.rroles.roles.forEach(role => {
            if(role.text === value){
                obj = role
            }
        })

        if(obj !== null){

            const rRole = interaction.guild.roles.cache.find(r => r.id === obj.roleID)

            if(rRole){

                if(!interaction.member._roles.includes(rRole.id)){
                    interaction.member.roles.add(rRole.id)
                    addedRoles.push(rRole)
                }

            }

        }

    })

    config.rroles.roles.forEach(role => {
        if(!interaction.values.includes(role.text)){
            const rRole = interaction.guild.roles.cache.find(r => r.id === role.roleID)

            if(rRole){

                if(interaction.member._roles.includes(rRole.id)){
                    interaction.member.roles.remove(rRole.id)
                    removedRoles.push(rRole)
                }

            }
        }
    })

    let reply = []

    if(addedRoles.length){
        reply.push(`**Added Roles:** ${addedRoles.join(' ')}`)
    }
    if(removedRoles.length){
        reply.push(`**Removed Roles:** ${removedRoles.join(' ')}`)
    }

    interaction.reply({content: `${reply.join('\n') || ' '}`, ephemeral: true})


})
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
    if(message.channel.id == economy.channel) {
        if(fs.existsSync(`./data/quests/${message.author.id}.json`)) {
            xx = JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`));
    
            if(xx.messages.count >= 1000 && xx.messages.claimed == false) {
                xx.messages.claimed = true;
    
                yy = get(message.author.id);
                if(!isLocked(message.author.id)) yy.balance += 750;
                if(!yy.staffCredits) yy.staffCredits = 0;
                yy.staffCredits += 1;
                set(message.author.id, yy);
            } else if(xx.messages.count >= 500 && xx.messages.claimed1 == false) {
                xx.messages.claimed1 = true;
    
                yy = get(message.author.id);
                if(!isLocked(message.author.id)) yy.balance += 250;
                if(!yy.staffCredits) yy.staffCredits = 0;
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
                    claimed: false, // 1000 messages (250 coins, 1 rep)
                    claimed1: false // 500 messages (100 coins, 1 rep)
                }
            }, null, 4));
        }
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
            btm = dxx.staffCredits >= 75 
            ? 20
            : (dxx.staffCredits >= 30) 
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
    if(message.channel.id == economy.channel && (lastEvent < Date.now() - (1000*60*30)) && chatters.filter(t => t != null).length >= 5) {

        // stop further
        lastEvent = Date.now();

        // decide game
        xxx = rn({ min: 1, max: 4, intesger: true });

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
                    dz.balance -= 50;
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
                dz.balance -= 50;
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
                .setTitle(`⭐ Random Event | The Typing Test`)
                .setImage(word.image)
                .setDescription(`Type the sentence quickly to earn 50 coins!`)
                .setFooter({text:`First to finish typing wins!`})
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
                dz.balance += 50;
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

            const filter = m => !isNaN(m.content) && !m.author.bot && m.content != '' && !m.attachments.first();
            const collector = message.channel.createMessageCollector({ filter, });
            collector.on('collect', m => {

                if(last == m.author.id || parseInt(m.content) == no || parseInt(m.content) != (no + 1)) {
                    fail = true;
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
                        dz.balance += 50;
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

        // name the location
        if(xxx == 4) {

            word2 = images2[rn({
                min: 0,
                max: images2.length -1,
                integer: true
            })];

            embed = new MessageEmbed()
                .setColor('ORANGE')
                .setTitle(`⭐ Random Event | Name the Location`)
                .setImage(word2.image2)
                .setDescription(`Type the name of this image to win 50 coins`)
                .setFooter({text:`The fastest reply wins`})
            message.channel.send({embeds:[embed]});

            const filter = m => m.content.toLowerCase() == word2.word2.toLowerCase();
            const collector = message.channel.createMessageCollector({ filter, max: 1 });
            collector.on('collect', m => {
    
                embed = new MessageEmbed()
                    .setColor('ORANGE')
                    .setTitle(`Game over!`)
                    .setDescription(`<@${m.author.id}> answered first - they won 50 coins!`)
                message.channel.send({embeds:[embed]});

                dz = get(m.author.id);
                dz.balance += 50;
                set(m.author.id, dz);
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
        da.balance = 0;
        set(message.mentions.users.first().id, da);

        // reply
        embed = new MessageEmbed()
            .setColor('33FF4C')
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
            .setColor('33FF4C')
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
            .setColor('33FF4C')
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
            .setColor('33FF4C')
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
            .setColor('33FF4C')
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
            .setColor('33FF4C')
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
                .setColor('33FF4C')
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
            .setColor('33FF4C')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setDescription(`Success. Special tokens have been given.`)
        message.channel.send({embeds:[embed]});
    }

    // user commands
   	if(msg.startsWith(`${prefix}pay`)) {

        // correct usage?
        if(!message.mentions.users.first() || message.mentions.users.first().id == message.author.id || isNaN(md[2]) || md[2] < 0 || md[2] == '') {
            embed = new MessageEmbed()
                .setColor('FFBB33')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Incorrect command usage. E.g. ${prefix}pay <@user> <amount>`)
                .setThumbnail('https://file.coffee/u/C_j6DpCgTR34mOSpaqpd5.png')
                .setFooter({text:`Please note, you CANNOT pay yourself.`})
            return message.channel.send({embeds:[embed]});
        }

        // afford?
        if(md[2] > get(message.author.id).balance) {
            embed = new MessageEmbed()
                .setColor('FF3333')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setThumbnail('https://file.coffee/u/CWanwcFihzRKWMyxp8g5p.png')
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
            .setColor('B65FFF')
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setThumbnail('https://file.coffee/u/QgGkRW34pBz129RLRTus-.png')
            .setDescription("Transferring `"+parseInt(md[2])+" coins`\n"+`<@${message.author.id}> → <@${message.mentions.users.first().id}>\nPlease type **${code}** to confirm this transaction`)
        message.channel.send({embeds:[embed]});

        // await response
        const filter = m => m.content == `${code}` && m.author.id == message.author.id
        const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        // valid response
        collector.on('collect', m => {

            // update JSON
            dy = get(message.author.id);
            if(!isLocked(message.author.id)) dy.balance -= parseInt(md[2]);
            set(message.author.id, dy);

            du = get(message.mentions.users.first().id);
            if(!isLocked(message.mentions.users.first().id)) du.balance += parseInt(md[2]);
            set(message.mentions.users.first().id, du);

            // reply
            embed = new MessageEmbed()
                .setColor('33FF4C')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setThumbnail('https://file.coffee/u/x6Pfjxf-pI3PjCMTAIL3r.png')
                .setDescription("Transaction completed! `"+parseInt(md[2])+" coins`\n"+`<@${message.author.id}> → <@${message.mentions.users.first().id}>`)
            message.channel.send({embeds:[embed]});
        });

        // no valid response?
        collector.on('end', collected => {
            if(collected.size == 0) {
                embed = new MessageEmbed()
                    .setColor('FF3333')
                    .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                    .setThumbnail('https://file.coffee/u/CWanwcFihzRKWMyxp8g5p.png')
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
            temp = `${raw[i].position}) ${raw[i].username} - ${raw[i].count} Coins`;
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
        console.log(pages);

        embed = new MessageEmbed()
            .setColor('B65FFF') 
            .setAuthor({ name: `Leaderboard - Top 10`, iconURL: message.guild.iconURL() })
            .setDescription(pages[0])
        message.channel.send({embeds: [embed]});
    }
    if(md[0].toLowerCase() == `${prefix}w` || md[0].toLowerCase() == `${prefix}wallet`) {

        // collect data
        user = message.mentions.users.first() ? message.mentions.users.first() : message.author;
        leaderboard = lb(user.id);
        dk = get(user.id);

        if(!dk.staffCredits) dk.staffCredits = 0;
        type = dk.staffCredits >= 30 
        ? { colour: "BLUE", name: "`💷` __Platinum__ Shrivel Wallet", chance: 50 }
        : (dk.staffCredits >= 20) 
        ? { colour: "GOLD", name: "`💵` __Gold__ Shrivel Wallet", chance: 25 }
        : (dk.staffCredits >= 10)
        ? { colour: "WHITE", name: "`💶` __Iron__ Shrivel Wallet", chance: 10 }
        : { colour: "#CD7F32", name: "`💴` __Bronze__ Shrivel Wallet", chance: 0 }
        string = "> **Current Balance:** `"+dk.balance+" Coins` *(#"+leaderboard[0]+")*\n> **Messages Sent:** `"+dk.messagesSent+"` *(#"+leaderboard[1]+")*\n> **Special Tokens:** `"+dk.special+"` *(#"+leaderboard[2]+")* \n\n> **User Rating:** `"+(dk.staffCredits != null ? (dk.staffCredits > 0 ? `+${dk.staffCredits}` : dk.staffCredits) : 0)+"` "+((leaderboard[3] != null) ? "*(#"+(leaderboard[3] != null ? leaderboard[3] : "")+")*" : "")+" \n> **Total Strikes:** `"+(dk.strikes != null ? dk.strikes : 0)+"`";

        if(isLocked(user.id)) type = { colour: "DARK_RED", name: "`🔒` Locked Shrivel Wallet", chance: 0}

        // reply
        embed = new MessageEmbed()
            .setColor(type.colour)
            .setTitle(type.name)
			.setThumbnail(user.displayAvatarURL())
            .setDescription(string)

        if(type.chance > 0) embed.setFooter({ text: `${type.chance}% chance to earn double coins!` });

        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}econinfo`) {
        embed = new MessageEmbed()
            .setColor('B65FFF')
			.setThumbnail('https://file.coffee/u/jHfDGnnLgQ7n4xzViF3bE.png')
            .setTitle(`Economy Info`)
            .setDescription("Current earnings: `"+economy.minimumCoins+"-"+economy.maxiumumCoins+" Coins per minute`\nCurrent Bonuses: `N/A`")
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}quests`) {

        count = fs.existsSync(`./data/quests/${message.author.id}.json`) ? JSON.parse(fs.readFileSync(`./data/quests/${message.author.id}.json`)).messages.count : 0;

        embed = new MessageEmbed()
            .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
            .setColor('B65FFF')
			.setThumbnail('https://file.coffee/u/jHfDGnnLgQ7n4xzViF3bE.png')
            .setTitle(`Your Available Quests`)
            .setDescription((count >= 1000 ? "~~": "") + "`Send 1000 Messages`"+ (count >= 1000 ? "~~": "") + " ["+count+"/1000]\n+750 Coins, +1 User Rating \n\n"+(count >= 500 ? "~~": "") + "`Send 500 Messages`"+ (count >= 500 ? "~~": "") + " ["+count+"/500]\n+250 Coins, +1 User Rating")
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}inventory`) {
        embed = new MessageEmbed()
            .setColor('5F99FF')
            .setAuthor({ name: `${message.author.username}'s Inventory`, iconURL: message.author.displayAvatarURL() })
            .setDescription(`Inventory is empty.`)
        message.channel.send({embeds:[embed]});
    }
    if(msg == `${prefix}help`) {
        embed = new MessageEmbed()
            .setColor('B65FFF')
			.setThumbnail('https://file.coffee/u/jHfDGnnLgQ7n4xzViF3bE.png')
            .addField(`List of Main Commands`, "`?pay {AMOUNT} {@} {@}` Allows users to send coins to other users\n`?top` Displays the top 10 richest users\n`?wallet OR ?w {@}` Displays your or another user's wallet\n`?econinfo` Displays the current economy configuration\n`?quests` Display your current progress on your quests")
            .addField(`List of Farm Commands`, "`?farm` Displays your plants, along with your storage\n`?farmstore` Displays the crops you can purchase\n`?buy <ITEM> <AMOUNT>` Purchase something from the farm store\n`?plant <ITEM> <1-5>` Plant a crop in your farm\n`?water <1-5>` Water a crop, crops will die if they aren't watered in 6 hours\n`?sell <1-5>` Sell a crop that is ready for harvest\n`?destroy {#}` Destroys a crop on the farm")
            .addField(`List of Extra Commands`, "`?plsexplain` Sends a message explainaing the server\n`?halloffame` Displays some vouches from well known people")
        message.channel.send({embeds:[embed]});
    }

    // farm system
    if(msg == `${prefix}farmstore`) {

        // load items
        items = storeItems.map(t => "`"+ t.emoji +"` **"+t.name+":** "+t.price+" Coins\n*Watering Required:* `"+t.wateringRequired+" Times`")

        // display
        embed = new MessageEmbed()
            .setTitle(`The Farm Store`)
            .setColor('33FF4C')
            .setDescription(items.join("\n\n"))
            .addField(`Crop Quality`, "`-` Super Good Quality sells for +20% coins from the original price.\n`-` Good Quality sells for +10% coins from the original price.\n`-` Bad Quality sells for -10% coins from the original price.")
        message.channel.send({ embeds: [embed] });
    }
    if(md[0].toLowerCase() == `${prefix}buy`) {

        // locked?
        if(isLocked(message.author.id)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`Your wallet is locked. You cannot use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // wrong usage?
        if(!md[1]) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Incorrect command usage. E.g. ${prefix}buy <item> <amount>`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // process input
        item = {
            name: md.slice(1).join(" "),
            quantity: 1
        }
        if(!isNaN(md[md.length - 1])) {
            item.name = md.slice(1, -1).join(" ");
            item.quantity = parseInt(md[md.length - 1]);
        }

        // item found?
        if(!storeItems.filter(t => t.name.toLowerCase() == item.name.toLowerCase())[0]) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("`"+item.name+"` could not be found.")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }
        itemFound = storeItems.filter(t => t.name.toLowerCase() == item.name.toLowerCase())[0];

        // afford?
        if(item.quantity * itemFound.price > get(message.author.id).balance) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("You cannot afford to pay `"+item.quantity * itemFound.price+" coins`")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // add to json
        if(fs.existsSync(`./data/farm/${message.author.id}.json`)) {
            data = JSON.parse(fs.readFileSync(`./data/farm/${message.author.id}.json`));
            for(i = 0; i < item.quantity; i++) { data.purchased.push(itemFound); }
            for(i = 0; i < data.purchased.length; i++) { data.purchased[i].wateringComplete = 0; data.purchased[i].lastWatered = null };
            fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(data, null, 4));
        } else {
            temp = {
                id: message.author.id,
                farm: [null, null, null, null, null],
                purchased: []
            }
            for(i = 0; i < item.quantity; i++) { temp.purchased.push(itemFound); }
            for(i = 0; i < temp.purchased.length; i++) { temp.purchased[i].wateringComplete = 0; temp.purchased[i].lastWatered = null };
            fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(temp, null, 4));
        }

        // subtract from balance
        b = get(message.author.id);
        b.balance -= item.quantity * itemFound.price;
        set(message.author.id, b);

        // reply
        embed = new MessageEmbed()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setColor('33FF4C')
            .setDescription(`Successfully purchased!\n${item.quantity}x `+"`"+itemFound.emoji+" "+itemFound.name+"` for **"+itemFound.price * item.quantity+" Coins**")
        message.channel.send({ embeds: [embed] });
    }
    if(md[0].toLowerCase() == `${prefix}farm`) {

        // user
        user = message.mentions.users.first() ? message.mentions.users.first() : message.author;

        // load data
        data = {
            id: message.author.id,
            harvested: 0,
            farm: [null, null, null, null, null],
            purchased: []
        }
        if(fs.existsSync(`./data/farm/${user.id}.json`)) data = JSON.parse(fs.readFileSync(`./data/farm/${user.id}.json`));

        // good quality?
        if(data.harvested >= 25 && data.farm.length != 6) data.farm.push(null);

        // check dates
        for(i = 0; i < data.farm.length; i++) {
            if(data.farm[i] != null) {
                if(data.farm[i].lastWatered != null && data.farm[i].wateringRequired != data.farm[i].wateringComplete && data.farm[i].lastWatered < (Date.now() - (1000*60*60*5))) {
                    data.farm[i] = null;
                }
            }
        }
        fs.writeFileSync(`./data/farm/${user.id}.json`, JSON.stringify(data, null, 4));

        // process
        farm = data.farm.map(t => (t == null) ? "`🛑` **Empty**" : ("`"+t.emoji+"` **"+t.plantName+"**"+`${t.wateringComplete == t.wateringRequired ? ` Ready for harvest!` : (t.wateringRequired < t.wateringComplete ? " Overwatered!" : ` - Watered ${t.wateringComplete}/${t.wateringRequired} times`) }`));
        storage = data.purchased.map(t => "`"+t.emoji+"` **"+t.name+"**");

        storage = [];
        for(i in data.purchased) {
            if(!storage.filter(t => t.name == data.purchased[i].name)[0]) {
                storage.push({ name: data.purchased[i].name, emoji: data.purchased[i].emoji, number: 1 });
            } else {
                for(x in storage) {
                    if(storage[x].name == data.purchased[i].name) storage[x].number += 1;
                }
            }
        }
        storage = storage.map(t => "`"+t.emoji+"`"+` ${t.name} x${t.number}`);

        // display
        embed = new MessageEmbed()
            .setColor('ORANGE')
            .setAuthor({ iconURL: user.displayAvatarURL(), name: `${user.tag}` })
            .setDescription(`**Harvested:** ${data.harvested != null ? data.harvested : 0} crops`)
            .addField(`Farm`, farm.join("\n"))
            .addField(`Storage`, storage.length == 0 ? `No seedlings to plant!` : storage.join("\n"))
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}plant`) {

        // wrong usage?
        if(!md[1] || isNaN(md[md.length - 1]) || md[md.length - 1] < 1 || md[md.length - 1] > 6) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Incorrect command usage. E.g. ${prefix}plant <item> <slot 1-5>`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // process input
        item = {
            name: md.slice(1, -1).join(" "),
            slot: parseInt(md[md.length - 1])
        }

        // has item? (no file)
        if(!fs.existsSync(`./data/farm/${message.author.id}.json`)) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("`"+item.name+"` could not be found in your farm storage.")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // load data
        data = JSON.parse(fs.readFileSync(`./data/farm/${message.author.id}.json`));

        // has item? (file)
        if(!data.purchased.filter(t => t.name.toLowerCase() == item.name.toLowerCase())[0]) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("`"+item.name+"` could not be found in your farm storage.")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }   

        // slot taken?
        if(data.farm[item.slot - 1] != null) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("`Slot "+item.slot+"` is in-use or is unavailable. You can only plant in an empty slot.")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // storage -> slot
        mover = null;
        for(i = 0; i < data.purchased.length; i++) {
            if(data.purchased[i].name.toLowerCase() == item.name.toLowerCase()) {
                mover = data.purchased[i]; // for use in the reply later on
                data.farm[item.slot - 1] = data.purchased[i];
                delete data.purchased[i];
                data.purchased = data.purchased.filter(t => t != null);
                break;
            }
        }
        fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(data, null, 4));

        // reply
        embed = new MessageEmbed()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription("`"+mover.name+"` have been planted. Remember to water every 3 hours!")
            .setColor('33FF4C')
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}water`) {

        // wrong usage?
        if(md[1] < 1 || md[1] > 6) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Incorrect command usage. E.g. ${prefix}water <slot 1-5>`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // process input
        slot = parseInt(md[1]) - 1;

        // anything planted?
        if(!fs.existsSync(`./data/farm/${message.author.id}.json`)) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // load data
        data = JSON.parse(fs.readFileSync(`./data/farm/${message.author.id}.json`));

        // anything planted?
        if(data.farm[slot] == null) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }   

        // not been 3 hours?
        if(data.farm[slot].lastWatered != null && data.farm[slot].lastWatered > (Date.now() - (1000*60*60*3))) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`You watered this plant too recently! Try again in ${Math.floor((data.farm[slot].lastWatered - (Date.now() - (1000*60*60*3))    ) / (1000*60))} minute(s).`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // storage -> slot
        data.farm[slot].lastWatered = Date.now();
        data.farm[slot].wateringComplete += 1;
        fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(data, null, 4));

        // reply
        embed = new MessageEmbed()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription("Watered!")
            .setColor('33FF4C')
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}sell`) {

        // wrong usage?
        if(md[1] < 1 || md[1] > 5) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Incorrect command usage. E.g. ${prefix}sell <slot 1-5>`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // process input
        slot = parseInt(md[1]) - 1;

        // anything planted?
        if(!fs.existsSync(`./data/farm/${message.author.id}.json`)) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // load data
        data = JSON.parse(fs.readFileSync(`./data/farm/${message.author.id}.json`));

        // anything planted?
        if(data.farm[slot] == null) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }   

        // ready to harvest?
        if(data.farm[slot].wateringComplete != data.farm[slot].wateringRequired) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`This plant isn't ready to harvest.`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // storage -> slot
        chance = rn({min:0, max: 100, integer: true});

        type = null;
        if(chance >= 95) {
            type = { name: `Super Good Quality`, value: Math.floor(data.farm[slot].price * 1.2) };
        } else if(chance > 20) {
            type = { name: `Good Quality`, value: Math.floor(data.farm[slot].price * 1.1) }
        } else {
            type = { name: `Bad Quality`, value: Math.floor(data.farm[slot].price * 0.9) };
        }

        if(data.farm[slot].wateringComplete > data.farm[slot].wateringRequired) {
            type = { name: `Bad Quality`, value: Math.floor(data.farm[slot].price * 0.9) };
        }

        data.farm[slot] = null;
        fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(data, null, 4));

        // update balance
        data = get(message.author.id);
        data.balance += type.value;
        set(message.author.id, data);

        // reply
        embed = new MessageEmbed()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(`Sold! Your plant was deemed as **${type.name}** and was sold for **${type.value}** coins.`)
            .setColor('33FF4C')
        message.channel.send({embeds:[embed]});
    }
    
    // clients attempt
    if(md[0].toLowerCase() == `${prefix}destroy`) {

        // wrong usage?
        if(!md[1] || md[1] < 1 || md[1] > 6) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`Incorrect command usage. E.g. ${prefix}destroy <slot 1-5>`)
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // process input
        slot = parseInt(md[1]) - 1;

        // anything planted?
        if(!fs.existsSync(`./data/farm/${message.author.id}.json`)) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }

        // load data
        data = JSON.parse(fs.readFileSync(`./data/farm/${message.author.id}.json`));

        // anything planted?
        if(data.farm[slot] == null) {
            embed = new MessageEmbed()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription("Nothing is planted in `slot "+(slot + 1)+"`!")
                .setColor('DARK_RED')
            message.channel.send({embeds:[embed]});
            return
        }  

        // storage -> slot
        data.farm[slot] = null;
        fs.writeFileSync(`./data/farm/${message.author.id}.json`, JSON.stringify(data, null, 4));

        // reply
        embed = new MessageEmbed()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription("Plant has been destroyed!")
            .setColor('33FF4C')
        message.channel.send({embeds:[embed]});
    }
        if(md[0].toLowerCase() == `${prefix}s`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // reply
        embed = new MessageEmbed()
            .setColor('33FF4C')
            .setTitle(`Payment has been completed!`)
			.setThumbnail('https://file.coffee/u/Keot0DUr9XUQ2XfloKUka.png')
            .setDescription(`Your order will be deliverd as soon as possible. Please refrain from talking in this ticket any further. If you have any questions, please let the staff member that claimed this ticket know.`)
        message.channel.send({embeds:[embed]});
    }
    
        if(md[0].toLowerCase() == `${prefix}cc`) {

        // admin?
        if(!message.member.roles.cache.has(adminRole)) {
            embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        // reply
        embed = new MessageEmbed()
            .setColor('YELLOW')
            .setTitle(`Congratulations! Your product has been delivered!`)
			.setThumbnail('https://file.coffee/u/16yLU-8q0n0aIkTYQ8yro.webp')
            .setDescription(`Ensure that you have received your product and leave a vouch in the vouch channel, as it would help us a lot. This ticket will be manually closed after your vouch has been checked over. If you have any questions regarding your purchase, please create a new ticket.`)
        message.channel.send({embeds:[embed]});
    }
    
    if(md[0].toLowerCase() == `${prefix}plsexplain`) {

        // reply
        embed = new MessageEmbed()
            .setColor('YELLOW')
            .setTitle(`hello there new member and welcome to shrivel`)
            .setDescription(`You talk to earn coins, you use coins to buy stuff - that is literally it. We do events and tournamenets sometimes, check vouch channel if you are unsure of our legitemancy. Use the command **?w** to check your balance in bot commands, check out the server store channel to see what you can buy. Please just take a look at the guidebook and you'll understand this server k have a good day`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}halloffame`) {

        // reply
        embed = new MessageEmbed()
            .setColor('YELLOW')
            .setTitle(`Vouches from pretty well known people`)
			.setThumbnail('https://file.coffee/u/16yLU-8q0n0aIkTYQ8yro.webp')
            .setDescription(`**BedlessNoob** - https://prnt.sc/rDlX_ZKcqK14\n**Divinah** - https://prnt.sc/tsHrGHrQ4zmk\n**NoSDaemon** - https://prnt.sc/SKnLtC_F4DBc\n**GandalfSwagInc** - https://prnt.sc/Zofgrq5atigG`)
        message.channel.send({embeds:[embed]});
    }
    if(md[0].toLowerCase() == `${prefix}slaves`) {

        // reply
        embed = new MessageEmbed()
            .setColor('YELLOW')
            .setTitle(`Jane Donaldson`)
            .setDescription("Currently Owned By: `mafoo#2792`\nHealth Status: `Good Condition`\nTotal Crops Harvested: `0 Crops`")
        message.channel.send({embeds:[embed]});
    }
    if(message.content.toLowerCase() === `${prefix}rpanel`){

        if(!message.member.roles.cache.has(adminRole) && !message.member.roles.cache.has(adminRole1)) {
            const embed = new MessageEmbed()
                .setColor('DARK_RED')
                .setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()})
                .setDescription(`You must be a member of staff to use this command.`)
            return message.channel.send({embeds:[embed]});
        }

        if(config.rroles.roles.length < 2) return message.channel.send('You must have 2 roles set up in config to spawn in the reaction panel!')
        
        // reaction role panel posting goes here

        const embed = new MessageEmbed()
        .setTitle(config.rroles.title)
        .setColor(config.rroles.color)

        const rRoles = []
        const dropDown = []

        config.rroles.roles.forEach(role => {
            rRoles.push(`${role.emoji}  **${role.text}**`)
            dropDown.push(
                {
                    label: `${role.text}`,
                    description: `${role.description}`,
                    value: `${role.text}`,
                    emoji: `${role.emoji}`
                }
            )
        })

        const row = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
            .setCustomId('rpanel')
            .setPlaceholder(`${config.rroles.roleFill}`)
            .setMinValues(0)
            .setMaxValues(dropDown.length)
            .addOptions([
                dropDown
            ])
        )
        
        embed.setDescription(`${config.rroles.description}\n\n${rRoles.join('\n')}`)

        message.channel.send({embeds: [embed], components: [row]})

    }
});

// Login
client.login(token);
