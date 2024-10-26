import loglevel from 'loglevel';
export type LogLevelMethodNames = 'debug' | 'info' | 'warn' | 'error';
export type Logger = Record<LogLevelMethodNames, loglevel.LoggingMethod>;
export default function logger({ logger, level, }?: {
    logger?: Logger;
    level?: loglevel.LogLevelDesc;
}): Logger;
//# sourceMappingURL=logger.d.ts.map