import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
    // 忽略
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.output/**',
            '**/coverage/**',
            '**/*.min.*'
        ],
    },

    // JS 推荐规则
    js.configs.recommended,

    // TS 推荐规则（不做 type-aware，先保证轻量可用）
    ...tseslint.configs.recommended,

    // Vue3 推荐规则（包含对 .vue 的解析）
    ...vue.configs['flat/recommended'],

    // 你的项目文件匹配
    {
        files: ['**/*.{js,cjs,mjs,ts,tsx,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            // demo 包中的单字组件名（Card, Logo 等）是合理的布局组件
            'vue/multi-word-component-names': 'off',
        },
    },

    // 如果用了 Prettier：关闭与 Prettier 冲突的 ESLint 规则
    eslintConfigPrettier,
]