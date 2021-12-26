const Mustache = require('mustache');
const { Collection, Constants } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const Config = require('../config.json');
const MassmoveConstants = require('../constants/massmove.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'massmove',
  data: new SlashCommandBuilder()
    .setName('massmove')
    .setDescription('Déplacer massivement des utilisateurs d\'un channel vocal à un autre')
    .setDefaultPermission(false)
    .addSubcommand((subcommand) => subcommand
      .setName('me')
      .setDescription('Se déplacer avec les autres utilisateurs depuis son channel vocal actuel vers un autre')
      .addChannelOption((option) => option.setName('destination_channel')
        .setDescription('Le channel de destination')
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('users')
      .setDescription('Déplacer tous les utilisateurs d\'un channel vocal à un autre')
      .addChannelOption((option) => option.setName('source_channel')
        .setDescription('Le channel d\'origine')
        .setRequired(true))
      .addChannelOption((option) => option.setName('destination_channel')
        .setDescription('Le channel de destination')
        .setRequired(true))),
  permissions: [],
  computePermissions() {
    const massmoveConfig = Config.commands.massmove;

    if (massmoveConfig.roles.length === 0) {
      return;
    }

    for (var i = massmoveConfig.roles.length - 1; i >= 0; i--) {
      this.permissions.push({
        id: massmoveConfig.roles[i],
        type: Constants.ApplicationCommandPermissionTypes.ROLE,
        permission: true
      });
    }
  },
  async execute(interaction) {
    // Get source and destination channels depending on the options
    let sourceChannel = null;
    if (interaction.options.getSubcommand() === 'me') {
      const commandAuthorChannel = interaction.member.voice.channel || null;
      if (commandAuthorChannel === null) {
        await Message.errorReply(interaction, {
          title: MassmoveConstants.ONLY_DESTINATION_BUT_NOT_CONNECTED_TITLE,
          description: MassmoveConstants.ONLY_DESTINATION_BUT_NOT_CONNECTED_DESCRIPTION,
        });
        Logger.warn('massmove - Invalid use (user specified only destination but is not connected)');
        return;
      }
      sourceChannel = commandAuthorChannel;
    } else {
      sourceChannel = interaction.options.get('source_channel').channel;
    }

    const destinationChannel = interaction.options.get('destination_channel').channel;

    // if one of the two channels is not a voice channel, error
    if (!sourceChannel.isVoice() || !destinationChannel.isVoice()) {
      await Message.errorReply(interaction, {
        title: MassmoveConstants.MUST_BE_VOICE_CHANNELS_TITLE,
        description: MassmoveConstants.MUST_BE_VOICE_CHANNELS_DESCRIPTION,
      });
      Logger.warn('massmove - Origin and/or destination channel is not a voice channel');
      return;
    }

    // if same channels, don't do anything
    if (sourceChannel.id === destinationChannel.id) {
      await Message.warnReply(interaction, {
        title: MassmoveConstants.SAME_ORIGIN_AND_DESTINATION_TITLE,
        description: MassmoveConstants.SAME_ORIGIN_AND_DESTINATION_DESCRIPTION,
      });
      Logger.warn('massmove - Origin and destination channel are the same');
      return;
    }

    // assemble members to move from origin
    const membersToMove = sourceChannel.members;
    if (membersToMove.size === 0) {
      await Message.errorReply(interaction, {
        title: MassmoveConstants.NO_USER_TO_MOVE_TITLE,
        description: MassmoveConstants.NO_USER_TO_MOVE_DESCRIPTION,
      });
      return;
    }

    // move them to destination channel
    const membersNotMoved = new Collection();
    const membersMoved = new Collection();
    await Promise.all(membersToMove.map(async (member) => {
      try {
        Logger.info(`massmove - moving ${member.displayName}...`);
        await member.voice.setChannel(destinationChannel);
        membersMoved.set(member.id, member);
      } catch (error) {
        Logger.error(`massmove - ${error}`);
        await Message.errorReply(interaction, {
          title: MassmoveConstants.UNKNOWN_MOVE_ERROR_TITLE,
          description: Mustache.render(MassmoveConstants.UNKNOWN_MOVE_ERROR_DESCRIPTION, {
            memberDisplayName: member.displayName,
          }),
        });
        membersNotMoved.set(member.id, member);
      }
    }));

    // if we didn't move any user, error reply
    if (membersMoved.size === 0) {
      await Message.errorReply(interaction, {
        title: MassmoveConstants.MASSMOVE_NOT_ANY_USER_MOVED_ERROR_TITLE,
        description: MassmoveConstants.MASSMOVE_NOT_ANY_USER_MOVED_ERROR_DESCRIPTION,
      });
      return;
    }

    // if we didn't move some users, warning reply
    if (membersNotMoved.size > 0) {
      await Message.warnReply(interaction, {
        title: MassmoveConstants.MASSMOVE_SOME_USERS_NOT_MOVED_ERROR_TITLE,
        description: Mustache.render(MassmoveConstants.MASSMOVE_SOME_USERS_NOT_MOVED_ERROR_DESCRIPTION, {
          nbNotMovedUsers: membersNotMoved.size,
          pluralUsers: (membersNotMoved.size > 1 ? 's' : ''),
          notMovedUsers: membersNotMoved.map((member) => member.displayName).join(', '),
        }),
      });
    }

    // success reply anyway
    await Message.successReply(interaction, {
      title: Mustache.render(MassmoveConstants.MASSMOVE_SUCCESSFUL_TITLE, {
        nbMovedUsers: membersMoved.size,
        pluralUsers: (membersMoved.size > 1 ? 's' : ''),
      }),
      description: Mustache.render(MassmoveConstants.MASSMOVE_SUCCESSFUL_DESCRIPTION, {
        sourceChannel: sourceChannel.name,
        destinationChannel: destinationChannel.name,
      }),
    });
  },
};
