module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ['standard-with-typescript'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error'
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  }
}
