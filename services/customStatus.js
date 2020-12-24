const Mustache = require('mustache');

const Config = require('../config.json');
const Logger = require('./logger');

module.exports = {
  statusList: {},
  categories: [],
  gamesList: [],
  moviesList: [],
  animalsList: [],
  acceptedMembersRoles: [],
  adminRole: null,
  initRandomStatusJob(client) {
    // first, load configuration (list, games, movies, animals, etc.)
    if (!Config.customStatus || !Config.customStatus.list) {
      return;
    }

    const possibleCategories = ['LISTENING', 'WATCHING', 'PLAYING', 'STREAMING', 'COMPETING'];
    for (let i = possibleCategories.length - 1; i >= 0; i -= 1) {
      if (
        Config.customStatus.list[possibleCategories[i]]
        && Config.customStatus.list[possibleCategories[i]].length > 0
      ) {
        this.statusList[possibleCategories[i]] = Config.customStatus.list[possibleCategories[i]];
      }
    }

    this.categories = Object.keys(this.statusList);
    if (this.categories.length === 0) {
      return;
    }

    if (Config.customStatus.games && Config.customStatus.games.length > 0) {
      this.gamesList = Config.customStatus.games;
    }
    if (Config.customStatus.movies && Config.customStatus.movies.length > 0) {
      this.moviesList = Config.customStatus.movies;
    }
    if (Config.customStatus.animals && Config.customStatus.animals.length > 0) {
      this.animalsList = Config.customStatus.animals;
    }

    if (Config.customStatus.membersRoles && Config.customStatus.membersRoles.length > 0) {
      this.acceptedMembersRoles = Config.customStatus.membersRoles;
    }
    if (Config.customStatus.adminRole && Config.customStatus.adminRole.length > 0) {
      this.adminRole = Config.customStatus.adminRole;
    }

    // now, set the first random status and timer for next ones
    this.setRandomCustomStatus(client);

    let timeInterval = 1800000; // default : every half-hour
    if (Config.customStatus && Config.customStatus.timeInterval) {
      timeInterval = Config.customStatus.timeInterval;
    }

    const that = this;
    setInterval(() => {
      that.setRandomCustomStatus(client);
    }, timeInterval);
  },
  setRandomCustomStatus(client) {
    const guild = client.guilds.cache.array()[0];

    // get guildMembers and filter bots
    const allGuildMembers = guild.members.cache.array();
    const guildMembers = [];
    for (let i = 0; i < allGuildMembers.length; i += 1) {
      if (!allGuildMembers[i].user.bot) {
        guildMembers.push(allGuildMembers[i]);
      }
    }

    // construct members list and admin list
    const membersList = [];
    const adminsList = [];
    for (let i = guildMembers.length - 1; i >= 0; i -= 1) {
      const roles = guildMembers[i].roles.cache.array();

      let membersRoleOk = false;
      let adminRoleOk = false;
      for (let j = roles.length - 1; j >= 0; j -= 1) {
        if (roles[j].id === this.adminRole) {
          adminRoleOk = true;
          break;
        } else if (this.acceptedMembersRoles.indexOf(roles[j].id) !== -1) {
          membersRoleOk = true;
          break;
        }
      }

      if (membersRoleOk) {
        membersList.push(guildMembers[i].displayName);
      } else if (adminRoleOk) {
        adminsList.push(guildMembers[i].displayName);
      }
    }

    // create a random status
    const randCategoryNum = Math.floor(Math.random() * this.categories.length);
    const category = this.categories[randCategoryNum];
    const randStatusNum = Math.floor(Math.random() * this.statusList[category].length);

    let status = this.statusList[category][randStatusNum];
    const replacements = {};

    if (this.gamesList.length > 0) {
      const randGameNum = Math.floor(Math.random() * this.gamesList.length);
      replacements.GAME = this.gamesList[randGameNum];
    }

    if (this.moviesList.length > 0) {
      const randMovieNum = Math.floor(Math.random() * this.moviesList.length);
      replacements.MOVIE = this.moviesList[randMovieNum];
    }

    if (this.animalsList.length > 0) {
      const randAnimalNum = Math.floor(Math.random() * this.animalsList.length);
      replacements.ANIMAL = this.animalsList[randAnimalNum];
    }

    if (adminsList.length > 0) {
      const randAdminNum = Math.floor(Math.random() * adminsList.length);
      replacements.ADMIN = adminsList[randAdminNum];
    }

    if (membersList.length > 0) {
      const randMemberNum = Math.floor(Math.random() * membersList.length);
      replacements.MEMBER = membersList[randMemberNum];
    }

    if (Object.keys(replacements).length > 0) {
      status = Mustache.render(status, replacements);
    }

    Logger.info(`customStatus - Setting new status for Discord Bot : category = "${category}" and status = "${status}"`);
    client.user.setActivity(status, { type: category });
  },
};
