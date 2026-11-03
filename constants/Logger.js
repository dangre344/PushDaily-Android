// Logs only in development builds. Release builds print nothing: logging every
// render (UserProvider) and every event costs frames on low-end phones, and
// puts user details in the device log.
let SERVER_TYPE = __DEV__ ? "dev" : "prod";

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
