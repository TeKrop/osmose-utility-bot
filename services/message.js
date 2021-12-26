const Discord = require('discord.js');
const Mustache = require('mustache');

const Constants = require('../constants/message.json');
const Logger = require('./logger');

module.exports = {
  getErrorData(data) {
    return Object.assign(data, {
      title: Mustache.render(Constants.ERROR_MESSAGE, { title: data.title }),
      color: 'DARK_RED',
    });
  },
  getWarningdata(data) {
    return Object.assign(data, {
      title: Mustache.render(Constants.WARNING_MESSAGE, { title: data.title }),
      color: 'ORANGE',
    });
  },
  getInfoData(data) {
    return Object.assign(data, {
      color: 'DARK_BLUE',
    });
  },
  getSuccessData(data) {
    return Object.assign(data, {
      color: 'DARK_GREEN',
    });
  },
  getEmbedFromData(data) {
    return new Discord.MessageEmbed()
      .setColor(data.color)
      .setTitle(data.title)
      .setDescription(data.description)
      .setURL(data.url ? data.url : '');
  },
  error(channel, data) {
    return this.message(channel, this.getErrorData(data));
  },
  warn(channel, data) {
    return this.message(channel, this.getWarningdata(data));
  },
  info(channel, data) {
    return this.message(channel, this.getInfoData(data));
  },
  success(channel, data) {
    return this.message(channel, this.getSuccessData(data));
  },
  message(channel, data) {
    if (data.tag && data.tag.length > 0) {
      channel.send(`<@${data.tag}>`);
    }

    Logger.verbose(`message - ${JSON.stringify(data)}`);

    Logger.info(`message - ${data.title}`);
    Logger.info(`message - ${data.description}`);

    return channel.send({ embeds: [this.getEmbedFromData(data)] });
  },
  async errorReply(interaction, data) {
    return await this.reply(interaction, this.getErrorData(data));
  },
  async warnReply(interaction, data) {
    return await this.reply(interaction, this.getWarningdata(data));
  },
  async infoReply(interaction, data) {
    return await this.reply(interaction, this.getInfoData(data));
  },
  async successReply(interaction, data) {
    return await this.reply(interaction, this.getSuccessData(data));
  },
  async reply(interaction, data) {
    Logger.verbose(`message - reply`);
    Logger.verbose(`message - ${JSON.stringify(data)}`);

    Logger.info(`message - ${data.title}`);
    Logger.info(`message - ${data.description}`);

    return await interaction.reply({ embeds: [this.getEmbedFromData(data)] });
  },
};
