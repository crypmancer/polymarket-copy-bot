import chalk from "chalk";

const timestamp = () => chalk.gray(new Date().toISOString());

export const logger = {
  title: (msg: string) =>
    console.log(
      `${timestamp()} ${chalk.bgBlue.white.bold(" TITLE ")} ${chalk.blueBright.bold(msg)}`
    ),

  success: (msg: string) =>
    console.log(
      `${timestamp()} ${chalk.bgGreen.black.bold(" SUCCESS ")} ${chalk.greenBright(msg)}`
    ),

  warning: (msg: string) =>
    console.log(
      `${timestamp()} ${chalk.bgYellow.black.bold(" WARNING ")} ${chalk.yellow(msg)}`
    ),

  info: (msg: string) =>
    console.log(
      `${timestamp()} ${chalk.bgCyan.black.bold(" INFO ")} ${chalk.cyan(msg)}`
    ),

  error: (msg: string, error?: Error | unknown) => {
    let errorMsg = msg;
    if (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      errorMsg = `${msg}: ${errorStr}`;
    }
    console.log(
      `${timestamp()} ${chalk.bgRed.white.bold(" ERROR ")} ${chalk.redBright.bold(errorMsg)}`
    );
  },

  debug: (msg: string) => {
    if (process.env.DEBUG === "true") {
      console.log(
        `${timestamp()} ${chalk.bgMagenta.white.bold(" DEBUG ")} ${chalk.magenta(msg)}`
      );
    }
  }
};
