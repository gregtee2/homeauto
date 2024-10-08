const path = require('path');

module.exports = {
  entry: './src/services/KasaDeviceManager.js',
  output: {
    filename: 'KasaDeviceManager.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'KasaDeviceManager',
    libraryTarget: 'window',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  mode: 'production',
};
