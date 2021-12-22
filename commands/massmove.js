const Mustache = require('mustache');
const { Collection } = require('discord.js');

const Config = require('../config.json');
const Constants = require('../constants/massmove.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'massmove',
  async execute(client, message, args) {
    // split by defined separator, and filter empty values
    let processedArgs = args.split(/ --> /);
    for (let i = processedArgs.length - 1; i >= 0; i -= 1) {
      if (processedArgs[i].length === 0) {
        processedArgs.splice(i, 1);
      }
    }

    if (processedArgs.length > 2 || processedArgs.length < 1) {
      Message.error(message.channel, {
        title: Constants.INVALID_PARAMS_NUMBER_TITLE,
        description: Constants.INVALID_PARAMS_NUMBER_DESCRIPTION,
      });
      Logger.warn('massmove - Invalid params number');
      return;
    }

    const commandAuthorChannel = message.member.voice.channel || null;

    // if only one arg, we want to move from
    // current author channel to another channel
    let originChannel = null;
    if (processedArgs.length === 1) {
      if (commandAuthorChannel === null) {
        Message.error(message.channel, {
          title: Constants.ONLY_DESTINATION_BUT_NOT_CONNECTED_TITLE,
          description: Constants.ONLY_DESTINATION_BUT_NOT_CONNECTED_DESCRIPTION,
        });
        Logger.warn('massmove - Invalid use (user specified only destination but is not connected)');
        return;
      }
      originChannel = commandAuthorChannel;
    } else {
      originChannelName = processedArgs[0].toLowerCase();
      originChannel = message.guild.channels.cache.find(channel => {
        return channel.isVoice() && channel.name.toLowerCase().includes(originChannelName);
      });
    }

    // search destination channel
    destinationChannelName = processedArgs[1].toLowerCase();
    const destinationChannel = message.guild.channels.cache.find(channel => {
      return channel.isVoice() && channel.name.toLowerCase().includes(destinationChannelName);
    });

    // if one of the two chans were not found...
    if (originChannel === null || destinationChannel === null) {
      const notFoundChansList = new Set();
      if (originChannel === null) {
        notFoundChansList.add(processedArgs[0]);
      }
      if (destinationChannel === null) {
        notFoundChansList.add(processedArgs[1]);
      }
      notFoundChans = notFoundChansList.join(', ');
      Message.error(message.channel, {
        title: Constants.CHANNELS_NOT_FOUND_TITLE,
        description: Mustache.render(Constants.CHANNELS_NOT_FOUND_DESCRIPTION, {
          notFoundChannels: notFoundChans,
        }),
      });
      Logger.warn(`massmove - One of the specified channels was not found (${notFoundChans})`);
      return;
    }

    // if same channels, don't do anything
    if (originChannel.id === destinationChannel.id) {
      Message.warn(message.channel, {
        title: Constants.SAME_ORIGIN_AND_DESTINATION_TITLE,
        description: Constants.SAME_ORIGIN_AND_DESTINATION_DESCRIPTION,
      });
      Logger.warn('massmove - Origin and destination channel are the same');
      return;
    }

    // assemble members to move from origin
    const membersToMove = originChannel.members;
    if (membersToMove.size === 0) {
      Message.error(message.channel, {
        title: Constants.NO_USER_TO_MOVE_TITLE,
        description: Constants.NO_USER_TO_MOVE_DESCRIPTION,
      });
      return;
    }

    Logger.info(`massmove - nb members to move : ${membersToMove.size}`);

    // move them to destination channel
    membersNotMoved = new Collection();
    membersMoved = new Collection();
    await membersToMove.each( async(member) => {
      try {
        Logger.info(`massmove - moving ${member.displayName}...`);
        await member.voice.setChannel(destinationChannel);
        membersMoved.set(member.id, member);
      } catch (error) {
        Logger.error(`massmove - ${error}`);
        Message.error(message.channel, {
          title: Constants.UNKNOWN_MOVE_ERROR_TITLE,
          description: Mustache.render(Constants.UNKNOWN_MOVE_ERROR_DESCRIPTION, {
            memberDisplayName: member.displayName,
          }),
        });
        membersNotMoved.set(member.id, member);
      }
    });

    // if we didn't move any user, error message
    if (membersMoved.size === 0) {
      Message.error(message.channel, {
        title: Constants.MASSMOVE_NOT_ANY_USER_MOVED_ERROR_TITLE,
        description: Constants.MASSMOVE_NOT_ANY_USER_MOVED_ERROR_DESCRIPTION
      });
      return;
    }

    // if we didn't move some users, warning message
    if (membersNotMoved.size > 0) {
      Message.warn(message.channel, {
        title: Constants.MASSMOVE_SOME_USERS_NOT_MOVED_ERROR_TITLE,
        description: Mustache.render(Constants.MASSMOVE_SOME_USERS_NOT_MOVED_ERROR_DESCRIPTION, {
          nbNotMovedUsers: membersNotMoved.size,
          pluralUsers: (membersNotMoved.size > 1 ? 's' : ''),
          notMovedUsers: membersNotMoved.map(member => member.displayName).join(', ')
        }),
      });
    }

    // success message anyway
    Message.success(message.channel, {
      title: Mustache.render(Constants.MASSMOVE_SUCCESSFUL_TITLE, {
        nbMovedUsers: membersMoved.size,
        pluralUsers: (membersMoved.size > 1 ? 's' : ''),
      }),
      description: Mustache.render(Constants.MASSMOVE_SUCCESSFUL_DESCRIPTION, {
        originChannel: originChannel.name,
        destinationChannel: destinationChannel.name,
      }),
    });
  },
};
