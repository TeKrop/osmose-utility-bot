const Mustache = require('mustache');

const Config = require('../config.json');
const Constants = require('../constants/massmove.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'massmove',
  currentChannelAlias: 'here',
  onBotReady() {
    if (typeof Config.commands.massmove.currentChannelAlias !== 'undefined') {
      this.currentChannelAlias = Config.commands.massmove.currentChannelAlias;
    }
  },
  execute(client, message, args) {
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

    const commandAuthorChannel = message.member.voice.channelId || null;

    // if only one arg, we want to move from
    // current author channel to another channel
    if (processedArgs.length === 1) {
      if (commandAuthorChannel === null) {
        Message.error(message.channel, {
          title: Constants.ONLY_DESTINATION_BUT_NOT_CONNECTED_TITLE,
          description: Constants.ONLY_DESTINATION_BUT_NOT_CONNECTED_DESCRIPTION,
        });
        Logger.warn('massmove - Invalid use (user specified only destination but is not connected)');
        return;
      }
      processedArgs = [message.member.voice.channel.name, processedArgs[0]];
    }

    // loop over chans and search for corresponding voice channels
    const chans = [];
    for (let i = 0; i < 2; i += 1) {
      if (processedArgs[i] === this.currentChannelAlias) {
        if (commandAuthorChannel === null) {
          Message.error(message.channel, {
            title: Constants.CURRENT_DESTINATION_BUT_NOT_CONNECTED_TITLE,
            description: Constants.CURRENT_DESTINATION_BUT_NOT_CONNECTED_DESCRIPTION,
          });
          Logger.warn('massmove - Invalid use (user specified current channel but is not connected)');
          return;
        }
        chans[i] = commandAuthorChannel;
      } else {
        const foundChannels = [];
        const argLength = processedArgs[i].length;

        // loop over guild channels to find the one we want
        message.guild.channels.cache.each((channel) => {
          if (!channel.isVoice()) return; // only voice channels

          // if channel name doesn't match, continue
          if (!channel.name.toLowerCase().includes(processedArgs[i].toLowerCase())) return;

          // it's a match ! retrieve details...
          foundChannels.push({
            id: channel.id,
            diff: channel.name.length - argLength,
          });
        });

        if (foundChannels.length === 1) {
          chans[i] = foundChannels[0].id;
        } else if (foundChannels.length > 1) {
          foundChannels.sort((a, b) => a.diff - b.diff);
          chans[i] = foundChannels[0].id;
        }
      }
    }

    // if one of the two chans were not found...
    if (!chans[0] || !chans[1]) {
      if (chans[0] !== null && chans[1] !== null) {
        const notFoundChans = [];
        if (typeof chans[0] === 'undefined') {
          notFoundChans.push(processedArgs[0]);
        }
        if (typeof chans[1] === 'undefined') {
          if (notFoundChans.length === 0 || notFoundChans[0] !== processedArgs[1]) {
            notFoundChans.push(processedArgs[1]);
          }
        }
        Message.error(message.channel, {
          title: Constants.CHANNELS_NOT_FOUND_TITLE,
          description: Mustache.render(Constants.CHANNELS_NOT_FOUND_DESCRIPTION, {
            notFoundChannels: notFoundChans.join(', '),
          }),
        });
        Logger.warn(`massmove - One of the specified channels was not found (${notFoundChans.join(', ')})`);
      }
      return;
    }

    // if same channels, don't do anything
    if (chans[0] === chans[1]) {
      Message.warn(message.channel, {
        title: Constants.SAME_ORIGIN_AND_DESTINATION_TITLE,
        description: Constants.SAME_ORIGIN_AND_DESTINATION_DESCRIPTION,
      });
      Logger.warn('massmove - Origin and destination channel are the same');
      return;
    }

    // assemble members to move from origin
    const membersToMove = [];
    message.guild.channels.cache.each((channel, channelSnowflake) => {
      if (!channel.isVoice()) return; // only voice channels
      if (channelSnowflake === chans[0]) {
        channel.members.each((member) => {
          membersToMove.push(member);
        });
      }
    });

    Logger.info(`massmove - nb members to move : ${membersToMove.length}`);
    if (membersToMove.length === 0) {
      Message.error(message.channel, {
        title: Constants.NO_USER_TO_MOVE_TITLE,
        description: Constants.NO_USER_TO_MOVE_DESCRIPTION,
      });
      return;
    }

    // move them to dest
    for (let i = membersToMove.length - 1; i >= 0; i -= 1) {
      Logger.info(`massmove - moving ${membersToMove[i].displayName}...`);
      membersToMove[i].voice.setChannel(chans[1])
        .then(() => Logger.info('massmove - Moved user !'))
        .catch((error) => {
          Logger.error(`massmove - ${error}`);
          Message.error(message.channel, {
            title: Constants.UNKNOWN_MOVE_ERROR_TITLE,
            description: Mustache.render(Constants.UNKNOWN_MOVE_ERROR_DESCRIPTION, {
              memberDisplayName: membersToMove[i].displayName,
            }),
          });
          // remove from array for further success message
          membersToMove.splice(i, 1);
        });
    }

    // find channel names
    const channelNames = [];
    for (let i = 0; i < 2; i += 1) {
      message.guild.channels.cache.each((channel, snowflake) => {
        if (!channel.isVoice()) return; // only voice channels
        // if channel name matches, retrieve it
        if (snowflake === chans[i]) {
          channelNames[i] = channel.name;
        }
      });
    }

    // if we successfully moved more than 0 users, display success
    if (membersToMove.length > 0) {
      Message.success(message.channel, {
        title: Mustache.render(Constants.MASSMOVE_SUCCESSFUL_TITLE, {
          nbMovedUsers: membersToMove.length,
          pluralUsers: (membersToMove.length > 1 ? 's' : ''),
        }),
        description: Mustache.render(Constants.MASSMOVE_SUCCESSFUL_DESCRIPTION, {
          originChannel: channelNames[0],
          destinationChannel: channelNames[1],
        }),
      });
    }
  },
};
