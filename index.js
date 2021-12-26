const BOT_VERSION = '2.0';

// Load some necessary files
const { Client, Collection, Intents } = require('discord.js');
const Config = require('./config.json');

const Constants = require('./constants/index.json');
const Logger = require('./services/logger');
const Message = require('./services/message');
const CustomStatus = require('./services/customStatus');

// Commands
const massmoveCommand = require('./commands/massmove');
const watcherCommand = require('./commands/watcher');
const abstractChanCommand = require('./commands/chan');

const chanCommand = { ...abstractChanCommand, name: 'chan' };
const owChanCommand = { ...abstractChanCommand, name: 'owchan' };

// Basic initialisation
const intents = [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_INVITES,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_PRESENCES,
  Intents.FLAGS.GUILD_VOICE_STATES,
];
const client = new Client({ intents });
client.commands = new Collection([
  [chanCommand.name, chanCommand],
  [owChanCommand.name, owChanCommand],
  [massmoveCommand.name, massmoveCommand],
  [watcherCommand.name, watcherCommand],
]);

// Events handlers
client.once('ready', async () => {
  // Initialize commands
  await Promise.all(client.commands.map(async (command) => {
    if (typeof command.onBotReady === 'undefined') return;
    Logger.verbose(`Initializing "${command.name}" command...`);
    await command.onBotReady(client);
  }));

  // set a random custom status
  Logger.verbose('Initializing random status...');
  await CustomStatus.initRandomStatusJob(client);

  Logger.info(`Osmose Utility Bot is ready ! Version : ${BOT_VERSION}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  // run the command
  try {
    Logger.info(`Executing "${command.name}" command from ${interaction.user.username} (${interaction.user.id})`);
    await command.execute(interaction);
  } catch (error) {
    await Message.errorReply(interaction, {
      title: Constants.UNKNOWN_ERROR_TITLE,
      description: Constants.UNKNOWN_ERROR_DESCRIPTION,
    });
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  Logger.verbose('voiceStateUpdate event detected !');
  client.commands.each((command) => {
    if (typeof command.onVoiceStateUpdate === 'undefined') return;
    Logger.verbose(`Triggering onVoiceStateUpdate on ${command.name}`);
    command.onVoiceStateUpdate(client, oldState, newState);
  });
});

client.on('guildMemberAdd', async (member) => {
  await Promise.all(client.commands.map(async (command) => {
    if (typeof command.onGuildMemberAdd === 'undefined') return;
    Logger.verbose(`Triggering onGuildMemberAdd on ${command.name}`);
    await command.onGuildMemberAdd(client, member);
  }));
});

client.on('guildMemberRemove', async (member) => {
  await Promise.all(client.commands.map(async (command) => {
    if (typeof command.onGuildMemberRemove === 'undefined') return;
    Logger.verbose(`Triggering guildMemberRemove on ${command.name}`);
    await command.onGuildMemberRemove(client, member);
  }));
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  client.commands.each((command) => {
    if (typeof command.onGuildMemberUpdate === 'undefined') return;
    Logger.verbose(`Triggering onGuildMemberUpdate on ${command.name}`);
    command.onGuildMemberUpdate(client, oldMember, newMember);
  });
});

client.on('userUpdate', (oldUser, newUser) => {
  client.commands.each((command) => {
    if (typeof command.onUserUpdate === 'undefined') return;
    Logger.verbose(`Triggering userUpdate on ${command.name}`);
    command.onUserUpdate(client, oldUser, newUser);
  });
});

client.on('inviteCreate', (invite) => {
  client.commands.each((command) => {
    if (typeof command.onInviteCreate === 'undefined') return;
    Logger.verbose(`Triggering inviteCreate on ${command.name}`);
    command.onInviteCreate(client, invite);
  });
});

client.on('inviteDelete', (invite) => {
  client.commands.each((command) => {
    if (typeof command.onInviteDelete === 'undefined') return;
    Logger.verbose(`Triggering inviteDelete on ${command.name}`);
    command.onInviteDelete(client, invite);
  });
});

client.on('error', Logger.error);

client.login(Config.token);
