const emojiRegex = require('emoji-regex');
const Mustache = require('mustache');

const Config = require('../config.json');
const Constants = require('../constants/chan.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'chan',
  parentCategory: null,
  timeoutValue: 86400000,
  chanLimit: 0,
  moveUserInCreatedChannel: false,
  defaultChannelOptions: {
    type: 'voice',
    bitrate: 64000, // default, in bps
  },
  createdChannels: [],
  channelsTimeouts: [],
  onBotReady(client) {
    const that = this;
    const guild = client.guilds.cache.array()[0];

    // determine parent category : if not in config, search
    // for parent category of the targetted text channel
    if (typeof Config.commands.chan.parentCategory !== 'undefined') {
      this.parentCategory = guild.channels.cache.get(Config.commands.chan.parentCategory);
    } else if (Config.commands.chan.channel && Config.commands.chan.channel.length > 0) {
      const textChannel = guild.channels.cache.get(Config.commands.chan.channel);
      if (textChannel !== null) {
        this.parentCategory = textChannel.parent;
      }
    }

    // if parent category not found, do nothing
    if (this.parentCategory === null || this.parentCategory === undefined) {
      Logger.error(`chan - ${Constants.PARENT_CATEGORY_NOT_FOUND}`);
      return;
    }
    Logger.verbose(`chan - parentCategory = ${this.parentCategory}`);

    // initialize configuration
    if (typeof Config.commands.chan.timeout !== 'undefined') {
      this.timeoutValue = parseInt(Config.commands.chan.timeout, 10);
    }
    Logger.verbose(`chan - timeoutValue = ${this.timeoutValue}`);

    if (typeof Config.commands.chan.limit !== 'undefined') {
      this.chanLimit = parseInt(Config.commands.chan.limit, 10);
    }
    Logger.verbose(`chan - chanLimit = ${this.chanLimit}`);

    if (
      typeof Config.commands.chan.moveUserInCreatedChannel !== 'undefined'
      && Config.commands.chan.moveUserInCreatedChannel === true
    ) {
      this.moveUserInCreatedChannel = true;
    }
    Logger.verbose(`chan - moveUserInCreatedChannel = ${JSON.stringify(this.moveUserInCreatedChannel)}`);

    if (typeof Config.commands.chan.bitrate !== 'undefined') {
      this.defaultChannelOptions.bitrate = parseInt(Config.commands.chan.bitrate, 10);
    }
    if (this.defaultChannelOptions.bitrate < 8000) {
      this.defaultChannelOptions.bitrate = 8000; // minimum required by Discord API
    }

    // put the same permissions as the parent category
    this.defaultChannelOptions.parent = this.parentCategory.id;
    this.defaultChannelOptions.permissionOverwrites = this.parentCategory.permissionOverwrites.map(
      (o) => o.toJSON(),
    );
    Logger.verbose(`chan - defaultChannelOptions = ${JSON.stringify(this.defaultChannelOptions)}`);

    // now, assemble a list of channels to check and put an immediate timer
    let exceptionChannels = [];
    if (typeof Config.commands.chan.exceptionChannels !== 'undefined') {
      exceptionChannels = Config.commands.chan.exceptionChannels;
    }
    Logger.verbose(`chan - exceptionChannels : ${JSON.stringify(exceptionChannels)}`);

    const previouslyCreatedChannels = guild.channels.cache.filter((channel) => channel.type === 'voice'
      && channel.parent === this.parentCategory
      && exceptionChannels.indexOf(channel.id) === -1);

    // if no previously created channels, nothing to do
    if (!previouslyCreatedChannels.array().length) {
      return;
    }
    Logger.info('chan - Some channels were created before relaunch, putting timeOut on them...');

    previouslyCreatedChannels.each((channel) => {
      Logger.info(`chan - adding channel ${channel.name} into list`);
      // add into created channels array
      that.createdChannels.push(channel.id);
      // if currently no one in channel, put in timeout
      if (channel.members.array().length === 0) {
        // add the defined timeout for the operation...
        Logger.info(`chan - No one in channel ${channel.name}... Applying timeout with value ${that.timeoutValue} milliseconds...`);
        that.channelsTimeouts[channel.id] = client.setTimeout(
          that.timeoutMethod,
          that.timeoutValue,
          that,
          channel,
        );
      }
    });
  },
  execute(client, message, args) {
    const that = this;
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
        Logger.warn('chan - Invalid max limits specified');
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
      Logger.warn('chan - No channel name specificed');
      return;
    }

    // check if the name is between 1 and 100 characters
    if (channelName.length > 100) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_NAME_TOO_LONG_TITLE,
        description: Constants.CHANNEL_NAME_TOO_LONG_DESCRIPTION,
      });
      Logger.warn('chan - Channel name is too long');
      return;
    }

    // check if we have a limit of number of created chans
    if (this.chanLimit > 0 && this.createdChannels.length >= this.chanLimit) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_LIMIT_RESTRICTION_TITLE,
        description: Mustache.render(Constants.CHANNEL_LIMIT_RESTRICTION_DESCRIPTION, {
          chanLimit: this.chanLimit,
        }),
      });
      Logger.warn('chan - Max channels limit has been reached');
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
    Logger.info(`chan - Creating channel "${channelName}" in category "${this.parentCategory.name}"...`);
    Logger.verbose(`chan - ${JSON.stringify(channelOptions)}`);
    message.guild.channels.create(channelName, channelOptions)
      .then((newVoiceChannel) => {
        // add to created channels array, in order to delete later (when no one left in the channel)
        that.createdChannels.push(newVoiceChannel.id);

        // if user is in voice chat, move him in the new created channel if we enabled the option
        if (message.member.voice.channelID && this.moveUserInCreatedChannel) {
          message.member.voice.setChannel(newVoiceChannel)
            .then(() => {
              Logger.info('chan - Channel has been successfully created !');
              Message.success(message.channel, {
                title: Constants.CHANNEL_CREATED_AND_MOVED_TITLE,
                description: Mustache.render(Constants.CHANNEL_CREATED_AND_MOVED_DESCRIPTION, {
                  newVoiceChannelName: newVoiceChannel.name,
                  limitMessage,
                }),
              });
            })
            .catch((error) => {
              Logger.error(`chan - ${error}`);
              Message.warn(message.channel, {
                title: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_TITLE,
                description: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_DESCRIPTION,
              });
            });
        } else {
          // add the defined timeout for the operation...
          Logger.info(`chan - Since no one for the moment, applying timeout with value ${that.timeoutValue} milliseconds...`);
          that.channelsTimeouts[newVoiceChannel.id] = client.setTimeout(
            that.timeoutMethod,
            that.timeoutValue,
            that,
            newVoiceChannel,
          );

          Logger.info('chan - Channel has been successfully created !');
          Message.success(message.channel, {
            title: Constants.CHANNEL_CREATED_TITLE,
            description: Mustache.render(Constants.CHANNEL_CREATED_DESCRIPTION, {
              newVoiceChannelName: newVoiceChannel.name,
              limitMessage,
            }),
          });
        }
      })
      .catch((error) => {
        Logger.error(`chan - ${error}`);
        Message.error(message.channel, {
          title: Constants.CHANNEL_CREATION_UNKNOWN_ERROR_TITLE,
          description: Constants.CHANNEL_CREATION_UNKNOWN_ERROR_DESCRIPTION,
        });
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
    if (oldUserChannel !== null && this.createdChannels.length > 0) {
      // check if oldUserChannel is in list of created channels
      // and if there is no one left in the channel
      const channelIndex = this.createdChannels.indexOf(oldUserChannel.id);
      if (channelIndex !== -1 && (oldUserChannel.members.array().length === 0)) {
        // add the defined timeout for the operation...
        Logger.info(`chan - no one left in channel ${oldUserChannel.name}... Applying timeout with value ${this.timeoutValue} milliseconds...`);
        this.channelsTimeouts[oldUserChannel.id] = client.setTimeout(
          this.timeoutMethod,
          this.timeoutValue,
          this,
          oldUserChannel,
        );
      }
    }

    // if user joined a channel, check if this is a created channel
    if (newUserChannel !== null) {
      // check if we have a list of channels timeouts
      if (!Object.keys(this.channelsTimeouts).length) return;

      // check if newUserChannel is in list of channels timeouts
      if (this.channelsTimeouts[newUserChannel.id] === undefined) return;

      // we joined a channel that had a timeout, clear it
      Logger.info(`chan - someone joined channel ${newUserChannel.name} before end of timeout ! clear timeout...`);
      client.clearTimeout(this.channelsTimeouts[newUserChannel.id]);
      delete this.channelsTimeouts[newUserChannel.id];
    }
  },
  timeoutMethod(context, userChannel) {
    // now delete the channel from the created channels, the channels timeouts and the server
    Logger.info(`chan - timeout for channel ${userChannel.name} reached ! Deleting it...`);
    const channelIndex = context.createdChannels.indexOf(userChannel.id);
    context.createdChannels.splice(channelIndex, 1);
    delete context.channelsTimeouts[userChannel.id];

    userChannel.delete()
      .catch((error) => Logger.error(`chan - ${error}`));
  },
};
