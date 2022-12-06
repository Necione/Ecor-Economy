// Packages
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Config
const { token } = require('./config.json');

// Export
module.exports = {
    async run(client) {
        
        // Form the commands
        commands = [
            new SlashCommandBuilder()
                .setName(`pay`)
                .setDescription(`Pay another user.`)
                .addUserOption(option => option.setRequired(true).setName('user').setDescription('The user.'))
                .addIntegerOption(option => option.setRequired(true).setName('amount').setDescription('The amount.')),
            new SlashCommandBuilder()
                .setName(`top`)
                .setDescription(`Display the leaderboard.`),
            new SlashCommandBuilder()
                .setName(`wallet`)
                .setDescription(`View your wallet.`)
                .addUserOption(option => option.setRequired(false).setName('user').setDescription('The user.')),
            new SlashCommandBuilder()
                .setName(`w`)
                .setDescription(`View your wallet.`)
                .addUserOption(option => option.setRequired(false).setName('user').setDescription('The user.')),
            new SlashCommandBuilder()
                .setName(`econinfo`)
                .setDescription(`View the economy information.`),
            new SlashCommandBuilder()
                .setName(`quests`)
                .setDescription(`View your available quests.`)
        ].map(command => command.toJSON());
        
        // Set API version & Token
        rest = new REST({ version: '9' }).setToken(token);

        // Push commands
        await rest.put(
			Routes.applicationCommands(client.user.id),
			{ body: commands },
		)
    }
}