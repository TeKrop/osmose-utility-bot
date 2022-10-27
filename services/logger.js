// GLOBAL
const winston = require('winston'); // Winston Logging System
const DailyRotateFile = require('winston-daily-rotate-file'); // Winston Daily Log Rotation

// LOCAL
const Config = require('../config.json');

// logger initialisation
const customWinstonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf((info) => `${info.timestamp} ${info.level} : ${info.message}`),
);

// create logger with console transports (with colors)
const LoggerService = winston.createLogger({
  level: Config.logger.logLevel || 'info',
  format: customWinstonFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customWinstonFormat,
      ),
    }),
  ],
});

// if enabled in configuration, add transport with rotating log files
if (Config.logger.enableLogs) {
  LoggerService.add(
    new DailyRotateFile({
      datePattern: 'YYYY-MM-DD',
      zippedArchive: Config.logger.zipLogs || true,
      filename: Config.logger.logFilename || 'osmose-utility-bot-%DATE%.log',
      dirname: Config.logger.logPath || './logs',
    }),
  );
}

LoggerService.debug = LoggerService.debug.bind(LoggerService);
LoggerService.info = LoggerService.info.bind(LoggerService);
LoggerService.error = LoggerService.error.bind(LoggerService);
LoggerService.warn = LoggerService.warn.bind(LoggerService);
LoggerService.verbose = LoggerService.verbose.bind(LoggerService);
LoggerService.silly = LoggerService.silly.bind(LoggerService);

module.exports = LoggerService;
