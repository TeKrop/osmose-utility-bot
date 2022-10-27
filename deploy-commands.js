const fs = require('fs');
const { Collection, REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const Logger = require('./services/logger');

// Commands
const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));
const commands = new Collection();
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  // filter only files with .data
  if (!('data' in command)) {
    continue;
  }
  // compute slash command data (using config)
  if (typeof command.computeData === 'function') {
    command.computeData();
  }
  // add to the list
  commands.set(command.name, command);
}
if (commands.size === 0) {
  Logger.info('No application command to save.');
  process.exit();
}

// Create or update commands
const commandsData = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

// Deploy commands
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandsData,
    });
    Logger.info('Successfully registered application commands.');
  } catch (error) {
    Logger.error(error);
  }
})();
