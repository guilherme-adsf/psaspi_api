module.exports = {
  apps: [
    {
      name: "app",
      script: "ts-node ./src/index.ts",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
