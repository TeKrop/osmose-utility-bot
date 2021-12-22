const emojiRegex = require('emoji-regex');
const Mustache = require('mustache');

const Config = require('../config.json');
const Constants = require('../constants/chan.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'owchan',
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
    const guild = client.guilds.cache.first();

    // determine parent category : if not in config, search
    // for parent category of the targetted text channel
    if (typeof Config.commands.owchan.parentCategory !== 'undefined') {
      this.parentCategory = guild.channels.cache.get(Config.commands.owchan.parentCategory);
    } else if (Config.commands.owchan.channel && Config.commands.owchan.channel.length > 0) {
      const textChannel = guild.channels.cache.get(Config.commands.owchan.channel);
      if (textChannel !== null) {
        this.parentCategory = textChannel.parent;
      }
    }

    // if parent category not found, do nothing
    if (this.parentCategory === null || this.parentCategory === undefined) {
      Logger.error(`owchan - ${Constants.PARENT_CATEGORY_NOT_FOUND}`);
      return;
    }
    Logger.verbose(`owchan - parentCategory = ${this.parentCategory}`);

    // initialize configuration
    if (typeof Config.commands.owchan.timeout !== 'undefined') {
      this.timeoutValue = parseInt(Config.commands.owchan.timeout, 10);
    }
    Logger.verbose(`owchan - timeoutValue = ${this.timeoutValue}`);

    if (typeof Config.commands.owchan.limit !== 'undefined') {
      this.chanLimit = parseInt(Config.commands.owchan.limit, 10);
    }
    Logger.verbose(`owchan - chanLimit = ${this.chanLimit}`);

    if (
      typeof Config.commands.owchan.moveUserInCreatedChannel !== 'undefined'
      && Config.commands.owchan.moveUserInCreatedChannel === true
    ) {
      this.moveUserInCreatedChannel = true;
    }
    Logger.verbose(`owchan - moveUserInCreatedChannel = ${JSON.stringify(this.moveUserInCreatedChannel)}`);

    if (typeof Config.commands.owchan.bitrate !== 'undefined') {
      this.defaultChannelOptions.bitrate = parseInt(Config.commands.owchan.bitrate, 10);
    }
    if (this.defaultChannelOptions.bitrate < 8000) {
      this.defaultChannelOptions.bitrate = 8000; // minimum required by Discord API
    }

    // put the same permissions as the parent category
    this.defaultChannelOptions.parent = this.parentCategory.id;
    this.defaultChannelOptions.permissionOverwrites = this.parentCategory.permissionOverwrites.cache.map(
      (o) => o.toJSON(),
    );
    Logger.verbose(`owchan - defaultChannelOptions = ${JSON.stringify(this.defaultChannelOptions)}`);

    // now, assemble a list of channels to check and put an immediate timer
    let exceptionChannels = [];
    if (typeof Config.commands.owchan.exceptionChannels !== 'undefined') {
      exceptionChannels = Config.commands.owchan.exceptionChannels;
    }
    Logger.verbose(`owchan - exceptionChannels : ${JSON.stringify(exceptionChannels)}`);

    const previouslyCreatedChannels = guild.channels.cache.filter((channel) => channel.isVoice()
      && channel.parent === this.parentCategory
      && exceptionChannels.indexOf(channel.id) === -1);

    // if no previously created channels, nothing to do
    if (!previouslyCreatedChannels.size) {
      return;
    }
    Logger.info('owchan - Some channels were created before relaunch, putting timeOut on them...');

    previouslyCreatedChannels.each((channel) => {
      Logger.info(`owchan - adding channel ${channel.name} into list`);
      // add into created channels array
      that.createdChannels.push(channel.id);
      // if currently no one in channel, put in timeout
      if (channel.members.size === 0) {
        // add the defined timeout for the operation...
        Logger.info(`owchan - No one in channel ${channel.name}... Applying timeout with value ${that.timeoutValue} milliseconds...`);
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
        Logger.warn('owchan - Invalid max limits specified');
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
      Logger.warn('owchan - No channel name specificed');
      return;
    }

    // check if the name is between 1 and 100 characters
    if (channelName.length > 100) {
      Message.error(message.channel, {
        title: Constants.CHANNEL_NAME_TOO_LONG_TITLE,
        description: Constants.CHANNEL_NAME_TOO_LONG_DESCRIPTION,
      });
      Logger.warn('owchan - Channel name is too long');
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
      Logger.warn('owchan - Max channels limit has been reached');
      return;
    }

    // force capitalize for voice channel
    channelName = channelName.charAt(0).toUpperCase() + channelName.slice(1);

    const chanStartsWithEmoji = channelName.match(emojiRegex());
    if (!chanStartsWithEmoji) {
      const date = new Date();
      const day = date.getDate();
      const month = date.getMonth();

      let emojis = [];
      if (month === 9 && day >= 15) { // Halloween
        emojis = ['💀', '👽', '👻', '🧙', '🧛', '🧟', '🦇', '🦉', '🎃', '😈'];
      } else if (month === 11) { // Christmas
        emojis = ['🎅', '⛄', '🦌', '🎄', '🎁', '🧦', '👼'];
      } else if (month === 3) {
        if (day === 1) { // April Fools
          emojis = ['🐟', '🎣', '🐠', '🐡', '🦈'];
        } else { // Easter
          emojis = ['🐰', '🐇', '🐣', '🥚', '🍫', '🎀', '🔔'];
        }
      } else if (month === 6 || month === 7) { // Summer
        emojis = ['🌴', '🌞', '😎', '🏊', '🚵'];
      } else { // Classic
        emojis = ['🏓', '🧨', '💥', '💣'];
      }

      const randEmojiNum = Math.floor(Math.random() * emojis.length);
      channelName = `${emojis[randEmojiNum]} ${channelName}`;
    }

    // create the channel
    Logger.info(`owchan - Creating channel "${channelName}" in category "${this.parentCategory.name}"...`);
    Logger.verbose(`owchan - ${JSON.stringify(channelOptions)}`);
    message.guild.channels.create(channelName, channelOptions)
      .then((newVoiceChannel) => {
        // add to created channels array, in order to delete later (when no one left in the channel)
        that.createdChannels.push(newVoiceChannel.id);

        // if user is in voice chat, move him in the new created channel
        if (message.member.voice.channelId && this.moveUserInCreatedChannel) {
          message.member.voice.setChannel(newVoiceChannel)
            .then(() => {
              Logger.info('owchan - Channel has been successfully created !');
              Message.success(message.channel, {
                title: Constants.CHANNEL_CREATED_AND_MOVED_TITLE,
                description: Mustache.render(Constants.CHANNEL_CREATED_AND_MOVED_DESCRIPTION, {
                  newVoiceChannelName: newVoiceChannel.name,
                  limitMessage,
                }),
              });
            })
            .catch((error) => {
              Logger.error(`owchan - ${error}`);
              Message.warn(message.channel, {
                title: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_TITLE,
                description: Constants.CHANNEL_CREATED_BUT_MOVE_ERROR_DESCRIPTION,
              });
            });
        } else {
          // add the defined timeout for the operation...
          Logger.info(`owchan - Since no one for the moment, applying timeout with value ${that.timeoutValue} milliseconds...`);
          that.channelsTimeouts[newVoiceChannel.id] = client.setTimeout(
            that.timeoutMethod,
            that.timeoutValue,
            that,
            newVoiceChannel,
          );

          Logger.info('owchan - Channel has been successfully created !');
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
        Logger.error(`owchan - ${error}`);
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
      if (channelIndex !== -1 && (oldUserChannel.members.size === 0)) {
        // add the defined timeout for the operation...
        Logger.info(`owchan - no one left in channel ${oldUserChannel.name}... Applying timeout with value ${this.timeoutValue} milliseconds...`);
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
      Logger.info(`owchan - someone joined channel ${newUserChannel.name} before end of timeout ! clear timeout...`);
      client.clearTimeout(this.channelsTimeouts[newUserChannel.id]);
      delete this.channelsTimeouts[newUserChannel.id];
    }
  },
  timeoutMethod(context, userChannel) {
    // now delete the channel from the created channels, the channels timeouts and the server
    Logger.info(`owchan - timeout for channel ${userChannel.name} reached ! Deleting it...`);
    const channelIndex = context.createdChannels.indexOf(userChannel.id);
    context.createdChannels.splice(channelIndex, 1);
    delete context.channelsTimeouts[userChannel.id];

    userChannel.delete()
      .catch((error) => Logger.error(`owchan - ${error}`));
  },
};
