const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder,
} = require('discord.js');
const Mustache = require('mustache');

const MessageConstants = require('../constants/message.json');
const Logger = require('./logger');

module.exports = {
  getErrorData(data) {
    return Object.assign(data, {
      title: Mustache.render(MessageConstants.ERROR_MESSAGE, { title: data.title }),
      color: Colors.DarkRed,
    });
  },
  getWarningdata(data) {
    return Object.assign(data, {
      title: Mustache.render(MessageConstants.WARNING_MESSAGE, { title: data.title }),
      color: Colors.Orange,
    });
  },
  getInfoData(data) {
    return Object.assign(data, {
      color: Colors.DarkBlue,
    });
  },
  getSuccessData(data) {
    return Object.assign(data, {
      color: Colors.DarkGreen,
    });
  },
  getEmbedFromData(data) {
    const embed = new EmbedBuilder()
      .setColor(data.color)
      .setTitle(data.title)
      .setDescription(data.description);

    if (data.url) {
      embed.setURL(data.url);
    }

    return embed;
  },
  getButtonsFromData(data) {
    if (!data.buttons) {
      return null;
    }

    const buttons = [];

    for (const dataButton of data.buttons) {
      const button = new ButtonBuilder()
        .setCustomId(dataButton.id)
        .setLabel(dataButton.label)
        .setStyle(dataButton.style ? dataButton.style : ButtonStyle.Primary)
        .setEmoji(dataButton.emoji ? dataButton.emoji : '🔊');

      if (typeof dataButton.disabled !== 'undefined') {
        button.setDisabled(dataButton.disabled);
      }
      if (dataButton.url) {
        button.setURL(dataButton.url);
      }
      buttons.push(button);
    }

    return buttons;
  },
  getMessageFromData(data) {
    const replyMessage = {
      embeds: [this.getEmbedFromData(data)],
    };
    const buttons = this.getButtonsFromData(data);
    if (buttons) {
      const row = new ActionRowBuilder().addComponents(buttons);
      replyMessage.components = [row];
    }
    if (data.ephemeral) {
      replyMessage.ephemeral = true;
    }
    return replyMessage;
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

    return channel.send(this.getMessageFromData(data));
  },
  async errorReply(interaction, data) {
    return this.reply(interaction, this.getErrorData(data));
  },
  async warnReply(interaction, data) {
    return this.reply(interaction, this.getWarningdata(data));
  },
  async infoReply(interaction, data) {
    return this.reply(interaction, this.getInfoData(data));
  },
  async successReply(interaction, data) {
    return this.reply(interaction, this.getSuccessData(data));
  },
  async reply(interaction, data) {
    Logger.verbose('message - reply');
    Logger.verbose(`message - ${JSON.stringify(data)}`);

    Logger.info(`message - ${data.title}`);
    Logger.info(`message - ${data.description}`);

    return interaction.reply(this.getMessageFromData(data));
  },
};
