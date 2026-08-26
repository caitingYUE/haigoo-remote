import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import path from 'path'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge) => {
  const releaseChannel = String(process.env.TARO_APP_RELEASE_CHANNEL || '').trim()
  if (releaseChannel && !['experience', 'production'].includes(releaseChannel)) {
    throw new Error(`Unsupported TARO_APP_RELEASE_CHANNEL: ${releaseChannel}`)
  }
  const outputRoot = releaseChannel === 'experience'
    ? 'dist-experience'
    : process.env.NODE_ENV === 'production'
      ? 'dist-prod'
      : 'dist'
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'miniprogram',
    date: '2026-7-16',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot,
    plugins: [
      "@tarojs/plugin-generator"
    ],
    defineConstants: {
    },
    copy: {
      patterns: [
        {
          from: path.resolve(__dirname, '../assets/static/home-hero-bg.jpg'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/home-hero-bg.jpg`)
        },
        {
          from: path.resolve(__dirname, '../../public/assets/brandlogo.png'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/haigoo-brand-logo.png`)
        },
        {
          from: path.resolve(__dirname, '../../public/avatars'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/avatars`)
        },
        {
          from: path.resolve(__dirname, '../../public/series_assistant.png'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/haigoo-advisor.png`)
        },
        {
          from: path.resolve(__dirname, '../assets/static/haigoo-community.png'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/haigoo-community.png`)
        },
        {
          from: path.resolve(__dirname, '../assets/icons'),
          to: path.resolve(__dirname, `../${outputRoot}/assets/icons`)
        }
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false
      }
    },
    cache: {
      enable: false // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {

          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
