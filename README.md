# 🤖 Osmose Utility Bot

![Version](https://img.shields.io/github/package-json/v/TeKrop/osmose-utility-bot)
[![Issues](https://img.shields.io/github/issues/TeKrop/osmose-utility-bot)](https://github.com/TeKrop/osmose-utility-bot/issues)
[![License: MIT](https://img.shields.io/github/license/TeKrop/osmose-utility-bot)](https://github.com/TeKrop/osmose-utility-bot/blob/master/LICENSE)

> Discord Bot made with Discord.js for Osmose Gaming Community. Using Slash commands, users can dynamically create voice channels (`/chan`), move people from one voice channel to another (`/massmove`), send a message when a specific event is occuring (`watcher`), etc. Warning : it was designed to be used on only one guild (server) at a time.

## Table of contents
* [🛠️ Configuration](#%EF%B8%8F-configuration)
* [📨 Logger configuration](#-logger-configuration)
* [⌨️ Commands configuration](#%EF%B8%8F-commands-configuration)
* [💬 Custom status configuration](#-custom-status-configuration)
* [💽 Installation](#-installation)
* [🐋 Docker](#-docker)
* [👨‍💻 Technical details](#-technical-details)
* [🤝 Contributing](#-contributing)
* [📝 License](#-license)

## 🛠️ Configuration
You can configure the application by copying the `config.example.json` and make your own `config.json` file. Variables with *** are mandatory. Here are the current available options :

| Variable             | Default value                         | Description |
| -------------        | -------------                         | ----------- |
| **`token`***         | `'your-bot-token-goes-here'`          | You must specify your bot token here |
| **`clientId`***         | `'your-client-id'`          | The identifier of your application (Application ID) |
| **`guildId`***         | `'your-guild-id'`          | The identifier of the guild you will use the bot on |
| **`logger`***        | `{}`                               | A list of configuration for logger |
| **`commands`***      | `Array`                               | A list of configuration for some commands |
| **`customStatus`**   | `Array`                               | Configuration for Bot Discord status |

## 📨 Logger configuration
| Variable             | Default value                         | Description |
| -------------        | -------------                         | ----------- |
| **`enableLogs`**     | `undefined`                           | Enable file logging. If you want to handle logs externally, put this value to false |
| **`logLevel`**       | `'info'`                           | Log levels, corresponding to Node.js levels : error, warn, info, verbose, debug |
| **`logPath`**        | `'./logs'`                            | Logs storage location |
| **`logFilename`**    | `'osmose-utility-bot-%DATE%.log'`     | Logs filename pattern (daily logs) |
| **`zipLogs`**        | `true`                                | Whether or not the app should zip the logs when the day is over |

## ⌨️ Commands configuration
2 commands are available now : **/chan** for creating dynamic channels, **/massmove** for moving people from one voice channel to another. For the **watcher** module, there is not command to use, it's just watching events and sending some messages in various channels accordingly.

### 🎤 Voice channels creation

| Variable                        | Default value                         | Description |
| -------------                   | -------------                         | ----------- |
| **`roles`***                  | `[]`                           | Array of roles identifiers which will be authorized to use the command |
| **`categories`***            | `[]`                           | Identifier of parent category for channels to create. Default is the same category as the command in which you write the command.            |
| **`categories[].parentCategory`***            | `undefined`                           | Identifier of parent category for channels to create.           |
| **`categories[].exceptionChannels`**         | `[]`                                  | List of channels identifiers which are in the category but should not be removed automatically by the bot |
| **`categories[].timeout`**                   | `86400000`                            | Number of milliseconds before removing the voice channel after no one has been in it (default : one day) |
| **`categories[].bitrate`**                   | `64000`                           | Bitrate to put on the voice channel. If not specified, will be 64000 (64kbps). |
| **`categories[].limit`**                     | `0`                           | Limit of simultaneous channels created by the command. Default is unlimited. |
| **`categories[].randomEmoji`**                     | `false`                           | Whether or not you want to use random emojis depending on the period of the year as prefix for your voice channels. |


### 🚅 Massmove
| Variable                   | Default value                         | Description |
| -------------              | -------------                         | ----------- |
| **`roles`***                  | `[]`                           | Array of roles identifiers which will be authorized to use the command |

### 👀 Watcher
| Variable                       | Default value                         | Description |
| -------------                  | -------------                         | ----------- |
| **`guildMemberRemoveChannel`** | `null`                           | Identifier of the text channel in which the watcher will notify when users exit the server (leaved, kicked, banned)            |
| **`guildMemberAddChannel`**    | `null`                           | Identifier of the text channel in which the watcher will notify when there are new users arriving on the server            |
| **`specialInvites`**           | `{}`                           | List of special invite codes for new user on server notifications            |
| **`guildMemberUpdateChannel`** | `null`                           | Identifier of the text channel in which the watcher will notify when users update their username on the server              |
| **`userUpdateChannel`**        | `null`                           | Identifier of the text channel in which the watcher will notify when users update their DiscordTag             |
| **`exceptionUsers`**           | `[]`                           | List of users identifiers who will not trigger "guildMemberUpdate" and "userUpdate" notifications            |
| **`memberUpdateMessages`**     | `[]`                               | List of template messages used when a user updates his username or DiscordTag           |
| **`memberLeavedMessages`**     | `[]`                               | List of template messages used when a user leaves the server           |
| **`memberKickedMessages`**     | `[]`                               | List of template messages used when a user is kicked from the server           |
| **`memberBannedMessages`**     | `[]`                               | List of template messages used when a user is banned from the server           |
| **`adminUserUrl`**             | `''`                           | If you have a website to consult stats about users, it's the base url used with **{{{memberUserId}}}** for consulting their data |

## 💬 Custom Status configuration
Custom status module is used to put funny random statuses on the bot : watching a movie, playing a game, listening conversations, etc. You can used five categories for the status : LISTENING, WATCHING, PLAYING, STREAMING, COMPETING. Sentences are using templating, with some available variables using configuration : **{{{GAME}}}**, **{{{MOVIE}}}**, **{{{ANIMAL}}}**, **{{{MEMBER}}}**, **{{{ADMIN}}}**.

| Variable           | Default value                         | Description |
| -------------      | -------------                         | ----------- |
| **`list`**         | `[]`                           | List of statuses, indexed by categories |
| **`games`**        | `[]`                           | List of games (used in templating with **{{{GAME}}}**)            |
| **`movies`**       | `[]`                           | List of movies (used in templating with **{{{MOVIE}}}**)            |
| **`animals`**      | `[]`                           | List of animals (used in templating with **{{{ANIMAL}}}**)            |
| **`membersRoles`** | `[]`                           | List of discord roles identifiers used to retrieve members (used in templating with **{{{MEMBER}}}**)            |
| **`adminRole`**    | `null`                           | Discord role identifier used to retrieve admins (used in templating with **{{{ADMIN}}}**)            |
| **`timeInterval`** | `1800000`                             | Time interval before switching to a new status in milliseconds (default : 30min)          |

## 💽 Installation

```sh
npm install
node deploy-commands.js
node index.js
```

## 🐋 Docker

### Build
```
docker build https://github.com/TeKrop/osmose-utility-bot.git#main -t tekrop/osmose-utility-bot:latest
```
### Run
```
OUB_DOCKER_PATH="/opt/osmose-utility-bot"
docker run -d \
	--name osmose-utility-bot \
	--volume /local_path_to_logs:${OUB_DOCKER_PATH}/logs \
	--volume /local_path_to_config.json:${OUB_DOCKER_PATH}/config.json \
	tekrop/osmose-utility-bot
```

## 👨‍💻 Technical details

For code syntax and style, I'm using **Airbnb JS Style Guide** (https://github.com/airbnb/javascript). I'm using **Discord.js** library, **emoji-regex** in order to be able to parse emojis, **mustache** for simple templating when displaying messages, and **winston** for logging.

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/TeKrop/osmose-utility-bot/issues).

## 📝 License

Copyright © 2019-2021 [Valentin PORCHET](https://github.com/TeKrop).

This project is [MIT](https://github.com/TeKrop/osmose-utility-bot/blob/master/LICENSE) licensed.

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
