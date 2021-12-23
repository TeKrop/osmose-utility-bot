const Mustache = require('mustache');
const { Collection } = require('discord.js');

const Config = require('../config.json');
const Logger = require('./logger');
const { collectionFromArray, fillCollection } = require('./utils');

module.exports = {
  statusList: {},
  categories: new Collection(),
  gamesList: new Collection(),
  moviesList: new Collection(),
  animalsList: new Collection(),
  acceptedMembersRoles: new Collection(),
  adminRole: null,
  async initRandomStatusJob(client) {
    // first, load configuration (list, games, movies, animals, etc.)
    if (!Config.customStatus || !Config.customStatus.list) {
      return;
    }

    const possibleCategories = collectionFromArray(
      ['LISTENING', 'WATCHING', 'PLAYING', 'STREAMING', 'COMPETING'],
    );
    possibleCategories.each((category) => {
      if (Config.customStatus.list[category] && Config.customStatus.list[category].length > 0) {
        this.statusList[category] = collectionFromArray(Config.customStatus.list[category]);
      }
    });

    fillCollection(this.categories, Object.keys(this.statusList));
    if (this.categories.size === 0) {
      return;
    }

    if (Config.customStatus.games && Config.customStatus.games.length > 0) {
      fillCollection(this.gamesList, Config.customStatus.games);
    }
    if (Config.customStatus.movies && Config.customStatus.movies.length > 0) {
      fillCollection(this.moviesList, Config.customStatus.movies);
    }
    if (Config.customStatus.animals && Config.customStatus.animals.length > 0) {
      fillCollection(this.animalsList, Config.customStatus.animals);
    }

    if (Config.customStatus.membersRoles && Config.customStatus.membersRoles.length > 0) {
      fillCollection(this.acceptedMembersRoles, Config.customStatus.membersRoles);
    }
    if (Config.customStatus.adminRole && Config.customStatus.adminRole.length > 0) {
      this.adminRole = Config.customStatus.adminRole;
    }

    // now, set the first random status and timer for next ones
    await this.setRandomCustomStatus(client);

    let timeInterval = 1800000; // default : every half-hour
    if (Config.customStatus && Config.customStatus.timeInterval) {
      timeInterval = Config.customStatus.timeInterval;
    }

    const that = this;
    setInterval(() => {
      that.setRandomCustomStatus(client);
    }, timeInterval);
  },
  async setRandomCustomStatus(client) {
    const guild = client.guilds.cache.first();

    // get guildMembers and filter bots
    const allGuildMembers = await guild.members.fetch();
    const guildMembers = allGuildMembers.filter((member) => !member.user.bot);

    // construct members list and admin list
    const adminsList = guildMembers.filter((member) => (
      member.roles.cache.has(this.adminRole)
    ));
    const membersList = guildMembers.filter((member) => (
      !member.roles.cache.has(this.adminRole)
        && member.roles.cache.hasAny(this.acceptedMembersRoles)
    ));

    // create a random status
    const category = this.categories.random();
    let status = this.statusList[category].random();
    const replacements = {};

    if (this.gamesList.size > 0) {
      replacements.GAME = this.gamesList.random();
    }

    if (this.moviesList.size > 0) {
      replacements.MOVIE = this.moviesList.random();
    }

    if (this.animalsList.size > 0) {
      replacements.ANIMAL = this.animalsList.random();
    }

    if (adminsList.size > 0) {
      replacements.ADMIN = adminsList.random();
    }

    if (membersList.size > 0) {
      replacements.MEMBER = membersList.random();
    }

    if (Object.keys(replacements).length > 0) {
      status = Mustache.render(status, replacements);
    }

    Logger.info(`customStatus - Setting new status for Discord Bot : category = "${category}" and status = "${status}"`);
    client.user.setActivity(status, { type: category });
  },
};
