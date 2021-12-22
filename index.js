const BOT_VERSION = '1.1.0';

// Load some necessary files
const Discord = require('discord.js');
const Config = require('./config.json');

const Constants = require('./constants/index.json');
const Logger = require('./services/logger');
const Message = require('./services/message');
const CustomStatus = require('./services/customStatus');

// Commands
const chanCommand = require('./commands/chan.js');
const massmoveCommand = require('./commands/massmove.js');
const owchanCommand = require('./commands/owchan.js');
const watcherCommand = require('./commands/watcher.js');

// Basic initialisation
const intents = [
  Discord.Intents.FLAGS.GUILDS,
  Discord.Intents.FLAGS.GUILD_INVITES,
  Discord.Intents.FLAGS.GUILD_MESSAGES,
  Discord.Intents.FLAGS.GUILD_MEMBERS,
  Discord.Intents.FLAGS.GUILD_PRESENCES,
  Discord.Intents.FLAGS.GUILD_VOICE_STATES,
];
const client = new Discord.Client({ intents: intents });
client.commands = new Discord.Collection([
  [chanCommand.name, chanCommand],
  [massmoveCommand.name, massmoveCommand],
  [owchanCommand.name, owchanCommand],
  [watcherCommand.name, watcherCommand],
]);

// Events handlers
client.once('ready', async() => {
  // Initialize commands
  await client.commands.each( async(command) => {
    if (typeof command.onBotReady === 'undefined') return;
    Logger.verbose(`Initializing "${command.name}" command...`);
    await command.onBotReady(client);
  });

  // set a random custom status
  Logger.verbose('Initializing random status...');
  await CustomStatus.initRandomStatusJob(client);

  Logger.info(`Osmose Utility Bot is ready ! Version : ${BOT_VERSION}`);
});

client.on('messageCreate', (message) => {
  // don't need to analyze bot messages
  if (message.author.bot) return;

  // retrieve args and command
  const args = message.content.trim().slice(Config.prefix.length).split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (
    (!client.commands.has(commandName))
    || (Object.keys(Config.commands).indexOf(commandName) === -1)
  ) {
    return;
  }

  const command = client.commands.get(commandName);
  const commandConfig = Config.commands[commandName];

  // if no channel in config, not any usable command
  if (typeof commandConfig.channel === 'undefined') {
    return;
  }

  // check if the command has been called in the specific channel specified
  let botChannel = null;
  if (commandConfig.channel && commandConfig.channel.length > 0) {
    botChannel = message.guild.channels.cache.get(commandConfig.channel);
  }

  if (!botChannel) {
    Message.error(message.channel, {
      title: Constants.INVALID_CONFIGURATION_TITLE,
      description: Constants.INVALID_CONFIGURATION_DESCRIPTION,
    });
    Logger.error('The bot is not configured correctly');
    if (commandConfig.channel && commandConfig.channel.length > 0) {
      Logger.error(`The "${commandConfig.channel}" chan can't be found`);
    } else {
      Logger.error('No chan in configuration');
    }
    return;
  }

  // stop if the message was written outside of
  // bot specific channel (if any in the configuration file)
  if (botChannel !== message.channel) {
    Message.error(botChannel, {
      title: Constants.WRONG_TEXT_CHANNEL_USED_TITLE,
      tag: message.author.id,
      description: Constants.WRONG_TEXT_CHANNEL_USED_DESCRIPTION,
    });
    Logger.error(`Wrong chan usage from ${message.author.id}`);
    return;
  }

  // run the command
  try {
    Logger.info(`Executing "${command.name}" command from ${message.author.username} (${message.author.id})`);
    command.execute(client, message, args.join(' '));
  } catch (error) {
    Message.error(message.channel, {
      title: Constants.UNKNOWN_ERROR_TITLE,
      description: Constants.UNKNOWN_ERROR_DESCRIPTION,
    });
    Logger.error(error);
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

client.on('guildMemberAdd', async(member) => {
  await client.commands.each( async(command) => {
    if (typeof command.onGuildMemberAdd === 'undefined') return;
    Logger.verbose(`Triggering onGuildMemberAdd on ${command.name}`);
    await command.onGuildMemberAdd(client, member);
  });
});

client.on('guildMemberRemove', async(member) => {
  await client.commands.each( async(command) => {
    if (typeof command.onGuildMemberRemove === 'undefined') return;
    Logger.verbose(`Triggering guildMemberRemove on ${command.name}`);
    await command.onGuildMemberRemove(client, member);
  });
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
