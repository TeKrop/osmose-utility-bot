const Mustache = require('mustache');

const Config = require('../config.json');
const Constants = require('../constants/watcher.json');
const Logger = require('../services/logger');
const Message = require('../services/message');

module.exports = {
  name: 'watcher',
  guildMemberRemoveChannel: null,
  guildMemberAddChannel: null,
  specialInvites: {},
  guildMemberUpdateChannel: null,
  userUpdateChannel: null,
  exceptionUsers: [],
  memberUpdateMessages: [],
  memberLeavedMessages: [],
  memberKickedMessages: [],
  memberBannedMessages: [],
  adminUserUrl: '',
  invites: null,
  onBotReady(client) {
    const guild = client.guilds.cache.first();
    const that = this;

    if (typeof Config.commands.watcher.guildMemberRemoveChannel !== 'undefined') {
      this.guildMemberRemoveChannel = guild.channels.cache.get(
        Config.commands.watcher.guildMemberRemoveChannel,
      );
    }

    if (typeof Config.commands.watcher.guildMemberAddChannel !== 'undefined') {
      this.guildMemberAddChannel = guild.channels.cache.get(
        Config.commands.watcher.guildMemberAddChannel,
      );
    }

    if (
      typeof Config.commands.watcher.specialInvites !== 'undefined'
      && Object.keys(Config.commands.watcher.specialInvites).length > 0
    ) {
      this.specialInvites = Config.commands.watcher.specialInvites;
    }

    if (typeof Config.commands.watcher.guildMemberUpdateChannel !== 'undefined') {
      this.guildMemberUpdateChannel = guild.channels.cache.get(
        Config.commands.watcher.guildMemberUpdateChannel,
      );
    }

    if (typeof Config.commands.watcher.userUpdateChannel !== 'undefined') {
      this.userUpdateChannel = guild.channels.cache.get(
        Config.commands.watcher.userUpdateChannel,
      );
    }

    if (typeof Config.commands.watcher.exceptionUsers !== 'undefined'
      && Config.commands.watcher.exceptionUsers.length > 0
    ) {
      this.exceptionUsers = Config.commands.watcher.exceptionUsers;
    }

    if (typeof Config.commands.watcher.memberUpdateMessages !== 'undefined'
      && Config.commands.watcher.memberUpdateMessages.length > 0
    ) {
      this.memberUpdateMessages = Config.commands.watcher.memberUpdateMessages;
    }

    if (typeof Config.commands.watcher.memberLeavedMessages !== 'undefined'
      && Config.commands.watcher.memberLeavedMessages.length > 0
    ) {
      this.memberLeavedMessages = Config.commands.watcher.memberLeavedMessages;
    }

    if (typeof Config.commands.watcher.memberKickedMessages !== 'undefined'
      && Config.commands.watcher.memberKickedMessages.length > 0
    ) {
      this.memberKickedMessages = Config.commands.watcher.memberKickedMessages;
    }

    if (typeof Config.commands.watcher.memberBannedMessages !== 'undefined'
      && Config.commands.watcher.memberBannedMessages.length > 0
    ) {
      this.memberBannedMessages = Config.commands.watcher.memberBannedMessages;
    }

    if (typeof Config.commands.watcher.adminUserUrl !== 'undefined') {
      this.adminUserUrl = Config.commands.watcher.adminUserUrl;
    }

    // wait for additionnal 1s before initializing
    setTimeout(() => {
      Logger.info('watcher - Fetching guild invites...');
      guild.invites.fetch().then((guildInvites) => {
        that.invites = guildInvites;
        Logger.verbose(`watcher - ${JSON.stringify(that.invites)}`);
      });
    }, 1000);
  },
  onGuildMemberAdd(client, member) {
    // Don't notify for bots
    if (member.user.bot || this.guildMemberAddChannel === null) {
      return;
    }

    const guild = client.guilds.cache.first();

    Logger.info('watcher - An new user joined the server...');

    // To compare, we need to load the current invite list.
    guild.invites.fetch().then((guildInvites) => {
      Logger.verbose(`watcher - ${JSON.stringify(guildInvites)}`);

      // This is the *existing* invites for the guild.
      const ei = this.invites;
      // Update the cached invites for the guild.
      this.invites = guildInvites;
      // Look through the invites, find the one for which the uses went up.
      let invite = guildInvites.find((i) => {
        // if the invite didn't exist before, pass
        if (!ei.get(i.code)) return false;
        return ei.get(i.code).uses < i.uses;
      });

      // if we didn't find any corresponding invite, check if we have
      // one new invite with at least one use since last fetch.
      // if this is the case, this is the one. If we have more than
      // one new invite with at least one use, we can't know
      // which one has been used... (it should not happend)
      if (invite === null || invite === undefined) {
        // search new invites with at least one use
        const newInvites = [];
        guildInvites.forEach((i) => {
          // if the invitation existed before, pass
          if (ei.get(i.code)) return;
          // if the invitation hasn't been used yet, pass
          if (i.uses === 0) return;
          newInvites.push(i);
        });
        // if we have only one invite, this is the one
        if (newInvites.length === 1) {
          [invite] = newInvites;
        }
      }

      // Finally, check if an invite existed before, but not anymore.
      // If this is the case, it's the one
      if (invite === null || invite === undefined) {
        // search new invites with at least one use
        const oldInvites = [];
        ei.forEach((i) => {
          // if the invitation still exists, pass
          if (guildInvites.get(i.code)) return;
          oldInvites.push(i);
        });
        // if we have only one invite, this is the one
        if (oldInvites.length === 1) {
          [invite] = oldInvites;
        }
      }

      // if invite hasn't been found, send a message anyway
      let userOrigin = Constants.USER_INVITED_BY_UNKNOWN;
      if (invite !== null && invite !== undefined) {
        if (invite.code in this.specialInvites) {
          // if this is a special invite, customize the message
          userOrigin = Mustache.render(Constants.USER_INVITED_BY_SPECIAL_INVITE, {
            specialInvite: this.specialInvites[invite.code],
          });
        } else if (invite.inviter) {
          // else, search if we have a specific inviter
          const inviter = guild.members.cache.get(invite.inviter.id);
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
    });
  },
  onGuildMemberRemove(client, member) {
    if (this.guildMemberRemoveChannel === null) {
      return;
    }

    const guild = client.guilds.cache.first();

    let messageTitle = Constants.USER_LEAVED_SERVER;
    let descriptions = this.memberLeavedMessages;

    guild.fetchAuditLogs({
      type: 'DELETE',
    }).then((audit) => {
      const deleteActions = ['MEMBER_BAN_ADD', 'MEMBER_KICK'];
      const logs = audit.entries.filter((log) => log.target
        && log.target.id === member.user.id
        && deleteActions.indexOf(log.action) !== -1);

      if (logs.size > 0) {
        const now = Date.now();

        // check if we have at least one log in the last 5 seconds
        const lastLog = logs.find((log) => log.createdTimestamp > (now - 5000));

        if (lastLog !== null && lastLog !== undefined) {
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

      if (descriptions.length === 0) {
        return;
      }

      const randDescriptionNum = Math.floor(Math.random() * descriptions.length);
      let messageDescription = descriptions[randDescriptionNum];
      messageDescription = Mustache.render(messageDescription, {
        X: `**${member.displayName}**`,
      });

      // send a message to the configured channel
      Message.info(this.guildMemberRemoveChannel, {
        title: messageTitle,
        description: messageDescription,
        url: Mustache.render(this.adminUserUrl, { memberUserId: member.user.id }),
      });
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

    if (this.guildMemberUpdateChannel === null || this.memberUpdateMessages.length === 0) {
      return;
    }

    const randMessageNum = Math.floor(Math.random() * this.memberUpdateMessages.length);
    const message = Mustache.render(this.memberUpdateMessages[randMessageNum], {
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

    if (this.memberUpdateMessages.length === 0) {
      return;
    }

    const randMessageNum = Math.floor(Math.random() * this.memberUpdateMessages.length);

    if (this.guildMemberUpdateChannel !== null) {
      const guild = client.guilds.cache.first();
      const guildMember = guild.members.resolve(newUser);
      if (guildMember.displayName === newUser.username) {
        // send a message to the configured channel
        const memberUpdateMessage = Mustache.render(this.memberUpdateMessages[randMessageNum], {
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
      const userUpdateMessage = Mustache.render(this.memberUpdateMessages[randMessageNum], {
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
    Logger.info(`watcher - Deleting an invite from the list (${invite.code})`);
    Logger.verbose(`watcher - ${JSON.stringify(invite)})`);
    this.invites.delete(invite.code);
  }
};
