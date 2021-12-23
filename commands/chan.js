const emojiRegex = require('emoji-regex');
const Mustache = require('mustache');
const { Collection } = require('discord.js');

const Config = require('../config.json');
const Constants = require('../constants/chan.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  parentCategory: null,
  timeoutValue: 86400000,
  chanLimit: 0,
  moveUserInCreatedChannel: false,
  defaultChannelOptions: {},
  createdChannels: new Collection(),
  channelsTimeouts: new Collection(),
  async onBotReady(client) {
    const that = this;
    const guild = client.guilds.cache.first();
    const chanConfig = Config.commands[this.name];

    // determine parent category : if not in config, search
    // for parent category of the targetted text channel
    if (typeof chanConfig.parentCategory !== 'undefined') {
      this.parentCategory = await guild.channels.fetch(chanConfig.parentCategory);
    } else if (chanConfig.channel && chanConfig.channel.length > 0) {
      const textChannel = await guild.channels.fetch(chanConfig.channel);
      if (textChannel !== null) {
        this.parentCategory = textChannel.parent;
      }
    }

    // if parent category not found, do nothing
    if (this.parentCategory === null || this.parentCategory === undefined) {
      Logger.error(`${this.name} - ${Constants.PARENT_CATEGORY_NOT_FOUND}`);
      return;
    }
    Logger.verbose(`${this.name} - parentCategory = ${this.parentCategory}`);

    // initialize configuration
    if (typeof chanConfig.timeout !== 'undefined') {
      this.timeoutValue = parseInt(chanConfig.timeout, 10);
    }
    Logger.verbose(`${this.name} - timeoutValue = ${this.timeoutValue}`);

    if (typeof chanConfig.limit !== 'undefined') {
      this.chanLimit = parseInt(chanConfig.limit, 10);
    }
    Logger.verbose(`${this.name} - chanLimit = ${this.chanLimit}`);

    if (
      typeof chanConfig.moveUserInCreatedChannel !== 'undefined'
      && chanConfig.moveUserInCreatedChannel === true
    ) {
      this.moveUserInCreatedChannel = true;
    }
    Logger.verbose(`${this.name} - moveUserInCreatedChannel = ${JSON.stringify(this.moveUserInCreatedChannel)}`);

    this.defaultChannelOptions = {
      type: 'GUILD_VOICE',
      bitrate: 64000, // default, in bps
    };
    if (typeof chanConfig.bitrate !== 'undefined') {
      this.defaultChannelOptions.bitrate = parseInt(chanConfig.bitrate, 10);
    }
    if (this.defaultChannelOptions.bitrate < 8000) {
      this.defaultChannelOptions.bitrate = 8000; // minimum required by Discord API
    }

    // put the same permissions as the parent category
    this.defaultChannelOptions.parent = this.parentCategory;
    this.defaultChannelOptions.permissionOverwrites = this
      .parentCategory
      .permissionOverwrites
      .cache
      .map(
        (o) => o.toJSON(),
      );

    Logger.verbose(`${this.name} - defaultChannelOptions = ${JSON.stringify(this.defaultChannelOptions)}`);

    // now, assemble a list of channels to check and put an immediate timer
    let exceptionChannels = new Collection();
    if (typeof chanConfig.exceptionChannels !== 'undefined') {
      exceptionChannels = guild.channels.cache.filter((channel) => channel.isVoice()
        && chanConfig.exceptionChannels.includes(channel.id));
    }
    Logger.verbose(`${this.name} - exceptionChannels : ${JSON.stringify(exceptionChannels)}`);

    this.createdChannels = guild.channels.cache.filter((channel) => channel.isVoice()
      && channel.parent.id === this.parentCategory.id
      && !exceptionChannels.has(channel.id));

    // if no previously created channels, nothing to do
    if (this.createdChannels.size === 0) {
      return;
    }

    Logger.info(`${this.name} - Some channels were created before relaunch, putting timeOut on them...`);

    this.createdChannels.each((channel) => {
      Logger.info(`${this.name} - adding channel ${channel.name} into list`);
      // if currently no one in channel, put in timeout
      if (channel.members.size !== 0) {
        return;
      }
      // add the defined timeout for the operation...
      Logger.info(`${this.name} - No one in channel ${channel.name}... Applying timeout with value ${that.timeoutValue} milliseconds...`);
      that.channelsTimeouts.set(channel.id, setTimeout(
        that.timeoutMethod,
        that.timeoutValue,
        that,
        channel,
      ));
    });
  },
  async execute(client, message, args) {
    const channelOptions = { ...this.defaultChannelOptions };

    let channelName = args.split(' ');
    let limitMessage = '';

    if (!Number.isNaN(Number(channelName[0]))) {
      const userLimit = parseInt(channelName.shift(), 10);
      if (userLimit <= 0 || userLimit > 100) {
        Message.error(message.channel, {
          title: Constants.INVALID_USERS_LIMIT_TITLE,
          description: Constants.INVALID_USERS_LIMIT_DESCRIPTION,
        });
        Logger.warn(`${this.name} - Invalid max limits specified`);
        return;
      }
      channelOptions.userLimit = userLimit;
      limitMessage += Mustache.render(Constants.CHANNEL_LIMITED_TO_X_USERS, { userLimit });
    }
    channelName = channelName.join(' ');

    // check if we have a name for the new channel
    if (!channelName.length) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_NAME_NOT_SPECIFIED_TITLE,
        description: Constants.CHANNEL_NAME_NOT_SPECIFIED_DESCRIPTION,
      });
      Logger.warn(`${this.name} - No channel name specificed`);
      return;
    }

    // check if the name is between 1 and 100 characters
    if (channelName.length > 100) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_NAME_TOO_LONG_TITLE,
        description: Constants.CHANNEL_NAME_TOO_LONG_DESCRIPTION,
      });
      Logger.warn(`${this.name} - Channel name is too long`);
      return;
    }

    // check if we have a limit of number of created chans
    if (this.chanLimit > 0 && this.createdChannels.size >= this.chanLimit) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_LIMIT_RESTRICTION_TITLE,
        description: Mustache.render(Constants.CHANNEL_LIMIT_RESTRICTION_DESCRIPTION, {
          chanLimit: this.chanLimit,
        }),
      });
      Logger.warn(`${this.name} - Max channels limit has been reached`);
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
    Logger.info(`${this.name} - Creating channel "${channelName}" in category "${this.parentCategory.name}"...`);
    Logger.verbose(`${this.name} - ${JSON.stringify(this.defaultChannelOptions)}`);
    Logger.verbose(`${this.name} - ${JSON.stringify(channelOptions)}`);

    let newVoiceChannel = null;
    try {
      newVoiceChannel = await message.guild.channels.create(channelName, channelOptions);
    } catch (error) {
      Logger.error(`${this.name} - ${error}`);
      Message.error(message.channel, {
        title: Constants.CHANNEL_CREATION_UNKNOWN_ERROR_TITLE,
        description: Constants.CHANNEL_CREATION_UNKNOWN_ERROR_DESCRIPTION,
      });
      return;
    }

    // add to created channels array, in order to delete later (when no one left in the channel)
    this.createdChannels.set(newVoiceChannel.id, newVoiceChannel);

    // if user is in voice chat, move him in the new created channel if we enabled the option
    let successMessageTitle = Constants.CHANNEL_CREATED_TITLE;
    let successMessageDescription = Constants.CHANNEL_CREATED_DESCRIPTION;

    if (message.member.voice.channelId && this.moveUserInCreatedChannel) {
      try {
        await message.member.voice.setChannel(newVoiceChannel);
      } catch (error) {
        Logger.error(`${this.name} - ${error}`);
        Message.warn(message.channel, {
          title: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_TITLE,
          description: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_DESCRIPTION,
        });
        return;
      }

      successMessageTitle = Constants.CHANNEL_CREATED_AND_MOVED_TITLE;
      successMessageDescription = Constants.CHANNEL_CREATED_AND_MOVED_DESCRIPTION;
    } else {
      // add the defined timeout for the operation...
      Logger.info(`${this.name} - Since no one for the moment, applying timeout with value ${this.timeoutValue} milliseconds...`);
      this.channelsTimeouts.set(newVoiceChannel.id, setTimeout(
        this.timeoutMethod,
        this.timeoutValue,
        this,
        newVoiceChannel,
      ));
    }

    // display success message
    Logger.info(`${this.name} - Channel has been successfully created !`);
    Message.success(message.channel, {
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
    Logger.verbose(`${this.name} - ${oldChannelName} => ${newChannelName}`);

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
    if (oldUserChannel !== null && this.createdChannels.size > 0) {
      // check if oldUserChannel is in list of created channels
      // and if there is no one left in the channel
      if (this.createdChannels.has(oldUserChannel.id) && (oldUserChannel.members.size === 0)) {
        // add the defined timeout for the operation...
        Logger.info(`${this.name} - no one left in channel ${oldUserChannel.name}... Applying timeout with value ${this.timeoutValue} milliseconds...`);
        this.channelsTimeouts.set(oldUserChannel.id, setTimeout(
          this.timeoutMethod,
          this.timeoutValue,
          this,
          oldUserChannel,
        ));
      }
    }

    // if user joined a channel, check if this is a created channel
    if (newUserChannel !== null) {
      // check if newUserChannel is in list of channels timeouts
      if (!this.channelsTimeouts.has(newUserChannel.id)) return;

      // we joined a channel that had a timeout, clear it
      Logger.info(`${this.name} - someone joined channel ${newUserChannel.name} before end of timeout ! clear timeout...`);
      clearTimeout(this.channelsTimeouts.get(newUserChannel.id));
      this.channelsTimeouts.delete(newUserChannel.id);
    }
  },
  timeoutMethod(context, userChannel) {
    // now delete the channel from the created channels, the channels timeouts and the server
    Logger.info(`${context.name} - timeout for channel ${userChannel.name} reached ! Deleting it...`);
    context.createdChannels.delete(userChannel.id);
    context.channelsTimeouts.delete(userChannel.id);

    userChannel.delete()
      .catch((error) => Logger.error(`${context.name} - ${error}`));
  },
};
