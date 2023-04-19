const path = require('path')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            allowTsInNodeModules: true,
          },
        },
        exclude: /node_modules(?!\/@marinade\.finance\/directed-stake-sdk)/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    fallback: {
      fs: false,
    },
  },
  output: {
    filename: 'marinade-ts-sdk.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'MarinadeSdk',
      type: 'this',
    },
  },
  plugins: [new NodePolyfillPlugin()],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
}
