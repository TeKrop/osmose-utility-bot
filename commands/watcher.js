const Mustache = require('mustache');
const { Collection } = require('discord.js');

const Config = require('../config.json');
const Constants = require('../constants/watcher.json');
const Logger = require('../services/logger');
const Message = require('../services/message');
const { fillCollection } = require('../services/utils');

module.exports = {
  name: 'watcher',
  guildMemberRemoveChannel: null,
  guildMemberAddChannel: null,
  specialInvites: {},
  guildMemberUpdateChannel: null,
  userUpdateChannel: null,
  exceptionUsers: [],
  memberUpdateMessages: new Collection(),
  memberLeavedMessages: new Collection(),
  memberKickedMessages: new Collection(),
  memberBannedMessages: new Collection(),
  adminUserUrl: '',
  invites: null,
  async onBotReady(client) {
    const guild = client.guilds.cache.first();
    const watcherConfig = Config.commands.watcher;

    if (typeof watcherConfig.guildMemberRemoveChannel !== 'undefined') {
      this.guildMemberRemoveChannel = guild.channels.cache.get(
        watcherConfig.guildMemberRemoveChannel,
      );
    }

    if (typeof watcherConfig.guildMemberAddChannel !== 'undefined') {
      this.guildMemberAddChannel = guild.channels.cache.get(
        watcherConfig.guildMemberAddChannel,
      );
    }

    if (
      typeof watcherConfig.specialInvites !== 'undefined'
      && Object.keys(watcherConfig.specialInvites).length > 0
    ) {
      this.specialInvites = watcherConfig.specialInvites;
    }

    if (typeof watcherConfig.guildMemberUpdateChannel !== 'undefined') {
      this.guildMemberUpdateChannel = guild.channels.cache.get(
        watcherConfig.guildMemberUpdateChannel,
      );
    }

    if (typeof watcherConfig.userUpdateChannel !== 'undefined') {
      this.userUpdateChannel = guild.channels.cache.get(
        watcherConfig.userUpdateChannel,
      );
    }

    if (typeof watcherConfig.exceptionUsers !== 'undefined'
      && watcherConfig.exceptionUsers.length > 0
    ) {
      this.exceptionUsers = watcherConfig.exceptionUsers;
    }

    if (typeof watcherConfig.memberUpdateMessages !== 'undefined'
      && watcherConfig.memberUpdateMessages.length > 0
    ) {
      fillCollection(this.memberUpdateMessages, watcherConfig.memberUpdateMessages);
    }

    if (typeof watcherConfig.memberLeavedMessages !== 'undefined'
      && watcherConfig.memberLeavedMessages.length > 0
    ) {
      fillCollection(this.memberLeavedMessages, watcherConfig.memberLeavedMessages);
    }

    if (typeof watcherConfig.memberKickedMessages !== 'undefined'
      && watcherConfig.memberKickedMessages.length > 0
    ) {
      fillCollection(this.memberKickedMessages, watcherConfig.memberKickedMessages);
    }

    if (typeof watcherConfig.memberBannedMessages !== 'undefined'
      && watcherConfig.memberBannedMessages.length > 0
    ) {
      fillCollection(this.memberBannedMessages, watcherConfig.memberBannedMessages);
    }

    if (typeof watcherConfig.adminUserUrl !== 'undefined') {
      this.adminUserUrl = watcherConfig.adminUserUrl;
    }

    Logger.info('watcher - Fetching guild invites...');
    this.invites = await guild.invites.fetch();
    Logger.verbose(`watcher - ${JSON.stringify(this.invites)}`);
  },
  async onGuildMemberAdd(client, member) {
    // Don't notify for bots
    if (member.user.bot || this.guildMemberAddChannel === null) {
      return;
    }

    const guild = client.guilds.cache.first();

    Logger.info('watcher - An new user joined the server...');

    // To compare, we need to load the current invite list.
    guildInvites = await guild.invites.fetch();
    Logger.verbose(`watcher - ${JSON.stringify(guildInvites)}`);

    // This is the *existing* invites for the guild.
    const ei = this.invites;
    // Update the cached invites for the guild.
    this.invites = guildInvites;
    // Look through the invites, find the one for which the uses went up.
    let invite = guildInvites.find(i => ei.has(i.code) && ei.get(i.code).uses < i.uses);

    // Check if an invite existed before, but not anymore.
    // If this is the case, it's the one
    if (typeof invite === 'undefined') {
      Logger.info(`watcher - we must search in old invites which existed before but not anymore...`);
      // search for old invites which is not here anymore
      const oldInvites = ei.filter(i => !guildInvites.has(i.code));
      // if we have only one invite, this is the one
      if (oldInvites.size === 1) {
        invite = oldInvites.first();
      }
    }

    // Finally, if we didn't find any corresponding invite, check if we have
    // one new invite with at least one use since last fetch.
    // if this is the case, this is the one. If we have more than
    // one new invite with at least one use, we can't know
    // which one has been used... (it should not happen)
    if (typeof invite === 'undefined') {
      Logger.warn(`watcher - we must search in new invites since last fetch...`);
      // search for new invites with at least one use
      const newInvites = guildInvites.filter(i => !ei.has(i.code) && i.uses > 0);
      // if we have only one invite, this is the one
      if (newInvites.size === 1) {
        invite = newInvites.first();
      }
    }

    // if invite hasn't been found, send a message anyway
    let userOrigin = Constants.USER_INVITED_BY_UNKNOWN;
    if (typeof invite !== 'undefined') {
      if (invite.code in this.specialInvites) {
        // if this is a special invite, customize the message
        userOrigin = Mustache.render(Constants.USER_INVITED_BY_SPECIAL_INVITE, {
          specialInvite: this.specialInvites[invite.code],
        });
      } else if (invite.inviter) {
        // else, search if we have a specific inviter
        const inviter = await guild.members.fetch(invite.inviter.id);
        if (inviter) {
          userOrigin = Mustache.render(Constants.USER_INVITED_BY_INVITER, {
            inviter: inviter.displayName,
          });
        }
      }
      // else we don't have any precision about the origin of the user...
    }

    Logger.info(`watcher - displayName : ${member.displayName}. userTag : ${member.user.tag}. userOrigin : ${userOrigin}`);

    Message.info(this.guildMemberAddChannel, {
      title: Constants.NEW_USER_JOINED_SERVER_TITLE,
      description: Mustache.render(Constants.NEW_USER_JOINED_SERVER_DESCRIPTION, {
        displayName: member.displayName,
        userTag: member.user.tag,
        userOrigin,
      }),
    });
  },
  async onGuildMemberRemove(client, member) {
    if (this.guildMemberRemoveChannel === null) {
      return;
    }

    const guild = client.guilds.cache.first();

    let messageTitle = Constants.USER_LEAVED_SERVER;
    let descriptions = this.memberLeavedMessages;

    const audit = await guild.fetchAuditLogs();
    const logs = audit.entries.filter(log =>
      log.target
      && log.target.id === member.user.id
      && log.actionType === 'DELETE'
    );
    if (logs.size > 0) {
      const now = Date.now();

      // check if we have at least one log in the last 5 seconds
      const lastLog = logs.find((log) => log.createdTimestamp > (now - 5000));
      if (typeof lastLog !== 'undefined') {
        if (lastLog.action === 'MEMBER_KICK') {
          messageTitle = Mustache.render(Constants.USER_WAS_KICKED_BY_USER, {
            executor: lastLog.executor.username,
          });
          descriptions = this.memberKickedMessages;
        } else if (lastLog.action === 'MEMBER_BAN_ADD') {
          messageTitle = Mustache.render(Constants.USER_WAS_BANNED_BY_USER, {
            executor: lastLog.executor.username,
          });
          descriptions = this.memberBannedMessages;
        }
      }
    }

    if (descriptions.size === 0) {
      return;
    }

    let messageDescription = descriptions.random();
    messageDescription = Mustache.render(messageDescription, {
      X: `**${member.displayName}**`,
    });

    // send a message to the configured channel
    Message.info(this.guildMemberRemoveChannel, {
      title: messageTitle,
      description: messageDescription,
      url: Mustache.render(this.adminUserUrl, { memberUserId: member.user.id }),
    });
  },
  onGuildMemberUpdate(client, oldMember, newMember) {
    // if displayName or tag didn't change, do nothing
    if (oldMember.displayName === newMember.displayName) {
      return;
    }

    // if the tag didn't change too much (one is similar to another)
    if (
      oldMember.displayName.includes(newMember.displayName)
      || newMember.displayName.includes(oldMember.displayName)
    ) {
      return;
    }

    // if user is in exception, don't log
    if (this.exceptionUsers.includes(newMember.user.id)) {
      return;
    }

    if (this.guildMemberUpdateChannel === null || this.memberUpdateMessages.size === 0) {
      return;
    }

    const message = Mustache.render(this.memberUpdateMessages.random(), {
      A: oldMember.displayName,
      B: newMember.displayName,
    });

    Logger.info(`watcher - A user changed his username from ${oldMember.displayName} to ${newMember.displayName}`);

    // send a message to the configured channel
    Message.info(this.guildMemberUpdateChannel, {
      title: Constants.USER_CHANGED_HIS_USERNAME,
      description: message,
    });
  },
  onUserUpdate(client, oldUser, newUser) {
    // if tag didn't change
    if (oldUser.tag === newUser.tag) {
      return;
    }

    // if the tag didn't change too much (one is similar to another)
    if (oldUser.tag.includes(newUser.username) || newUser.tag.includes(oldUser.username)) {
      return;
    }

    // if user is in exception, don't log
    if (this.exceptionUsers.includes(newUser.id)) {
      return;
    }

    if (this.memberUpdateMessages.size === 0) {
      return;
    }

    if (this.guildMemberUpdateChannel !== null) {
      const guild = client.guilds.cache.first();
      const guildMember = guild.members.resolve(newUser);
      if (guildMember.displayName === newUser.username) {
        // send a message to the configured channel
        const memberUpdateMessage = Mustache.render(this.memberUpdateMessages.random(), {
          A: oldUser.username,
          B: newUser.username,
        });
        Message.info(this.guildMemberUpdateChannel, {
          title: Constants.USER_CHANGED_HIS_USERNAME,
          description: memberUpdateMessage,
        });
      }
    }

    // send a message to the configured channel
    if (this.userUpdateChannel !== null) {
      const userUpdateMessage = Mustache.render(this.memberUpdateMessages.random(), {
        A: oldUser.tag,
        B: newUser.tag,
      });
      Message.info(this.userUpdateChannel, {
        title: Constants.USER_CHANGED_HIS_DISCORD_TAG,
        description: userUpdateMessage,
      });
    }
  },
  onInviteCreate(client, invite) {
    // if the invite is already in the list, do nothing
    if (this.invites.has(invite.code)) {
      return;
    }
    Logger.info(`watcher - Adding a new invite to the list (${invite.code})`);
    Logger.verbose(`watcher - ${JSON.stringify(invite)})`);
    this.invites.set(invite.code, invite);
  },
  onInviteDelete(client, invite) {
    // if the invite is not in the list, do nothing
    if (!this.invites.has(invite.code)) {
      return;
    }
    const that = this;

    Logger.info('watcher - Waiting 1 second to delete the invite (in case we need it for welcome process)...');
    Logger.verbose(`watcher - ${JSON.stringify(invite)})`);
    setTimeout(() => {
      Logger.info(`watcher - Deleting the invite from the list (${invite.code})`);
      that.invites.delete(invite.code);
    }, 1000);
  }
};
