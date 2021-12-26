const { Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

// Commands
const massmoveCommand = require('./commands/massmove');
const abstractChanCommand = require('./commands/chan');

const chanCommand = { ...abstractChanCommand, name: 'chan' };
const owChanCommand = { ...abstractChanCommand, name: 'owchan' };


async function createCommands() {
	let commandsFiles = new Collection([
	  [massmoveCommand.name, massmoveCommand],
	]);
	commandsFiles = commandsFiles.each(command => command.computePermissions());

	//const commandsFiles = [chanCommand, owChanCommand, massmoveCommand];

	const commands = commandsFiles.map(command => command.data.toJSON());
	let responseCommands = null;

	// Create or update commands
	const rest = new REST({ version: '9' }).setToken(token);
	try {
		responseCommands = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
		console.log('Successfully registered application commands.');
	} catch (error) {
		console.error(error);
		return;
	}

	// Create a matching with commands identifiers
	const commandsIdMatching = new Collection();
	for (const command of responseCommands) {
		commandsIdMatching.set(command.name, command.id);
	}

	// Overwrite permissions
	const newPermissions = commandsFiles.map(command => {
		return {
			id: commandsIdMatching.get(command.name),
			permissions: command.permissions
		}
	});

	try {
		await rest.put(Routes.guildApplicationCommandsPermissions(clientId, guildId), { body: newPermissions });
		console.log('Successfully updated application commands permissions.');
	} catch (error) {
		console.error(error);
		return;
	}
}

createCommands();