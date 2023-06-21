export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const parseUserIds = (): number[] => {
  const userIds = process.env.PAY_FOR_USER_IDS.split(",");
  return userIds.map((userId) => parseInt(userId));
};
