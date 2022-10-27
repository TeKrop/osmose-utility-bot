const Mustache = require('mustache');
const { Collection, ChannelType, SlashCommandBuilder } = require('discord.js');

const ChanConstants = require('../constants/chan.json');
const MassmoveConstants = require('../constants/massmove.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'massmove',
  data: null,
  computeData() {
    this.data = new SlashCommandBuilder()
      .setName('massmove')
      .setDescription(MassmoveConstants.MASSMOVE_COMMAND_DESCRIPTION)
      .setDefaultMemberPermissions(0)
      .addSubcommand((subcommand) => subcommand
        .setName('me')
        .setDescription(MassmoveConstants.MASSMOVE_ME_SUBCOMMAND_DESCRIPTION)
        .addChannelOption((option) => option.setName('destination_channel')
          .setDescription(MassmoveConstants.DESTINATION_CHANNEL_OPTION_DESCRIPTION)
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('users')
        .setDescription(MassmoveConstants.MASSMOVE_USERS_SUBCOMMAND_DESCRIPTION)
        .addChannelOption((option) => option.setName('source_channel')
          .setDescription(MassmoveConstants.SOURCE_CHANNEL_OPTION_DESCRIPTION)
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true))
        .addChannelOption((option) => option.setName('destination_channel')
          .setDescription(MassmoveConstants.DESTINATION_CHANNEL_OPTION_DESCRIPTION)
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)));
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
      sourceChannel = interaction.options.getChannel('source_channel');
    }

    const destinationChannel = interaction.options.getChannel('destination_channel');

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
        title: MassmoveConstants.MASSMOVE_USERS_NOT_MOVED_ERROR_TITLE,
        description: Mustache.render(MassmoveConstants.MASSMOVE_USERS_NOT_MOVED_ERROR_DESCRIPTION, {
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
      buttons: [{
        id: `massmove-joinChannel-${sourceChannel.id}`,
        label: `Se connecter au channel "${sourceChannel.name}"`,
      }, {
        id: `massmove-joinChannel-${destinationChannel.id}`,
        label: `Se connecter au channel "${destinationChannel.name}"`,
      }],
    });
  },
  async buttonExecute(interaction) {
    if (!interaction.customId.startsWith('massmove-joinChannel-')) {
      return;
    }
    const channelId = interaction.customId.split('-')[2];
    Logger.info(`massmove - Trying to move user to chan ${channelId}...`);

    // Check if the channel still exists
    const destinationChannel = interaction.guild.channels.cache.get(channelId);
    if (!destinationChannel || destinationChannel.type !== ChannelType.GuildVoice) {
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_JOIN_MISSING_ERROR_TITLE,
        description: ChanConstants.CHANNEL_JOIN_MISSING_ERROR_DESCRIPTION,
        ephemeral: true,
      });
      return;
    }

    // Check if the user is already connected to voice
    const commandAuthorChannel = interaction.member.voice.channel || null;

    if (commandAuthorChannel === null) {
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_JOIN_NOT_CONNECTED_TITLE,
        description: ChanConstants.CHANNEL_JOIN_NOT_CONNECTED_DESCRIPTION,
        ephemeral: true,
      });
      return;
    }

    // Check if user is already in the destination channel
    if (commandAuthorChannel.id === destinationChannel.id) {
      await Message.warnReply(interaction, {
        title: ChanConstants.CHANNEL_JOIN_ALREADY_IN_CHANNEL_TITLE,
        description: ChanConstants.CHANNEL_JOIN_ALREADY_IN_CHANNEL_DESCRIPTION,
        ephemeral: true,
      });
      return;
    }

    // All good, let's go
    await interaction.member.voice.setChannel(destinationChannel);

    await Message.successReply(interaction, {
      title: ChanConstants.CHANNEL_JOIN_SUCCESS_TITLE,
      description: ChanConstants.CHANNEL_JOIN_SUCCESS_DESCRIPTION,
      ephemeral: true,
    });
  },
};
