//@ts-check
"use strict";

const path = require("path");

/** @type {import('webpack').Configuration} */
const config = {
  target: "node",
  mode: "none",
  entry: "./src/mcp/server.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "mcp-server.js",
    libraryTarget: "commonjs2",
  },
  externals: {},
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: "ts-loader", options: { configFile: "src/mcp/tsconfig.json" } }],
      },
    ],
  },
  devtool: "nosources-source-map",
};

module.exports = config;
