const Discord = require('discord.js');
const Mustache = require('mustache');

const Constants = require('../constants/message.json');
const Logger = require('./logger');

module.exports = {
  error(channel, data) {
    return this.message(channel, Object.assign(data, {
      title: Mustache.render(Constants.ERROR_MESSAGE, { title: data.title }),
      color: 'RED',
    }));
  },
  warn(channel, data) {
    return this.message(channel, Object.assign(data, {
      title: Mustache.render(Constants.WARNING_MESSAGE, { title: data.title }),
      color: 'ORANGE',
    }));
  },
  info(channel, data) {
    return this.message(channel, Object.assign(data, {
      color: 'DARK_BLUE',
    }));
  },
  success(channel, data) {
    return this.message(channel, Object.assign(data, {
      color: 'DARK_GREEN',
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

    const embed = new Discord.MessageEmbed()
      .setColor(data.color)
      .setTitle(data.title)
      .setDescription(data.description)
      .setURL(data.url ? data.url : '');

    return channel.send({ embeds: [embed] });
  },
};
