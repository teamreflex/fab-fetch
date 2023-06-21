import { request } from "./http.js";
import { AuthResult, User } from "./types.js";
import chalk from "chalk";

// eslint-disable-next-line import/prefer-default-export
export const login = async (): Promise<AuthResult> => {
  const email = process.env.FAB_EMAIL as string;
  const password = process.env.FAB_PASSWORD as string;
  console.info(chalk.green(`Logging in with email:`, chalk.cyan.bold(email)));

  const { data, error } = await request("post", "/signin", {
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(
      password
    )}`,
    userid: 0,
  });

  if (error) {
    console.info(chalk.red(`Error logging in: ${error}`));
    process.exit();
  }

  console.info(
    chalk.green(`Logged in as user:`, chalk.cyan.bold(data.login.user.nickName))
  );
  console.info(
    chalk.green(`Points available:`, chalk.cyan.bold(data.login.user.points))
  );
  process.env.FAB_ACCESS_TOKEN = data.login.token;
  process.env.FAB_USER_ID = data.login.user.id;

  return {
    token: data.login.token,
    user: data.login.user,
  };
};

export const userInfo = async (): Promise<User> => {
  const userId = process.env.FAB_USER_ID;
  const accessToken = process.env.FAB_ACCESS_TOKEN;

  const { data, error } = await request("get", `/users/${userId}/info`, {
    userid: userId,
    accessToken: accessToken,
  });

  if (error) {
    console.info(chalk.red(`Error fetching user info: ${error}`));
    process.exit();
  }

  console.info(
    chalk.green(`Fetched user:`, chalk.cyan.bold(data.user.nickName))
  );
  console.info(
    chalk.green(`Points available:`, chalk.cyan.bold(data.user.points))
  );

  return data.user;
};
