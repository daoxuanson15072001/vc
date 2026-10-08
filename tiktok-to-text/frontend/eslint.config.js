// ESLint (DESIGN V.9.1, AIX-01, SYS-29): chỉ kiểm trợ năng + luật hook + cấm hộp thoại gốc của trình duyệt.
// Code mới (component dùng chung, routes, pageMeta, urlState) mức LỖI; trang cũ mức CẢNH BÁO cho tới khi chuyển sang
// component mới ở UI-2…4 — chuyển xong màn nào thì đưa file đó vào STRICT.
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'

const STRICT = [
  'src/components/{PageHeader,Tabs,Segmented,FilterBar,DataTable,ActionMenu,Overlay,Tree,icons,StatusBadge,Notice,CardGrid}.jsx',
  'src/statuses.js',
  // UI-2: màn đã chuyển sang component mới
  'src/components/{AppShell,ContentSearch,pickers,social,playlist}.jsx',
  'src/chatContext.js',
  'src/pages/{Dashboard,Knowledge,Refine,RefineLive,Channels,Videos,Wiki,Playlists,Leaderboard,Review,BulkReview}.jsx',
  'src/pages/{kb,wiki,review}/**',
  // UI-3
  'src/components/{Stepper,ChangePassword}.jsx',
  'src/pages/learn/{MyLearning,Attempt,Grading,Library,Lesson,Paths,PathEdit,Design}.jsx',
  'src/pages/learn/{due,}.js',
  'src/pages/learn/{grading,library,paths}/**',
  'src/pages/{Org,Spaces,Admin}.jsx',
  'src/pages/{org,spaces,admin}/**',
  'src/{routes,pageMeta,urlState,theme}.js',
  'src/pages/NotFound.jsx',
  'src/pages/dev/**',
]

// Bộ recommended của jsx-a11y hạ xuống cảnh báo cho code cũ (giữ nguyên luật đang tắt trong bộ đó)
const a11yRules = Object.fromEntries(Object.entries(jsxA11y.flatConfigs.recommended.rules)
  .map(([k, v]) => [k, (Array.isArray(v) ? v[0] : v) === 'off' ? v : Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn']))

export default [
  { ignores: ['dist/**', 'node_modules/**', 'e2e/**', 'playwright-report/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'jsx-a11y': jsxA11y, 'react-hooks': reactHooks },
    rules: {
      ...a11yRules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // AIX-01: không hộp thoại gốc — dùng confirmDialog / promptDialog / toast
      'no-restricted-globals': ['error',
        { name: 'confirm', message: 'Dùng confirmDialog (components/dialog.jsx) — AIX-01' },
        { name: 'prompt', message: 'Dùng promptDialog (components/dialog.jsx) — AIX-01' },
        { name: 'alert', message: 'Dùng toast() (components/toast.jsx) — AIX-01' }],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'confirm', message: 'Dùng confirmDialog — AIX-01' },
        { object: 'window', property: 'prompt', message: 'Dùng promptDialog — AIX-01' },
        { object: 'window', property: 'alert', message: 'Dùng toast() — AIX-01' }],
    },
  },
  {
    files: STRICT,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
