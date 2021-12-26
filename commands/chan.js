const emojiRegex = require('emoji-regex');
const Mustache = require('mustache');
const { Collection, Constants } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const Config = require('../config.json');
const ChanConstants = require('../constants/chan.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'chan',
  categoriesConfig: new Collection(),
  data: null,
  permissions: [],
  computeData() {
    const slashCommand = new SlashCommandBuilder()
      .setName('chan')
      .setDescription('Créer un nouveau channel vocal au sein de la catégorie choisie')
      .setDefaultPermission(false);

    slashCommand.addStringOption((option) => {
      const chanConfig = Config.commands.chan;
      const categoryOption = option.setName('category')
        .setDescription('Catégorie de channel vocal à créer')
        .setRequired(true);
      for (const category of chanConfig.categories) {
        categoryOption.addChoice(category.label, category.id);
      }
      return categoryOption;
    });

    slashCommand.addStringOption((option) => option.setName('channel_name')
      .setDescription('Le nom du nouveau channel')
      .setRequired(true));

    slashCommand.addIntegerOption((option) => option.setName('user_limit')
      .setDescription('Nombre de personnes autorisées au maximum dans le channel. Par défaut il n\'y a aucune limite.')
      .setMinValue(1)
      .setMaxValue(99)
      .setRequired(false));

    this.data = slashCommand;
  },
  computePermissions() {
    const chanConfig = Config.commands.chan;
    if (chanConfig.roles.length === 0) {
      return;
    }
    for (const roleId of chanConfig.roles) {
      this.permissions.push({
        id: roleId,
        type: Constants.ApplicationCommandPermissionTypes.ROLE,
        permission: true,
      });
    }
  },
  async onBotReady(client) {
    const guild = client.guilds.cache.first();
    const chanConfig = Config.commands.chan;

    for (const category of chanConfig.categories) {
      const categoryConfig = {};

      // Get parent category
      let parentCategory = null;
      if (typeof category.parentCategory !== 'undefined') {
        parentCategory = await guild.channels.fetch(category.parentCategory);
      }
      if (parentCategory === null || parentCategory === undefined) {
        Logger.error(`chan - ${category.id} - ${ChanConstants.PARENT_CATEGORY_NOT_FOUND}`);
        continue;
      }
      categoryConfig.parentCategory = parentCategory;
      Logger.verbose(`chan - ${category.id} - parentCategory = ${categoryConfig.parentCategory}`);

      // initialize configuration
      categoryConfig.timeoutValue = 86400000;
      if (typeof category.timeout !== 'undefined') {
        categoryConfig.timeoutValue = parseInt(category.timeout, 10);
      }
      Logger.verbose(`chan - ${category.id} - timeoutValue = ${categoryConfig.timeoutValue}`);

      categoryConfig.chanLimit = 0;
      if (typeof category.limit !== 'undefined') {
        categoryConfig.chanLimit = parseInt(category.limit, 10);
      }
      Logger.verbose(`chan - ${category.id} - chanLimit = ${categoryConfig.chanLimit}`);

      categoryConfig.moveUserInCreatedChannel = (
        typeof category.moveUserInCreatedChannel !== 'undefined'
        && category.moveUserInCreatedChannel === true
      );
      Logger.verbose(`chan - ${category.id} - moveUserInCreatedChannel = ${JSON.stringify(categoryConfig.moveUserInCreatedChannel)}`);

      categoryConfig.defaultChannelOptions = {
        type: Constants.ChannelTypes.GUILD_VOICE,
        bitrate: 64000, // default, in bps
      };
      if (typeof category.bitrate !== 'undefined') {
        categoryConfig.defaultChannelOptions.bitrate = parseInt(category.bitrate, 10);
      }
      if (categoryConfig.defaultChannelOptions.bitrate < 8000) {
        categoryConfig.defaultChannelOptions.bitrate = 8000; // minimum required by Discord API
      }

      // put the same permissions as the parent category
      categoryConfig.defaultChannelOptions.parent = categoryConfig.parentCategory;
      categoryConfig.defaultChannelOptions.permissionOverwrites = categoryConfig
        .parentCategory
        .permissionOverwrites
        .cache
        .map(
          (o) => o.toJSON(),
        );
      Logger.verbose(`chan - defaultChannelOptions = ${JSON.stringify(categoryConfig.defaultChannelOptions)}`);
      // now, assemble a list of channels to check and put an immediate timer
      let exceptionChannels = new Collection();
      if (typeof category.exceptionChannels !== 'undefined') {
        exceptionChannels = guild.channels.cache.filter((channel) => channel.isVoice()
          && category.exceptionChannels.includes(channel.id));
      }
      Logger.verbose(`chan - exceptionChannels : ${JSON.stringify(exceptionChannels)}`);

      categoryConfig.createdChannels = guild.channels.cache.filter((channel) => channel.isVoice()
        && channel.parent.id === categoryConfig.parentCategory.id
        && !exceptionChannels.has(channel.id));

      // if previously created channels, add timeout for them
      categoryConfig.channelsTimeouts = new Collection();
      if (categoryConfig.createdChannels.size > 0) {
        Logger.info('chan - Some channels were created before relaunch, putting timeOut on them...');
        categoryConfig.createdChannels.each((channel) => {
          Logger.info(`chan - adding channel ${channel.name} into list`);
          // if currently no one in channel, put in timeout
          if (channel.members.size !== 0) {
            return;
          }
          // add the defined timeout for the operation...
          Logger.info(`chan - No one in channel ${channel.name}... Applying timeout with value ${categoryConfig.timeoutValue} milliseconds...`);
          categoryConfig.channelsTimeouts.set(channel.id, setTimeout(
            this.timeoutMethod,
            categoryConfig.timeoutValue,
            categoryConfig,
            channel,
          ));
        });
      }
      this.categoriesConfig.set(category.id, categoryConfig);
    }
  },
  async execute(interaction) {
    const category = interaction.options.getString('category');
    if (!this.categoriesConfig.has(category)) {
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_CREATION_CONFIGURATION_ERROR_TITLE,
        description: ChanConstants.CHANNEL_CREATION_CONFIGURATION_ERROR_DESCRIPTION,
      });
      Logger.error('chan - Invalid configuration');
      return;
    }

    const categoryConfig = this.categoriesConfig.get(category);

    // check if we have a limit of number of created chans
    if (
      categoryConfig.chanLimit > 0
      && categoryConfig.createdChannels.size >= categoryConfig.chanLimit
    ) {
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_LIMIT_RESTRICTION_TITLE,
        description: Mustache.render(ChanConstants.CHANNEL_LIMIT_RESTRICTION_DESCRIPTION, {
          chanLimit: categoryConfig.chanLimit,
        }),
      });
      Logger.warn('chan - Max channels limit has been reached');
      return;
    }

    let limitMessage = '';
    const channelOptions = { ...categoryConfig.defaultChannelOptions };
    const userLimit = interaction.options.getInteger('user_limit');
    if (userLimit !== null) {
      channelOptions.userLimit = userLimit;
      limitMessage = Mustache.render(ChanConstants.CHANNEL_LIMITED_TO_X_USERS, { userLimit });
    }

    // check if the name is between 1 and 100 characters
    let channelName = interaction.options.getString('channel_name');
    if (channelName.length > 100) {
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_NAME_TOO_LONG_TITLE,
        description: ChanConstants.CHANNEL_NAME_TOO_LONG_DESCRIPTION,
      });
      Logger.warn('chan - Channel name is too long');
      return;
    }

    // force first char as uppercase
    channelName = channelName.charAt(0).toUpperCase() + channelName.slice(1);
    const chanStartsWithEmoji = channelName.match(emojiRegex());
    if (!chanStartsWithEmoji) {
      // add default emoji
      channelName = `🎲 ${channelName}`;
    }

    // create the channel
    Logger.info(`chan - Creating channel "${channelName}" in category "${categoryConfig.parentCategory.name}"...`);
    Logger.verbose(`chan - ${JSON.stringify(channelOptions)}`);

    let newVoiceChannel = null;
    try {
      newVoiceChannel = await interaction.guild.channels.create(channelName, channelOptions);
    } catch (error) {
      Logger.error(`chan - ${error}`);
      await Message.errorReply(interaction, {
        title: ChanConstants.CHANNEL_CREATION_UNKNOWN_ERROR_TITLE,
        description: ChanConstants.CHANNEL_CREATION_UNKNOWN_ERROR_DESCRIPTION,
      });
      return;
    }

    // add to created channels array, in order to delete later (when no one left in the channel)
    categoryConfig.createdChannels.set(newVoiceChannel.id, newVoiceChannel);

    // if user is in voice chat, move him in the new created channel if we enabled the option
    let successMessageTitle = ChanConstants.CHANNEL_CREATED_TITLE;
    let successMessageDescription = ChanConstants.CHANNEL_CREATED_DESCRIPTION;

    if (interaction.member.voice.channelId && categoryConfig.moveUserInCreatedChannel) {
      try {
        await interaction.member.voice.setChannel(newVoiceChannel);
      } catch (error) {
        Logger.error(`chan - ${error}`);
        await Message.warnReply(interaction, {
          title: ChanConstants.CHANNEL_CREATED_BUT_MOVE_ERROR_TITLE,
          description: ChanConstants.CHANNEL_CREATED_BUT_MOVE_ERROR_DESCRIPTION,
        });
        return;
      }

      successMessageTitle = ChanConstants.CHANNEL_CREATED_AND_MOVED_TITLE;
      successMessageDescription = ChanConstants.CHANNEL_CREATED_AND_MOVED_DESCRIPTION;
    } else {
      // add the defined timeout for the operation...
      Logger.info(`chan - Since no one for the moment, applying timeout with value ${categoryConfig.timeoutValue} milliseconds...`);
      categoryConfig.channelsTimeouts.set(newVoiceChannel.id, setTimeout(
        this.timeoutMethod,
        categoryConfig.timeoutValue,
        categoryConfig,
        newVoiceChannel,
      ));
    }

    // display success message
    Logger.info('chan - Channel has been successfully created !');
    await Message.successReply(interaction, {
      title: successMessageTitle,
      description: Mustache.render(successMessageDescription, {
        newVoiceChannelName: newVoiceChannel.name,
        limitMessage,
      }),
    });
  },
  onVoiceStateUpdate(client, oldState, newState) {
    // check if we are handling an event where a user leaves a channel or/and joins
    const oldUserChannel = oldState.channel;
    const newUserChannel = newState.channel;

    const oldChannelName = (oldUserChannel !== null) ? `${oldUserChannel.id} (${oldUserChannel.name})` : '...';
    const newChannelName = (newUserChannel !== null) ? `${newUserChannel.id} (${newUserChannel.name})` : '...';
    Logger.verbose(`chan - ${oldChannelName} => ${newChannelName}`);

    // do nothing if same channel (voiceUpdate = mic)
    if (
      oldUserChannel !== null
      && newUserChannel !== null
      && oldUserChannel.id === newUserChannel.id
    ) {
      return;
    }

    // if user leaved a channel, check if this is one created dynamically.
    // if no one left, apply timeout for deletion
    // check if we have a list of created channels
    if (oldUserChannel !== null) {
      this.categoriesConfig.each((categoryConfig) => {
        if (
          (!categoryConfig.createdChannels.has(oldUserChannel.id))
          || (oldUserChannel.members.size > 0)
        ) {
          return;
        }
        // add the defined timeout for the operation...
        Logger.info(`chan - no one left in channel ${oldUserChannel.name}... Applying timeout with value ${categoryConfig.timeoutValue} milliseconds...`);
        categoryConfig.channelsTimeouts.set(oldUserChannel.id, setTimeout(
          this.timeoutMethod,
          categoryConfig.timeoutValue,
          categoryConfig,
          oldUserChannel,
        ));
      });
    }

    // if user joined a channel, check if this is a created channel
    if (newUserChannel !== null) {
      this.categoriesConfig.each((categoryConfig) => {
        // check if newUserChannel is in list of channels timeouts
        if (!categoryConfig.channelsTimeouts.has(newUserChannel.id)) return;

        // we joined a channel that had a timeout, clear it
        Logger.info(`chan - someone joined channel ${newUserChannel.name} before end of timeout ! clear timeout...`);
        clearTimeout(categoryConfig.channelsTimeouts.get(newUserChannel.id));
        categoryConfig.channelsTimeouts.delete(newUserChannel.id);
      });
    }
  },
  timeoutMethod(categoryConfig, userChannel) {
    // now delete the channel from the created channels, the channels timeouts and the server
    Logger.info(`chan - timeout for channel ${userChannel.name} reached ! Deleting it...`);
    categoryConfig.createdChannels.delete(userChannel.id);
    categoryConfig.channelsTimeouts.delete(userChannel.id);

    userChannel.delete()
      .catch((error) => Logger.error(`${error}`));
  },
};
