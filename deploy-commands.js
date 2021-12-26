const fs = require('fs');
const { Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const { clientId, guildId, token } = require('./config.json');
const Logger = require('./services/logger');

// Commands
const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

async function deployCommands() {
  const commands = new Collection();
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // filter only files with .data and .permissions,
    if (!('data' in command) || !('permissions' in command)) {
      continue;
    }
    // compute slash command data and permissions (using config)
    if (typeof command.computeData === 'function') {
      command.computeData();
    }
    if (typeof command.computePermissions === 'function') {
      command.computePermissions();
    }
    // add to the list
    commands.set(command.name, command);
  }
  if (commands.size === 0) {
    Logger.info('No application command to save.');
    return;
  }

  // Create or update commands
  let responseCommands = null;
  const commandsData = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: '9' }).setToken(token);
  try {
    responseCommands = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandsData,
    });
    Logger.info('Successfully registered application commands.');
  } catch (error) {
    Logger.error(error);
    return;
  }

  // Create a matching with commands identifiers
  const commandsIdMatching = new Collection();
  for (const command of responseCommands) {
    commandsIdMatching.set(command.name, command.id);
  }

  // Overwrite permissions
  const newPermissions = commands.map((command) => ({
    id: commandsIdMatching.get(command.name),
    permissions: command.permissions,
  }));

  try {
    await rest.put(Routes.guildApplicationCommandsPermissions(clientId, guildId), {
      body: newPermissions,
    });
    Logger.info('Successfully updated application commands permissions.');
  } catch (error) {
    Logger.error(error);
  }
}

deployCommands();
