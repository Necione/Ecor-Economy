# Ecor Economy Discord Bot 🚀

Ecor economy is an advanced, simple and easy to use Discord bot that includes a clean interface! We supply many different features most economy bots lack, such as **auctions, quests, user rating, etc.**

This bot is still in __beta__ and will be released when all features and bugs are tested and fixed!

You can currently see the bot in action in the [Shrivel Discord](https://discord.gg/shrivel).

## Functions 🍂
- Advanced economy system based on messages sent per minute. A user must send a minimum of 3 messages in 60 seconds to get a random amount of coins (5-15)
- User wallet tiers and systems. Your members can check their balance, pay eachother, and make money through talking!
- Daily quests system using messages. Your members can earn reputation through completeing message-requirement quests daily!
- Mini-RPG. Your members can buy and harvest crops to make extra money!

## Usage 🛠️
Pre-Installation: 
1. Create a Discord Bot @ https://discord.com/developers/applications
2. Check all "Privileged Gateway Intents" (found under the Bot tab)
3. Copy the bot token and invite bot to server using https://scarsz.me/authorize

Bot Installation:
1. Download all files and extract ZIP into new folder.
2. Modify config.json in data to your liking (ensure everything is filled)
(To grab channel and role IDs, make sure to enable developer mode!)
4. Install a process manager such as PM2
```
npm install pm2 -g
```
4. Start the program using PM2
```
pm2 start index.js --name "Discord Bot"
```

## Credits ⭐
`@Neci#0627` - Creating the main functions of bot, updates, etc.

`@kiro 殺す#3080` - Bot hosting, backend, updates, etc.

`@H4RB0R#6393` - Quality Assurance
