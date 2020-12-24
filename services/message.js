const Discord = require('discord.js');
const Mustache = require('mustache');

const Constants = require('../constants/message.json');
const Logger = require('./logger');

module.exports = {
  error(channel, data) {
    return this.message(channel, Object.assign(data, {
      title: Mustache.render(Constants.ERROR_MESSAGE, { title: data.title }),
      color: '#ff0000',
    }));
  },
  warn(channel, data) {
    return this.message(channel, Object.assign(data, {
      title: Mustache.render(Constants.WARNING_MESSAGE, { title: data.title }),
      color: '#ff8c00',
    }));
  },
  info(channel, data) {
    return this.message(channel, Object.assign(data, {
      color: '#0000cc',
    }));
  },
  success(channel, data) {
    return this.message(channel, Object.assign(data, {
      color: '#007f00',
    }));
  },
  message(channel, data) {
    if (data.tag && data.tag.length > 0) {
      channel.send(`<@${data.tag}>`);
    }

    Logger.verbose(`message - ${JSON.stringify(data)}`);
    Logger.verbose(`message - ${data.url ? data.url : ''}`);

    Logger.info(`message - ${data.title}`);
    Logger.info(`message - ${data.description}`);

    return channel.send(new Discord.MessageEmbed()
      .setColor(data.color)
      .setTitle(data.title)
      .setDescription(data.description)
      .setURL(data.url ? data.url : ''));
  },
};
