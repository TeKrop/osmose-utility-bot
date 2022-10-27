const BOT_VERSION = '2.1.0';

// Load some necessary files
const fs = require('fs');
const {
  Client, Collection, Events, GatewayIntentBits,
} = require('discord.js');
const Config = require('./config.json');

const Constants = require('./constants/index.json');
const Logger = require('./services/logger');
const Message = require('./services/message');
const CustomStatus = require('./services/customStatus');

// Commands
const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

// Basic initialisation
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildVoiceStates,
];
const client = new Client({ intents });
client.commands = new Collection();
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

// Events handlers
client.once(Events.ClientReady, async () => {
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

client.on(Events.InteractionCreate, async (interaction) => {
  // Do some checks depending on the interaction type
  let command = null;
  if (interaction.isCommand()) {
    command = client.commands.get(interaction.commandName);
  } else if (interaction.isButton()) {
    const commandName = interaction.customId.split('-')[0];
    command = client.commands.get(commandName);
  }

  if (!command) {
    return;
  }

  // run the command
  try {
    if (interaction.isChatInputCommand()) {
      Logger.info(`Executing "${command.name}" command from ${interaction.user.username} (${interaction.user.id})`);
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      Logger.info(`Executing "${command.name}" button interaction from ${interaction.user.username} (${interaction.user.id})`);
      await command.buttonExecute(interaction);
    }
  } catch (error) {
    Logger.error(error);
    await Message.errorReply(interaction, {
      title: Constants.UNKNOWN_ERROR_TITLE,
      description: Constants.UNKNOWN_ERROR_DESCRIPTION,
    });
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  Logger.verbose('voiceStateUpdate event detected !');
  client.commands.each((command) => {
    if (typeof command.onVoiceStateUpdate === 'undefined') return;
    Logger.verbose(`Triggering onVoiceStateUpdate on ${command.name}`);
    command.onVoiceStateUpdate(client, oldState, newState);
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  await Promise.all(client.commands.map(async (command) => {
    if (typeof command.onGuildMemberAdd === 'undefined') return;
    Logger.verbose(`Triggering onGuildMemberAdd on ${command.name}`);
    await command.onGuildMemberAdd(client, member);
  }));
});

client.on(Events.GuildMemberRemove, async (member) => {
  await Promise.all(client.commands.map(async (command) => {
    if (typeof command.onGuildMemberRemove === 'undefined') return;
    Logger.verbose(`Triggering guildMemberRemove on ${command.name}`);
    await command.onGuildMemberRemove(client, member);
  }));
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  client.commands.each((command) => {
    if (typeof command.onGuildMemberUpdate === 'undefined') return;
    Logger.verbose(`Triggering onGuildMemberUpdate on ${command.name}`);
    command.onGuildMemberUpdate(client, oldMember, newMember);
  });
});

client.on(Events.UserUpdate, (oldUser, newUser) => {
  client.commands.each((command) => {
    if (typeof command.onUserUpdate === 'undefined') return;
    Logger.verbose(`Triggering userUpdate on ${command.name}`);
    command.onUserUpdate(client, oldUser, newUser);
  });
});

client.on(Events.InviteCreate, (invite) => {
  client.commands.each((command) => {
    if (typeof command.onInviteCreate === 'undefined') return;
    Logger.verbose(`Triggering inviteCreate on ${command.name}`);
    command.onInviteCreate(client, invite);
  });
});

client.on(Events.InviteDelete, (invite) => {
  client.commands.each((command) => {
    if (typeof command.onInviteDelete === 'undefined') return;
    Logger.verbose(`Triggering inviteDelete on ${command.name}`);
    command.onInviteDelete(client, invite);
  });
});

client.on(Events.Error, Logger.error);

client.login(Config.token);
