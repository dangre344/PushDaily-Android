let SERVER_TYPE = "dev";

export const Logger = {
  log: (...args) => {
    if (SERVER_TYPE === "dev") {
      return console.log(...args);
    }
  },
  warn: (...args) => {
    if (SERVER_TYPE === "dev") {
      return console.warn(...args);
    }
  },
  error: (...args) => {
    if (SERVER_TYPE === "dev") {
      return console.error(...args);
    }
  },
  info: (...args) => {
    if (SERVER_TYPE === "dev") {
      return console.info(...args);
    }
  },
};
